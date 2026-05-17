from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    base_url: Mapped[str] = mapped_column(Text)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    sync_runs: Mapped[list["JobSyncRun"]] = relationship(
        back_populates="source",
        cascade="all, delete-orphan",
        order_by="desc(JobSyncRun.started_at)",
    )
    job_postings: Mapped[list["JobPosting"]] = relationship(
        back_populates="source",
        cascade="all, delete-orphan",
    )


class JobPosting(Base):
    __tablename__ = "job_postings"
    __table_args__ = (UniqueConstraint("source_id", "external_id", name="uq_job_source_external_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"), index=True)
    external_id: Mapped[str] = mapped_column(String(80), index=True)
    company_name: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(300))
    detail_url: Mapped[str] = mapped_column(Text)
    external_apply_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    posted_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    apply_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    apply_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    apply_period_raw: Mapped[str | None] = mapped_column(String(80), nullable=True)
    raw_content: Mapped[str] = mapped_column(Text)
    normalized_content: Mapped[str] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    curation_status: Mapped[str] = mapped_column(String(30), default="new", index=True)
    curation_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    source: Mapped["Source"] = relationship(back_populates="job_postings")
    application: Mapped["Application | None"] = relationship(
        back_populates="job_posting",
        uselist=False,
        cascade="all, delete-orphan",
    )


class ResumeTemplate(Base):
    __tablename__ = "resume_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    summary: Mapped[str] = mapped_column(Text, default="")
    markdown_content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    applications: Mapped[list["Application"]] = relationship(back_populates="resume_template")


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_posting_id: Mapped[int] = mapped_column(ForeignKey("job_postings.id"), unique=True, index=True)
    resume_template_id: Mapped[int | None] = mapped_column(ForeignKey("resume_templates.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="planned", index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    applied_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    resume_snapshot_title: Mapped[str] = mapped_column(String(200))
    resume_snapshot_markdown: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    job_posting: Mapped["JobPosting"] = relationship(back_populates="application")
    resume_template: Mapped["ResumeTemplate | None"] = relationship(back_populates="applications")


class JobSyncRun(Base):
    __tablename__ = "job_sync_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="running", index=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    inserted_count: Mapped[int] = mapped_column(default=0)
    updated_count: Mapped[int] = mapped_column(default=0)
    total_count: Mapped[int] = mapped_column(default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    source: Mapped["Source"] = relationship(back_populates="sync_runs")
