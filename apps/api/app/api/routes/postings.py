from __future__ import annotations

from math import ceil
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.config import LIST_CACHE_TTL_SECONDS
from app.database import get_db
from app.models import JobPosting, Source
from app.schemas import (
    JobPostingOut,
    JobPostingUpdate,
    ManualJobPostingCreate,
    PaginatedJobPostingOut,
    PostingOverviewOut,
)
from app.services.cache import get_read_cache_value, invalidate_read_caches, make_cache_key
from app.services.sync import create_manual_posting


router = APIRouter(prefix="/postings", tags=["postings"])
PostingTabKey = Literal["all", "new", "interesting", "ignored", "bookmarked", "todo"]


def resolve_posting_flags(
    current_bookmarked: bool,
    current_todo: bool,
    next_bookmarked: bool | None,
    next_todo: bool | None,
) -> tuple[bool, bool]:
    bookmarked = current_bookmarked if next_bookmarked is None else next_bookmarked
    todo = current_todo if next_todo is None else next_todo

    if next_bookmarked is False and next_todo is None:
        todo = False
    if todo:
        bookmarked = True
    if not bookmarked:
        todo = False

    return bookmarked, todo


def serialize_posting(posting: JobPosting) -> JobPostingOut:
    return JobPostingOut(
        id=posting.id,
        source_key=posting.source.key,
        source_name=posting.source.name,
        external_id=posting.external_id,
        company_name=posting.company_name,
        title=posting.title,
        detail_url=posting.detail_url,
        external_apply_url=posting.external_apply_url,
        ingest_kind=posting.ingest_kind,
        posted_at=posting.posted_at,
        apply_start_date=posting.apply_start_date,
        apply_end_date=posting.apply_end_date,
        apply_period_raw=posting.apply_period_raw,
        normalized_content=posting.normalized_content,
        tags=posting.tags or [],
        curation_status=posting.curation_status,
        curation_note=posting.curation_note,
        is_bookmarked=bool(posting.is_bookmarked),
        is_todo=bool(posting.is_todo),
        last_seen_at=posting.last_seen_at,
        application_id=posting.application.id if posting.application else None,
        application_status=posting.application.status if posting.application else None,
    )


