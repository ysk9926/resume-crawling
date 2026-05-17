from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import JobPosting
from app.schemas import JobPostingOut, JobPostingUpdate


router = APIRouter(prefix="/postings", tags=["postings"])


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
        posted_at=posting.posted_at,
        apply_start_date=posting.apply_start_date,
        apply_end_date=posting.apply_end_date,
        apply_period_raw=posting.apply_period_raw,
        normalized_content=posting.normalized_content,
        tags=posting.tags or [],
        curation_status=posting.curation_status,
        curation_note=posting.curation_note,
        last_seen_at=posting.last_seen_at,
        application_id=posting.application.id if posting.application else None,
        application_status=posting.application.status if posting.application else None,
    )


@router.get("", response_model=list[JobPostingOut])
def list_postings(
    q: str | None = Query(default=None),
    curation_status: str | None = Query(default=None),
    source_key: str | None = Query(default=None),
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
        filters.append(JobPosting.source.has(key=source_key))

    if filters:
        statement = statement.where(and_(*filters))

    statement = statement.order_by(
        desc(JobPosting.posted_at),
        desc(JobPosting.created_at),
    )

    postings = db.scalars(statement).all()
    return [serialize_posting(posting) for posting in postings]


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

    posting.curation_status = payload.curation_status
    posting.curation_note = payload.curation_note
    db.commit()
    db.refresh(posting)
    return serialize_posting(posting)
