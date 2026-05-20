from __future__ import annotations

from math import ceil
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session, aliased, joinedload

from app.config import LIST_CACHE_TTL_SECONDS
from app.database import get_db
from app.models import Application, JobPosting, Source, User, UserPostingState
from app.schemas import (
    JobPostingOut,
    JobPostingUpdate,
    ManualJobPostingCreate,
    PaginatedJobPostingOut,
    PostingOverviewOut,
)
from app.security import get_current_user
from app.services.cache import get_read_cache_value, invalidate_read_caches, make_cache_key
from app.services.sync import create_manual_posting
from app.services.user_scope import DEFAULT_CURATION_STATUS, get_or_create_posting_state, resolve_posting_flags


router = APIRouter(prefix="/postings", tags=["postings"])
PostingTabKey = Literal["all", "new", "interesting", "ignored", "bookmarked", "todo"]


def serialize_posting(
    posting: JobPosting,
    state: UserPostingState | None = None,
    application: Application | None = None,
) -> JobPostingOut:
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
        curation_status=state.curation_status if state else DEFAULT_CURATION_STATUS,
        curation_note=state.curation_note if state else None,
        is_bookmarked=bool(state.is_bookmarked) if state else False,
        is_todo=bool(state.is_todo) if state else False,
        last_seen_at=posting.last_seen_at,
        application_id=application.id if application else None,
        application_status=application.status if application else None,
    )


def load_application_map(
    db: Session,
    user_id: int,
    posting_ids: list[int],
) -> dict[int, Application]:
    if not posting_ids:
        return {}

    applications = db.scalars(
        select(Application).where(
            Application.user_id == user_id,
            Application.job_posting_id.in_(posting_ids),
        )
    ).all()
    return {application.job_posting_id: application for application in applications}


def build_posting_statement(
    user_id: int,
    q: str | None,
    source_key: str | None,
) -> tuple[object, type[UserPostingState]]:
    state_alias = aliased(UserPostingState)
    statement = (
        select(JobPosting, state_alias)
        .options(joinedload(JobPosting.source))
        .join(JobPosting.source)
        .outerjoin(
            state_alias,
            and_(
                state_alias.job_posting_id == JobPosting.id,
                state_alias.user_id == user_id,
            ),
        )
    )

    filters = build_shared_filters(q, source_key)
    if filters:
        statement = statement.where(and_(*filters))
    return statement, state_alias


def build_shared_filters(q: str | None, source_key: str | None) -> list[object]:
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
    return filters


def build_state_filters(
    state_alias: type[UserPostingState],
    *,
    curation_status: str | None = None,
    bookmarked: bool | None = None,
    todo: bool | None = None,
    tab: PostingTabKey | None = None,
) -> list[object]:
    filters: list[object] = []

    resolved_status = curation_status
    if tab == "new":
        resolved_status = DEFAULT_CURATION_STATUS
    elif tab == "interesting":
        resolved_status = "interesting"
    elif tab == "ignored":
        resolved_status = "ignored"
    elif tab == "bookmarked":
        bookmarked = True
    elif tab == "todo":
        todo = True

    if resolved_status is not None:
        if resolved_status == DEFAULT_CURATION_STATUS:
            filters.append(
                or_(
                    state_alias.id.is_(None),
                    state_alias.curation_status == DEFAULT_CURATION_STATUS,
                )
            )
        else:
            filters.append(state_alias.curation_status == resolved_status)

    if bookmarked is not None:
        if bookmarked:
            filters.append(state_alias.is_bookmarked.is_(True))
        else:
            filters.append(
                or_(
                    state_alias.id.is_(None),
                    state_alias.is_bookmarked.is_(False),
                )
            )

    if todo is not None:
        if todo:
            filters.append(state_alias.is_todo.is_(True))
        else:
            filters.append(
                or_(
                    state_alias.id.is_(None),
                    state_alias.is_todo.is_(False),
                )
            )

    return filters