@router.get("", response_model=list[JobPostingOut])
def list_postings(
    q: str | None = Query(default=None),
    curation_status: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    bookmarked: bool | None = Query(default=None),
    todo: bool | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[JobPostingOut]:
    statement = (
        select(JobPosting)
        .options(
            joinedload(JobPosting.source),
            joinedload(JobPosting.application),
        )
        .join(JobPosting.source)
    )

    filters = []
    if q:
        wildcard = f"%{q.strip()}%"
        filters.append(
            or_(
                JobPosting.title.ilike(wildcard),
                JobPosting.company_name.ilike(wildcard),
                JobPosting.normalized_content.ilike(wildcard),
            )
        )
    if curation_status:
        filters.append(JobPosting.curation_status == curation_status)
    if source_key:
        filters.append(Source.key == source_key)
    if bookmarked is not None:
        filters.append(JobPosting.is_bookmarked == bookmarked)
    if todo is not None:
        filters.append(JobPosting.is_todo == todo)

    if filters:
        statement = statement.where(and_(*filters))

    postings = db.scalars(
        statement.order_by(
            desc(JobPosting.posted_at),
            desc(JobPosting.created_at),
        )
    ).all()
    return [serialize_posting(posting) for posting in postings]


@router.get("/overview", response_model=PostingOverviewOut)
def get_postings_overview(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> PostingOverviewOut:
    cache_key = make_cache_key(
        "postings:overview:",
        q=q,
        source_key=source_key,
    )
    return get_read_cache_value(
        cache_key,
        LIST_CACHE_TTL_SECONDS,
        lambda: load_postings_overview(db, q, source_key),
    )


@router.get("/all", response_model=PaginatedJobPostingOut)
def list_all_postings(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedJobPostingOut:
    return load_cached_postings_page(db, "all", q, source_key, page, page_size)


@router.get("/new", response_model=PaginatedJobPostingOut)
def list_new_postings(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedJobPostingOut:
    return load_cached_postings_page(db, "new", q, source_key, page, page_size)


@router.get("/interesting", response_model=PaginatedJobPostingOut)
def list_interesting_postings(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedJobPostingOut:
    return load_cached_postings_page(db, "interesting", q, source_key, page, page_size)


@router.get("/ignored", response_model=PaginatedJobPostingOut)
def list_ignored_postings(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedJobPostingOut:
    return load_cached_postings_page(db, "ignored", q, source_key, page, page_size)


@router.get("/bookmarked", response_model=PaginatedJobPostingOut)
def list_bookmarked_postings(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedJobPostingOut:
    return load_cached_postings_page(db, "bookmarked", q, source_key, page, page_size)


@router.get("/todo", response_model=PaginatedJobPostingOut)
def list_todo_postings(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedJobPostingOut:
    return load_cached_postings_page(db, "todo", q, source_key, page, page_size)


@router.post("/manual", response_model=JobPostingOut)
def create_manual_posting_entry(
    payload: ManualJobPostingCreate,
    db: Session = Depends(get_db),
) -> JobPostingOut:
    try:
        posting = create_manual_posting(
            db,
            platform_name=payload.platform_name,
            company_name=payload.company_name,
            title=payload.title,
            detail_url=payload.detail_url,
            external_apply_url=payload.external_apply_url,
            posted_at=payload.posted_at,
            apply_start_date=payload.apply_start_date,
            apply_end_date=payload.apply_end_date,
            apply_period_raw=payload.apply_period_raw,
            normalized_content=payload.normalized_content,
            tags=payload.tags,
            curation_status=payload.curation_status,
            curation_note=payload.curation_note,
            is_bookmarked=payload.is_bookmarked,
            is_todo=payload.is_todo,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    posting = db.scalar(
        select(JobPosting)
        .options(
            joinedload(JobPosting.source),
            joinedload(JobPosting.application),
        )
        .where(JobPosting.id == posting.id)
    )
    if posting is None:
        raise HTTPException(status_code=500, detail="Posting could not be reloaded.")
    return serialize_posting(posting)


def load_cached_postings_page(
    db: Session,
    tab: PostingTabKey,
    q: str | None,
    source_key: str | None,
    page: int,
    page_size: int,
) -> PaginatedJobPostingOut:
    cache_key = make_cache_key(
        f"postings:{tab}:",
        q=q,
        source_key=source_key,
        page=page,
        page_size=page_size,
    )
    return get_read_cache_value(
        cache_key,
        LIST_CACHE_TTL_SECONDS,
        lambda: load_postings_page(db, tab, q, source_key, page, page_size),
    )


def load_postings_overview(
    db: Session,
    q: str | None,
    source_key: str | None,
) -> PostingOverviewOut:
    return PostingOverviewOut(
        all=count_postings(db, build_posting_filters("all", q, source_key)),
        new=count_postings(db, build_posting_filters("new", q, source_key)),
        interesting=count_postings(db, build_posting_filters("interesting", q, source_key)),
        ignored=count_postings(db, build_posting_filters("ignored", q, source_key)),
        bookmarked=count_postings(db, build_posting_filters("bookmarked", q, source_key)),
        todo=count_postings(db, build_posting_filters("todo", q, source_key)),
    )


def load_postings_page(
    db: Session,
    tab: PostingTabKey,
    q: str | None,
    source_key: str | None,
    page: int,
    page_size: int,
) -> PaginatedJobPostingOut:
    filters = build_posting_filters(tab, q, source_key)
    total_count = count_postings(db, filters)
    total_pages = max(1, ceil(total_count / page_size)) if total_count else 1
    resolved_page = min(page, total_pages)
    offset = (resolved_page - 1) * page_size

    statement = (
        select(JobPosting)
        .options(
            joinedload(JobPosting.source),
            joinedload(JobPosting.application),
        )
        .join(JobPosting.source)
    )
    if filters:
        statement = statement.where(and_(*filters))

    postings = db.scalars(
        statement.order_by(
            desc(JobPosting.posted_at),
            desc(JobPosting.created_at),
        )
        .offset(offset)
        .limit(page_size)
    ).all()

    return PaginatedJobPostingOut(
        items=[serialize_posting(posting) for posting in postings],
        page=resolved_page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
        has_prev=resolved_page > 1,
        has_next=resolved_page < total_pages,
    )


def count_postings(db: Session, filters: list[object]) -> int:
    statement = select(func.count(JobPosting.id)).select_from(JobPosting).join(JobPosting.source)
    if filters:
        statement = statement.where(and_(*filters))
    return db.scalar(statement) or 0


def build_posting_filters(
    tab: PostingTabKey,
    q: str | None,
    source_key: str | None,
) -> list[object]:
    filters: list[object] = []

    if q:
        wildcard = f"%{q.strip()}%"
        filters.append(
            or_(
                JobPosting.title.ilike(wildcard),
                JobPosting.company_name.ilike(wildcard),
                JobPosting.normalized_content.ilike(wildcard),
            )
        )

    if source_key:
        filters.append(Source.key == source_key)

    if tab == "new":
        filters.append(JobPosting.curation_status == "new")
    elif tab == "interesting":
        filters.append(JobPosting.curation_status == "interesting")
    elif tab == "ignored":
        filters.append(JobPosting.curation_status == "ignored")
    elif tab == "bookmarked":
        filters.append(JobPosting.is_bookmarked.is_(True))
    elif tab == "todo":
        filters.append(JobPosting.is_todo.is_(True))

    return filters


@router.patch("/{posting_id}", response_model=JobPostingOut)
def update_posting(
    posting_id: int,
    payload: JobPostingUpdate,
    db: Session = Depends(get_db),
) -> JobPostingOut:
    posting = db.scalar(
        select(JobPosting)
        .options(joinedload(JobPosting.source), joinedload(JobPosting.application))
        .where(JobPosting.id == posting_id)
    )
    if posting is None:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    if payload.curation_status is not None:
        posting.curation_status = payload.curation_status
    if payload.curation_note is not None:
        posting.curation_note = payload.curation_note
    posting.is_bookmarked, posting.is_todo = resolve_posting_flags(
        current_bookmarked=bool(posting.is_bookmarked),
        current_todo=bool(posting.is_todo),
        next_bookmarked=payload.is_bookmarked,
        next_todo=payload.is_todo,
    )
    db.commit()
    db.refresh(posting)
    invalidate_read_caches()
    return serialize_posting(posting)
