from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(20), default="member", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    sessions: Mapped[list["UserSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    posting_states: Mapped[list["UserPostingState"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    resume_templates: Mapped[list["ResumeTemplate"]] = relationship(back_populates="user")
    applications: Mapped[list["Application"]] = relationship(back_populates="user")
    cover_letter_tags: Mapped[list["CoverLetterTag"]] = relationship(back_populates="user")


class UserSession(Base):
    __tablename__ = "user_sessions"
    __table_args__ = (Index("ix_user_sessions_expires_at", "expires_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    session_token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped["User"] = relationship(back_populates="sessions")


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    base_url: Mapped[str] = mapped_column(Text)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    supports_sync: Mapped[bool] = mapped_column(Boolean, default=True)
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
    __table_args__ = (
        UniqueConstraint("source_id", "external_id", name="uq_job_source_external_id"),
        Index("ix_job_postings_posted_created", "posted_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"), index=True)
    external_id: Mapped[str] = mapped_column(String(80), index=True)
    company_name: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(300))
    detail_url: Mapped[str] = mapped_column(Text)
    external_apply_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    ingest_kind: Mapped[str] = mapped_column(String(20), default="crawl", index=True)
    posted_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    apply_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    apply_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    apply_period_raw: Mapped[str | None] = mapped_column(String(80), nullable=True)
    raw_content: Mapped[str] = mapped_column(Text)
    normalized_content: Mapped[str] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    curation_status: Mapped[str] = mapped_column(String(30), default="new")
    curation_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_bookmarked: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_todo: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    source: Mapped["Source"] = relationship(back_populates="job_postings")
    posting_states: Mapped[list["UserPostingState"]] = relationship(
        back_populates="job_posting",
        cascade="all, delete-orphan",
    )
    applications: Mapped[list["Application"]] = relationship(
        back_populates="job_posting",
        cascade="all, delete-orphan",
    )


class UserPostingState(Base):
    __tablename__ = "user_posting_states"
    __table_args__ = (
        UniqueConstraint("user_id", "job_posting_id", name="uq_user_posting_state_user_posting"),
        Index("ix_user_posting_states_curation_status", "curation_status"),
        Index("ix_user_posting_states_bookmarked", "is_bookmarked"),
        Index("ix_user_posting_states_todo", "is_todo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    job_posting_id: Mapped[int] = mapped_column(ForeignKey("job_postings.id"), index=True)
    curation_status: Mapped[str] = mapped_column(String(30), default="new")
    curation_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_bookmarked: Mapped[bool] = mapped_column(Boolean, default=False)
    is_todo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="posting_states")
    job_posting: Mapped["JobPosting"] = relationship(back_populates="posting_states")


class ResumeTemplate(Base):
    __tablename__ = "resume_templates"
    __table_args__ = (Index("ix_resume_templates_updated_at", "updated_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(160))
    summary: Mapped[str] = mapped_column(Text, default="")
    markdown_content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user: Mapped["User | None"] = relationship(back_populates="resume_templates")
    applications: Mapped[list["Application"]] = relationship(back_populates="resume_template")


cover_letter_item_tags = Table(
    "cover_letter_item_tags",
    Base.metadata,
    Column("cover_letter_item_id", ForeignKey("cover_letter_items.id"), primary_key=True),
    Column("cover_letter_tag_id", ForeignKey("cover_letter_tags.id"), primary_key=True),
)


class CoverLetterTag(Base):
    __tablename__ = "cover_letter_tags"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_cover_letter_tags_user_name"),
        Index("ix_cover_letter_tags_user_name", "user_id", "name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    label: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped["User | None"] = relationship(back_populates="cover_letter_tags")
    items: Mapped[list["CoverLetterItem"]] = relationship(
        secondary=cover_letter_item_tags,
        back_populates="tags",
    )


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        Index("ix_applications_updated_at", "updated_at"),
        Index("ix_applications_application_method", "application_method"),
        UniqueConstraint("user_id", "job_posting_id", name="uq_applications_user_posting"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    job_posting_id: Mapped[int] = mapped_column(ForeignKey("job_postings.id"), index=True)
    resume_template_id: Mapped[int | None] = mapped_column(ForeignKey("resume_templates.id"), nullable=True)
    application_method: Mapped[str] = mapped_column(String(30), default="simple")
    status: Mapped[str] = mapped_column(String(30), default="planned", index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    applied_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    apply_end_date_snapshot: Mapped[date | None] = mapped_column(Date, nullable=True)
    apply_period_raw_snapshot: Mapped[str | None] = mapped_column(String(80), nullable=True)
    resume_snapshot_title: Mapped[str] = mapped_column(String(200))
    resume_snapshot_markdown: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user: Mapped["User | None"] = relationship(back_populates="applications")
    job_posting: Mapped["JobPosting"] = relationship(back_populates="applications")
    resume_template: Mapped["ResumeTemplate | None"] = relationship(back_populates="applications")
    cover_letter_items: Mapped[list["CoverLetterItem"]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
        order_by=lambda: (CoverLetterItem.order_index, CoverLetterItem.id),
    )


class CoverLetterItem(Base):
    __tablename__ = "cover_letter_items"
    __table_args__ = (
        Index("ix_cover_letter_items_application_order", "application_id", "order_index"),
        Index("ix_cover_letter_items_updated_at", "updated_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    question: Mapped[str] = mapped_column(Text, default="")
    answer_markdown: Mapped[str] = mapped_column(Text, default="")
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    application: Mapped["Application"] = relationship(back_populates="cover_letter_items")
    tags: Mapped[list["CoverLetterTag"]] = relationship(
        secondary=cover_letter_item_tags,
        back_populates="items",
    )


class JobSyncRun(Base):
    __tablename__ = "job_sync_runs"
    __table_args__ = (Index("ix_job_sync_runs_started_at", "started_at"),)

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
