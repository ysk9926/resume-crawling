from __future__ import annotations

from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, joinedload

from app.config import LIST_CACHE_TTL_SECONDS
from app.database import get_db
from app.models import Application, CoverLetterItem, CoverLetterTag, JobPosting
from app.schemas import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationUpdate,
    CoverLetterItemCreate,
    CoverLetterItemOut,
    CoverLetterItemUpdate,
    ManualApplicationCreate,
    PaginatedCoverLetterItemOut,
)
from app.services.cache import get_read_cache_value, make_cache_key
from app.services.sync import (
    create_cover_letter_item,
    create_manual_application,
    create_or_replace_application,
    delete_cover_letter_item,
    normalize_cover_letter_tag,
    update_application_snapshot,
    update_cover_letter_item,
)


router = APIRouter(prefix="/applications", tags=["applications"])


def serialize_application(application: Application) -> ApplicationOut:
    posting_tags = application.job_posting.tags or []
    return ApplicationOut(
        id=application.id,
        job_posting_id=application.job_posting_id,
        job_title=application.job_posting.title,
        company_name=application.job_posting.company_name,
        source_key=application.job_posting.source.key,
        source_name=application.job_posting.source.name,
        detail_url=application.job_posting.detail_url,
        external_apply_url=application.job_posting.external_apply_url,
        resume_template_id=application.resume_template_id,
        resume_template_title=application.resume_template.title if application.resume_template else None,
        application_method=application.application_method,
        status=application.status,
        note=application.note,
        applied_at=application.applied_at,
        apply_end_date_snapshot=application.apply_end_date_snapshot,
        apply_period_raw_snapshot=application.apply_period_raw_snapshot,
        resume_snapshot_title=application.resume_snapshot_title,
        resume_snapshot_markdown=application.resume_snapshot_markdown,
        posting_normalized_content=application.job_posting.normalized_content or "",
        posting_tags=list(posting_tags),
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


def serialize_cover_letter_item(item: CoverLetterItem) -> CoverLetterItemOut:
    return CoverLetterItemOut(
        id=item.id,
        application_id=item.application_id,
        question=item.question,
        answer_markdown=item.answer_markdown,
        order_index=item.order_index,
        tags=[tag.label for tag in sorted(item.tags, key=lambda tag: tag.name)],
        company_name=item.application.job_posting.company_name,
        job_title=item.application.job_posting.title,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def load_application_model(db: Session, application_id: int) -> Application | None:
    return db.scalar(
        select(Application)
        .options(
            joinedload(Application.job_posting).joinedload(JobPosting.source),
            joinedload(Application.resume_template),
        )
        .where(Application.id == application_id)
    )


def load_cover_letter_item_model(db: Session, item_id: int) -> CoverLetterItem | None:
    return db.execute(
        select(CoverLetterItem)
        .options(
            joinedload(CoverLetterItem.tags),
            joinedload(CoverLetterItem.application)
            .joinedload(Application.job_posting)
            .joinedload(JobPosting.source),
        )
        .where(CoverLetterItem.id == item_id)
    ).unique().scalar_one_or_none()


@router.get("", response_model=list[ApplicationOut])
def list_applications(db: Session = Depends(get_db)) -> list[ApplicationOut]:
    return get_read_cache_value(
        "applications:list",
        LIST_CACHE_TTL_SECONDS,
        lambda: load_applications(db),
    )


def load_applications(db: Session) -> list[ApplicationOut]:
    applications = db.scalars(
        select(Application)
        .options(
            joinedload(Application.job_posting).joinedload(JobPosting.source),
            joinedload(Application.resume_template),
        )
        .order_by(desc(Application.updated_at))
    ).all()
    return [serialize_application(application) for application in applications]


@router.get("/cover-letter-library", response_model=PaginatedCoverLetterItemOut)
def list_cover_letter_library(
    tag: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedCoverLetterItemOut:
    normalized_tag = normalize_cover_letter_tag(tag or "") or None
    cache_key = make_cache_key(
        "cover-letter:library:",
        tag=normalized_tag,
        page=page,
        page_size=page_size,
    )
    return get_read_cache_value(
        cache_key,
        LIST_CACHE_TTL_SECONDS,
        lambda: load_cover_letter_library_page(db, normalized_tag, page, page_size),
    )


def load_cover_letter_library_page(
    db: Session,
    normalized_tag: str | None,
    page: int,
    page_size: int,
) -> PaginatedCoverLetterItemOut:
    filters = []
    if normalized_tag:
        filters.append(CoverLetterItem.tags.any(CoverLetterTag.name == normalized_tag))

    total_count = db.scalar(select(func.count(CoverLetterItem.id)).where(*filters)) or 0
    total_pages = max(1, ceil(total_count / page_size)) if total_count else 1
    resolved_page = min(page, total_pages)
    offset = (resolved_page - 1) * page_size

    items = (
        db.execute(
            select(CoverLetterItem)
            .options(
                joinedload(CoverLetterItem.tags),
                joinedload(CoverLetterItem.application)
                .joinedload(Application.job_posting)
                .joinedload(JobPosting.source),
            )
            .where(*filters)
            .order_by(desc(CoverLetterItem.updated_at), desc(CoverLetterItem.id))
            .offset(offset)
            .limit(page_size)
        )
        .unique()
        .scalars()
        .all()
    )

    return PaginatedCoverLetterItemOut(
        items=[serialize_cover_letter_item(item) for item in items],
        page=resolved_page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
        has_prev=resolved_page > 1,
        has_next=resolved_page < total_pages,
    )


@router.patch("/cover-letter-items/{item_id}", response_model=CoverLetterItemOut)
def patch_cover_letter_item(
    item_id: int,
    payload: CoverLetterItemUpdate,
    db: Session = Depends(get_db),
) -> CoverLetterItemOut:
    try:
        updated = update_cover_letter_item(
            db,
            item_id=item_id,
            question=payload.question,
            answer_markdown=payload.answer_markdown,
            tags=payload.tags,
            order_index=payload.order_index,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    item = load_cover_letter_item_model(db, updated.id)
    if item is None:
        raise HTTPException(status_code=500, detail="Cover letter item could not be reloaded.")
    return serialize_cover_letter_item(item)


@router.delete("/cover-letter-items/{item_id}", status_code=204)
def remove_cover_letter_item(
    item_id: int,
    db: Session = Depends(get_db),
) -> Response:
    try:
        delete_cover_letter_item(db, item_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=204)


@router.get("/{application_id}/cover-letter-items", response_model=list[CoverLetterItemOut])
def list_application_cover_letter_items(
    application_id: int,
    db: Session = Depends(get_db),
) -> list[CoverLetterItemOut]:
    application = load_application_model(db, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")

    items = (
        db.execute(
            select(CoverLetterItem)
            .options(
                joinedload(CoverLetterItem.tags),
                joinedload(CoverLetterItem.application)
                .joinedload(Application.job_posting)
                .joinedload(JobPosting.source),
            )
            .where(CoverLetterItem.application_id == application_id)
            .order_by(CoverLetterItem.order_index, CoverLetterItem.id)
        )
        .unique()
        .scalars()
        .all()
    )
    return [serialize_cover_letter_item(item) for item in items]


@router.post("/{application_id}/cover-letter-items", response_model=CoverLetterItemOut)
def create_application_cover_letter_item(
    application_id: int,
    payload: CoverLetterItemCreate,
    db: Session = Depends(get_db),
) -> CoverLetterItemOut:
    try:
        created = create_cover_letter_item(
            db,
            application_id=application_id,
            question=payload.question,
            answer_markdown=payload.answer_markdown,
            tags=payload.tags,
        )
    except ValueError as exc:
        status_code = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    item = load_cover_letter_item_model(db, created.id)
    if item is None:
        raise HTTPException(status_code=500, detail="Cover letter item could not be reloaded.")
    return serialize_cover_letter_item(item)


@router.post("", response_model=ApplicationOut)
def create_application(
    payload: ApplicationCreate,
    db: Session = Depends(get_db),
) -> ApplicationOut:
    try:
        application = create_or_replace_application(
            db,
            job_posting_id=payload.job_posting_id,
            resume_template_id=payload.resume_template_id,
            application_method=payload.application_method,
            status=payload.status,
            note=payload.note,
            applied_at=payload.applied_at,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    application = load_application_model(db, application.id)
    if application is None:
        raise HTTPException(status_code=500, detail="Application could not be reloaded.")
    return serialize_application(application)


@router.post("/manual", response_model=ApplicationOut)
def create_manual_application_entry(
    payload: ManualApplicationCreate,
    db: Session = Depends(get_db),
) -> ApplicationOut:
    try:
        application = create_manual_application(
            db,
            platform_name=payload.platform_name,
            company_name=payload.company_name,
            job_title=payload.job_title,
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
            resume_template_id=payload.resume_template_id,
            application_method=payload.application_method,
            status=payload.status,
            note=payload.note,
            applied_at=payload.applied_at,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    application = load_application_model(db, application.id)
    if application is None:
        raise HTTPException(status_code=500, detail="Application could not be reloaded.")
    return serialize_application(application)


@router.get("/{application_id}", response_model=ApplicationOut)
def get_application(
    application_id: int,
    db: Session = Depends(get_db),
) -> ApplicationOut:
    application = load_application_model(db, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    return serialize_application(application)


@router.patch("/{application_id}", response_model=ApplicationOut)
def update_application(
    application_id: int,
    payload: ApplicationUpdate,
    db: Session = Depends(get_db),
) -> ApplicationOut:
    try:
        updated = update_application_snapshot(
            db,
            application_id=application_id,
            status=payload.status,
            note=payload.note,
            applied_at=payload.applied_at,
            resume_template_id=payload.resume_template_id,
            resume_snapshot_title=payload.resume_snapshot_title,
            resume_snapshot_markdown=payload.resume_snapshot_markdown,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    application = load_application_model(db, updated.id)
    if application is None:
        raise HTTPException(status_code=500, detail="Application could not be reloaded.")
    return serialize_application(application)