@router.get("", response_model=list[JobPostingOut])
def list_postings(
    q: str | None = Query(default=None),
    curation_status: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    bookmarked: bool | None = Query(default=None),
    todo: bool | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[JobPostingOut]:
    statement, state_alias = build_posting_statement(current_user.id, q, source_key)
    filters = build_state_filters(
        state_alias,
        curation_status=curation_status,
        bookmarked=bookmarked,
        todo=todo,
    )
    if filters:
        statement = statement.where(and_(*filters))

    rows = db.execute(
        statement.order_by(desc(JobPosting.posted_at), desc(JobPosting.created_at))
    ).all()
    posting_ids = [posting.id for posting, _ in rows]
    application_map = load_application_map(db, current_user.id, posting_ids)

    return [
        serialize_posting(posting, state=state, application=application_map.get(posting.id))
        for posting, state in rows
    ]


@router.get("/overview", response_model=PostingOverviewOut)
def get_postings_overview(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostingOverviewOut:
    cache_key = make_cache_key(
        "postings:overview:",
        user_id=current_user.id,
        q=q,
        source_key=source_key,
    )
    return get_read_cache_value(
        cache_key,
        LIST_CACHE_TTL_SECONDS,
        lambda: load_postings_overview(db, current_user, q, source_key),
    )


@router.get("/all", response_model=PaginatedJobPostingOut)
def list_all_postings(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedJobPostingOut:
    return load_cached_postings_page(db, current_user, "all", q, source_key, page, page_size)


@router.get("/new", response_model=PaginatedJobPostingOut)
def list_new_postings(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedJobPostingOut:
    return load_cached_postings_page(db, current_user, "new", q, source_key, page, page_size)


@router.get("/interesting", response_model=PaginatedJobPostingOut)
def list_interesting_postings(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedJobPostingOut:
    return load_cached_postings_page(
        db,
        current_user,
        "interesting",
        q,
        source_key,
        page,
        page_size,
    )


@router.get("/ignored", response_model=PaginatedJobPostingOut)
def list_ignored_postings(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedJobPostingOut:
    return load_cached_postings_page(db, current_user, "ignored", q, source_key, page, page_size)


@router.get("/bookmarked", response_model=PaginatedJobPostingOut)
def list_bookmarked_postings(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedJobPostingOut:
    return load_cached_postings_page(
        db,
        current_user,
        "bookmarked",
        q,
        source_key,
        page,
        page_size,
    )


@router.get("/todo", response_model=PaginatedJobPostingOut)
def list_todo_postings(
    q: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedJobPostingOut:
    return load_cached_postings_page(db, current_user, "todo", q, source_key, page, page_size)


@router.post("/manual", response_model=JobPostingOut)
def create_manual_posting_entry(
    payload: ManualJobPostingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobPostingOut:
    try:
        posting = create_manual_posting(
            db,
            user_id=current_user.id,
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
        .options(joinedload(JobPosting.source))
        .where(JobPosting.id == posting.id)
    )
    if posting is None:
        raise HTTPException(status_code=500, detail="Posting could not be reloaded.")

    state = db.scalar(
        select(UserPostingState).where(
            UserPostingState.user_id == current_user.id,
            UserPostingState.job_posting_id == posting.id,
        )
    )
    return serialize_posting(posting, state=state)


def load_cached_postings_page(
    db: Session,
    current_user: User,
    tab: PostingTabKey,
    q: str | None,
    source_key: str | None,
    page: int,
    page_size: int,
) -> PaginatedJobPostingOut:
    cache_key = make_cache_key(
        f"postings:{tab}:",
        user_id=current_user.id,
        q=q,
        source_key=source_key,
        page=page,
        page_size=page_size,
    )
    return get_read_cache_value(
        cache_key,
        LIST_CACHE_TTL_SECONDS,
        lambda: load_postings_page(db, current_user, tab, q, source_key, page, page_size),
    )


def load_postings_overview(
    db: Session,
    current_user: User,
    q: str | None,
    source_key: str | None,
) -> PostingOverviewOut:
    return PostingOverviewOut(
        all=count_postings(db, current_user.id, q, source_key, tab="all"),
        new=count_postings(db, current_user.id, q, source_key, tab="new"),
        interesting=count_postings(db, current_user.id, q, source_key, tab="interesting"),
        ignored=count_postings(db, current_user.id, q, source_key, tab="ignored"),
        bookmarked=count_postings(db, current_user.id, q, source_key, tab="bookmarked"),
        todo=count_postings(db, current_user.id, q, source_key, tab="todo"),
    )


def load_postings_page(
    db: Session,
    current_user: User,
    tab: PostingTabKey,
    q: str | None,
    source_key: str | None,
    page: int,
    page_size: int,
) -> PaginatedJobPostingOut:
    total_count = count_postings(db, current_user.id, q, source_key, tab=tab)
    total_pages = max(1, ceil(total_count / page_size)) if total_count else 1
    resolved_page = min(page, total_pages)
    offset = (resolved_page - 1) * page_size

    statement, state_alias = build_posting_statement(current_user.id, q, source_key)
    state_filters = build_state_filters(state_alias, tab=tab)
    if state_filters:
        statement = statement.where(and_(*state_filters))

    rows = db.execute(
        statement
        .order_by(desc(JobPosting.posted_at), desc(JobPosting.created_at))
        .offset(offset)
        .limit(page_size)
    ).all()
    posting_ids = [posting.id for posting, _ in rows]
    application_map = load_application_map(db, current_user.id, posting_ids)

    return PaginatedJobPostingOut(
        items=[
            serialize_posting(posting, state=state, application=application_map.get(posting.id))
            for posting, state in rows
        ],
        page=resolved_page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
        has_prev=resolved_page > 1,
        has_next=resolved_page < total_pages,
    )


def count_postings(
    db: Session,
    user_id: int,
    q: str | None,
    source_key: str | None,
    *,
    tab: PostingTabKey = "all",
) -> int:
    state_alias = aliased(UserPostingState)
    statement = (
        select(func.count(JobPosting.id))
        .select_from(JobPosting)
        .join(JobPosting.source)
        .outerjoin(
            state_alias,
            and_(
                state_alias.job_posting_id == JobPosting.id,
                state_alias.user_id == user_id,
            ),
        )
    )
    filters = build_shared_filters(q, source_key) + build_state_filters(state_alias, tab=tab)
    if filters:
        statement = statement.where(and_(*filters))
    return db.scalar(statement) or 0


@router.patch("/{posting_id}", response_model=JobPostingOut)
def update_posting(
    posting_id: int,
    payload: JobPostingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobPostingOut:
    posting = db.scalar(
        select(JobPosting)
        .options(joinedload(JobPosting.source))
        .where(JobPosting.id == posting_id)
    )
    if posting is None:
        raise HTTPException(status_code=404, detail="Job posting not found.")

    state = get_or_create_posting_state(db, user_id=current_user.id, posting_id=posting.id)
    if payload.curation_status is not None:
        state.curation_status = payload.curation_status
    if payload.curation_note is not None:
        state.curation_note = payload.curation_note
    state.is_bookmarked, state.is_todo = resolve_posting_flags(
        current_bookmarked=bool(state.is_bookmarked),
        current_todo=bool(state.is_todo),
        next_bookmarked=payload.is_bookmarked,
        next_todo=payload.is_todo,
    )
    db.commit()
    db.refresh(state)
    invalidate_read_caches()
    return serialize_posting(posting, state=state)
