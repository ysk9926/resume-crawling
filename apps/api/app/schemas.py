from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SourceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    name: str
    base_url: str
    is_enabled: bool
    last_synced_at: datetime | None
    posting_count: int = 0


class SyncRequest(BaseModel):
    start_page: int = Field(default=1, ge=1, le=10000)
    end_page: int = Field(default=1, ge=1, le=10000)

    @model_validator(mode="after")
    def validate_page_range(self) -> "SyncRequest":
        if self.end_page < self.start_page:
            raise ValueError("종료 페이지는 시작 페이지보다 크거나 같아야 합니다.")
        return self


class SourceCrawlInfoOut(BaseModel):
    source_key: str
    current_page: int
    total_pages: int
    total_items: int


class JobSyncRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_id: int
    status: str
    message: str | None
    inserted_count: int
    updated_count: int
    total_count: int
    started_at: datetime
    finished_at: datetime | None


class JobPostingUpdate(BaseModel):
    curation_status: str
    curation_note: str = ""


class JobPostingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_key: str
    source_name: str
    external_id: str
    company_name: str
    title: str
    detail_url: str
    external_apply_url: str | None
    posted_at: date | None
    apply_start_date: date | None
    apply_end_date: date | None
    apply_period_raw: str | None
    normalized_content: str
    tags: list[str]
    curation_status: str
    curation_note: str | None
    last_seen_at: datetime
    application_id: int | None = None
    application_status: str | None = None


class ResumeTemplateCreate(BaseModel):
    title: str
    summary: str = ""
    markdown_content: str = ""


class ResumeTemplateUpdate(BaseModel):
    title: str
    summary: str = ""
    markdown_content: str = ""


class ResumeTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    summary: str
    markdown_content: str
    created_at: datetime
    updated_at: datetime


class ApplicationCreate(BaseModel):
    job_posting_id: int
    resume_template_id: int
    status: str = "planned"
    note: str = ""


class ApplicationUpdate(BaseModel):
    status: str
    note: str = ""
    applied_at: date | None = None
    resume_snapshot_title: str
    resume_snapshot_markdown: str


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_posting_id: int
    job_title: str
    company_name: str
    source_key: str
    detail_url: str
    external_apply_url: str | None
    resume_template_id: int | None
    resume_template_title: str | None
    status: str
    note: str
    applied_at: date | None
    resume_snapshot_title: str
    resume_snapshot_markdown: str
    created_at: datetime
    updated_at: datetime


class DashboardOut(BaseModel):
    total_postings: int
    interesting_postings: int
    active_applications: int
    resume_count: int
    sources: list[SourceSummary]
    recent_postings: list[JobPostingOut]
    recent_applications: list[ApplicationOut]
    recent_sync_runs: list[JobSyncRunOut]
