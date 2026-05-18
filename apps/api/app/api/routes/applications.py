from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, joinedload

from app.config import LIST_CACHE_TTL_SECONDS
from app.database import get_db
from app.models import Application, JobPosting
from app.schemas import ApplicationCreate, ApplicationOut, ApplicationUpdate
from app.services.cache import get_read_cache_value
from app.services.sync import create_or_replace_application, update_application_snapshot


router = APIRouter(prefix="/applications", tags=["applications"])


def serialize_application(application: Application) -> ApplicationOut:
    return ApplicationOut(
        id=application.id,
        job_posting_id=application.job_posting_id,
        job_title=application.job_posting.title,
        company_name=application.job_posting.company_name,
        source_key=application.job_posting.source.key,
        detail_url=application.job_posting.detail_url,
        external_apply_url=application.job_posting.external_apply_url,
        resume_template_id=application.resume_template_id,
        resume_template_title=application.resume_template.title if application.resume_template else None,
        status=application.status,
        note=application.note,
        applied_at=application.applied_at,
        resume_snapshot_title=application.resume_snapshot_title,
        resume_snapshot_markdown=application.resume_snapshot_markdown,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


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
            status=payload.status,
            note=payload.note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    application = db.scalar(
        select(Application)
        .options(
            joinedload(Application.job_posting).joinedload(JobPosting.source),
            joinedload(Application.resume_template),
        )
        .where(Application.id == application.id)
    )
    if application is None:
        raise HTTPException(status_code=500, detail="Application could not be reloaded.")
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
            resume_snapshot_title=payload.resume_snapshot_title,
            resume_snapshot_markdown=payload.resume_snapshot_markdown,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    application = db.scalar(
        select(Application)
        .options(
            joinedload(Application.job_posting).joinedload(JobPosting.source),
            joinedload(Application.resume_template),
        )
        .where(Application.id == updated.id)
    )
    if application is None:
        raise HTTPException(status_code=500, detail="Application could not be reloaded.")
    return serialize_application(application)
