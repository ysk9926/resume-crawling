from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Application, JobPosting, JobSyncRun, ResumeTemplate, Source
from app.schemas import ApplicationOut, DashboardOut, JobPostingOut, JobSyncRunOut, SourceSummary
from .applications import serialize_application
from .postings import serialize_posting


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
def get_dashboard(db: Session = Depends(get_db)) -> DashboardOut:
    total_postings = db.scalar(select(func.count(JobPosting.id))) or 0
    interesting_postings = db.scalar(
        select(func.count(JobPosting.id)).where(JobPosting.curation_status == "interesting")
    ) or 0
    active_applications = db.scalar(
        select(func.count(Application.id)).where(Application.status.not_in(["rejected", "withdrawn"]))
    ) or 0
    resume_count = db.scalar(select(func.count(ResumeTemplate.id))) or 0

    postings_count_subquery = (
        select(JobPosting.source_id, func.count(JobPosting.id).label("posting_count"))
        .group_by(JobPosting.source_id)
        .subquery()
    )
    sources = db.execute(
        select(Source, func.coalesce(postings_count_subquery.c.posting_count, 0))
        .outerjoin(postings_count_subquery, Source.id == postings_count_subquery.c.source_id)
        .order_by(Source.name.asc())
    ).all()

    recent_postings = db.scalars(
        select(JobPosting)
        .options(joinedload(JobPosting.source), joinedload(JobPosting.application))
        .order_by(JobPosting.posted_at.desc(), JobPosting.created_at.desc())
        .limit(6)
    ).all()
    recent_applications = db.scalars(
        select(Application)
        .options(
            joinedload(Application.job_posting).joinedload(JobPosting.source),
            joinedload(Application.resume_template),
        )
        .order_by(Application.updated_at.desc())
        .limit(6)
    ).all()
    recent_sync_runs = db.scalars(
        select(JobSyncRun).order_by(JobSyncRun.started_at.desc()).limit(6)
    ).all()

    return DashboardOut(
        total_postings=total_postings,
        interesting_postings=interesting_postings,
        active_applications=active_applications,
        resume_count=resume_count,
        sources=[
            SourceSummary(
                id=source.id,
                key=source.key,
                name=source.name,
                base_url=source.base_url,
                is_enabled=source.is_enabled,
                last_synced_at=source.last_synced_at,
                posting_count=posting_count,
            )
            for source, posting_count in sources
        ],
        recent_postings=[serialize_posting(posting) for posting in recent_postings],
        recent_applications=[serialize_application(application) for application in recent_applications],
        recent_sync_runs=[JobSyncRunOut.model_validate(sync_run) for sync_run in recent_sync_runs],
    )
