from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crawlers.registry import get_crawler
from app.database import get_db
from app.models import JobPosting, Source
from app.schemas import JobSyncRunOut, SourceCrawlInfoOut, SourceSummary, SyncRequest
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
        sync_run = run_source_sync(
            db,
            source_key=source_key,
            start_page=payload.start_page,
            end_page=payload.end_page,
        )
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail.startswith("Source not found:") else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    if sync_run.status == "failed":
        raise HTTPException(status_code=502, detail=sync_run.message or "Sync failed")
    return JobSyncRunOut.model_validate(sync_run)


@router.get("/{source_key}/crawl-info", response_model=SourceCrawlInfoOut)
def get_source_crawl_info(source_key: str) -> SourceCrawlInfoOut:
    try:
        crawler = get_crawler(source_key)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Source not found: {source_key}") from exc

    try:
        crawl_info = crawler.get_crawl_info()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        crawler.close()

    return SourceCrawlInfoOut(
        source_key=source_key,
        current_page=crawl_info.current_page,
        total_pages=crawl_info.total_pages,
        total_items=crawl_info.total_items,
    )
