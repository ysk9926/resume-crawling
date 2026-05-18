from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.config import LOOKUP_CACHE_TTL_SECONDS
from app.database import get_db
from app.models import ResumeTemplate
from app.schemas import ResumeTemplateCreate, ResumeTemplateOut, ResumeTemplateUpdate
from app.services.cache import get_read_cache_value, invalidate_read_caches


router = APIRouter(prefix="/resumes", tags=["resumes"])


@router.get("", response_model=list[ResumeTemplateOut])
def list_resumes(db: Session = Depends(get_db)) -> list[ResumeTemplateOut]:
    return get_read_cache_value(
        "resumes:list",
        LOOKUP_CACHE_TTL_SECONDS,
        lambda: load_resumes(db),
    )


def load_resumes(db: Session) -> list[ResumeTemplateOut]:
    resumes = db.scalars(
        select(ResumeTemplate).order_by(desc(ResumeTemplate.updated_at))
    ).all()
    return [ResumeTemplateOut.model_validate(resume) for resume in resumes]


@router.post("", response_model=ResumeTemplateOut)
def create_resume(
    payload: ResumeTemplateCreate,
    db: Session = Depends(get_db),
) -> ResumeTemplateOut:
    resume = ResumeTemplate(
        title=payload.title,
        summary=payload.summary,
        markdown_content=payload.markdown_content,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    invalidate_read_caches()
    return ResumeTemplateOut.model_validate(resume)


@router.patch("/{resume_id}", response_model=ResumeTemplateOut)
def update_resume(
    resume_id: int,
    payload: ResumeTemplateUpdate,
    db: Session = Depends(get_db),
) -> ResumeTemplateOut:
    resume = db.get(ResumeTemplate, resume_id)
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume template not found.")

    resume.title = payload.title
    resume.summary = payload.summary
    resume.markdown_content = payload.markdown_content
    db.commit()
    db.refresh(resume)
    invalidate_read_caches()
    return ResumeTemplateOut.model_validate(resume)
