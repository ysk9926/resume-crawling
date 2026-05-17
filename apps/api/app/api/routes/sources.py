from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import JobPosting, Source
from app.schemas import JobSyncRunOut, SourceSummary, SyncRequest
from app.services.sync import run_source_sync


router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("", response_model=list[SourceSummary])
def list_sources(db: Session = Depends(get_db)) -> list[SourceSummary]:
    postings_count_subquery = (
        select(JobPosting.source_id, func.count(JobPosting.id).label("posting_count"))
        .group_by(JobPosting.source_id)
        .subquery()
    )

    rows = db.execute(
        select(Source, func.coalesce(postings_count_subquery.c.posting_count, 0))
        .outerjoin(postings_count_subquery, Source.id == postings_count_subquery.c.source_id)
        .order_by(Source.name.asc())
    ).all()

    return [
        SourceSummary(
            id=source.id,
            key=source.key,
            name=source.name,
            base_url=source.base_url,
            is_enabled=source.is_enabled,
            last_synced_at=source.last_synced_at,
            posting_count=posting_count,
        )
        for source, posting_count in rows
    ]


@router.post("/{source_key}/sync", response_model=JobSyncRunOut)
def sync_source(
    source_key: str,
    payload: SyncRequest,
    db: Session = Depends(get_db),
) -> JobSyncRunOut:
    try:
        sync_run = run_source_sync(db, source_key=source_key, page_limit=payload.page_limit)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return JobSyncRunOut.model_validate(sync_run)
