from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SourceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    name: str
    base_url: str
    is_enabled: bool
    supports_sync: bool
    last_synced_at: datetime | None
    posting_count: int = 0


class SyncRequest(BaseModel):
    start_page: int = Field(default=1, ge=1, le=10000)
    end_page: int = Field(default=1, ge=1, le=10000)
    filters: "RememberSearchFilters | None" = None

    @model_validator(mode="after")
    def validate_page_range(self) -> "SyncRequest":
        if self.end_page < self.start_page:
            raise ValueError("종료 페이지는 시작 페이지보다 크거나 같아야 합니다.")
        return self


class RememberAddressFilter(BaseModel):
    level1: str = Field(min_length=1, max_length=50)
    level2: str | None = Field(default=None, max_length=50)


class RememberIndustryFilter(BaseModel):
    level1: str = Field(min_length=1, max_length=50)
    level2: str | None = Field(default=None, max_length=50)
    level3: str | None = Field(default=None, max_length=50)


class RememberSearchFilters(BaseModel):
    keywords: list[str] | None = None
    min_salary: int | None = Field(default=None, ge=0, le=1000000)
    max_salary: int | None = Field(default=None, ge=0, le=1000000)
    addresses: list[RememberAddressFilter] | None = None
    career_year: int | None = Field(default=None, ge=-1, le=99)
    company_sizes: list[str] | None = None
    industry_v2_names: list[RememberIndustryFilter] | None = None
    leader_position: bool | None = None
    organization_type: Literal["all", "without_headhunter"] | None = None
    application_type: Literal["all", "apply"] | None = None
    include_applied_job_posting: bool | None = None

    @model_validator(mode="after")
    def validate_salary_range(self) -> "RememberSearchFilters":
        if (
            self.min_salary is not None
            and self.max_salary is not None
            and self.max_salary < self.min_salary
        ):
            raise ValueError("최대 연봉은 최소 연봉보다 크거나 같아야 합니다.")
        return self


class SourceCrawlInfoRequest(BaseModel):
    page: int = Field(default=1, ge=1, le=10000)
    filters: RememberSearchFilters | None = None


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
    curation_status: str | None = None
    curation_note: str | None = None
    is_bookmarked: bool | None = None
    is_todo: bool | None = None


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
    ingest_kind: str
    posted_at: date | None
    apply_start_date: date | None
    apply_end_date: date | None
    apply_period_raw: str | None
    normalized_content: str
    tags: list[str]
    curation_status: str
    curation_note: str | None
    is_bookmarked: bool = False
    is_todo: bool = False
    last_seen_at: datetime
    application_id: int | None = None
    application_status: str | None = None


class PostingOverviewOut(BaseModel):
    all: int
    new: int
    interesting: int
    ignored: int
    bookmarked: int
    todo: int


class PaginatedJobPostingOut(BaseModel):
    items: list[JobPostingOut]
    page: int
    page_size: int
    total_count: int
    total_pages: int
    has_prev: bool
    has_next: bool


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
    application_method: str = "simple"
    status: str = "planned"
    note: str = ""
    applied_at: date | None = None


class ManualJobPostingCreate(BaseModel):
    platform_name: str
    company_name: str
    title: str
    detail_url: str | None = None
    external_apply_url: str | None = None
    posted_at: date | None = None
    apply_start_date: date | None = None
    apply_end_date: date | None = None
    apply_period_raw: str | None = None
    normalized_content: str = ""
    tags: list[str] = []
    curation_status: str = "new"
    curation_note: str | None = None
    is_bookmarked: bool = False
    is_todo: bool = False


class ManualApplicationCreate(BaseModel):
    platform_name: str
    company_name: str
    job_title: str
    detail_url: str | None = None
    external_apply_url: str | None = None
    posted_at: date | None = None
    apply_start_date: date | None = None
    apply_end_date: date | None = None
    apply_period_raw: str | None = None
    normalized_content: str = ""
    tags: list[str] = []
    curation_status: str = "interesting"
    curation_note: str | None = None
    is_bookmarked: bool = True
    is_todo: bool = False
    resume_template_id: int
    application_method: str = "simple"
    status: str = "planned"
    note: str = ""
    applied_at: date | None = None


class ApplicationUpdate(BaseModel):
    status: str
    note: str = ""
    applied_at: date | None = None
    resume_template_id: int | None = None
    resume_snapshot_title: str
    resume_snapshot_markdown: str


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_posting_id: int
    job_title: str
    company_name: str
    source_key: str
    source_name: str
    detail_url: str
    external_apply_url: str | None
    resume_template_id: int | None
    resume_template_title: str | None
    application_method: str
    status: str
    note: str
    applied_at: date | None
    apply_end_date_snapshot: date | None
    apply_period_raw_snapshot: str | None
    resume_snapshot_title: str
    resume_snapshot_markdown: str
    posting_normalized_content: str = ""
    posting_tags: list[str] = []
    created_at: datetime
    updated_at: datetime


class CoverLetterItemCreate(BaseModel):
    question: str = ""
    answer_markdown: str = ""
    tags: list[str] = []


class CoverLetterItemUpdate(BaseModel):
    question: str
    answer_markdown: str = ""
    tags: list[str] = []
    order_index: int = Field(default=0, ge=0)


class CoverLetterItemOut(BaseModel):
    id: int
    application_id: int
    question: str
    answer_markdown: str
    order_index: int
    tags: list[str]
    company_name: str
    job_title: str
    created_at: datetime
    updated_at: datetime


class PaginatedCoverLetterItemOut(BaseModel):
    items: list[CoverLetterItemOut]
    page: int
    page_size: int
    total_count: int
    total_pages: int
    has_prev: bool
    has_next: bool


class DashboardOut(BaseModel):
    total_postings: int
    todo_postings: int
    interesting_postings: int
    active_applications: int
    resume_count: int
    sources: list[SourceSummary]
    recent_postings: list[JobPostingOut]
    recent_applications: list[ApplicationOut]
    recent_sync_runs: list[JobSyncRunOut]
