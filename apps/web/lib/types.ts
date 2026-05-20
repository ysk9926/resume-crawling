export type SourceSummary = {
  id: number;
  key: string;
  name: string;
  base_url: string;
  is_enabled: boolean;
  supports_sync: boolean;
  last_synced_at: string | null;
  posting_count: number;
};

export type Viewer = {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

export type AuthSession = {
  session_token: string;
  user: Viewer;
};

export type SyncRun = {
  id: number;
  source_id: number;
  status: string;
  message: string | null;
  inserted_count: number;
  updated_count: number;
  total_count: number;
  started_at: string;
  finished_at: string | null;
};

export type SourceCrawlInfo = {
  source_key: string;
  current_page: number;
  total_pages: number;
  total_items: number;
};

export type RememberAddressFilter = {
  level1: string;
  level2?: string | null;
};

export type RememberIndustryFilter = {
  level1: string;
  level2?: string | null;
  level3?: string | null;
};

export type RememberSearchFilters = {
  keywords?: string[];
  min_salary?: number;
  max_salary?: number;
  addresses?: RememberAddressFilter[];
  career_year?: number;
  company_sizes?: string[];
  industry_v2_names?: RememberIndustryFilter[];
  leader_position?: boolean;
  organization_type?: "all" | "without_headhunter";
  application_type?: "all" | "apply";
  include_applied_job_posting?: boolean;
};

export type JobPosting = {
  id: number;
  source_key: string;
  source_name: string;
  external_id: string;
  company_name: string;
  title: string;
  detail_url: string;
  external_apply_url: string | null;
  ingest_kind: string;
  posted_at: string | null;
  apply_start_date: string | null;
  apply_end_date: string | null;
  apply_period_raw: string | null;
  normalized_content: string;
  tags: string[];
  curation_status: string;
  curation_note: string | null;
  is_bookmarked: boolean;
  is_todo: boolean;
  last_seen_at: string;
  application_id: number | null;
  application_status: string | null;
};

export type PostingTabKey =
  | "all"
  | "new"
  | "interesting"
  | "ignored"
  | "bookmarked"
  | "todo";

export type PostingOverview = {
  all: number;
  new: number;
  interesting: number;
  ignored: number;
  bookmarked: number;
  todo: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
  has_prev: boolean;
  has_next: boolean;
};

export type JobPostingPage = PaginatedResponse<JobPosting>;

export type CalendarLayerKey =
  | "posting_deadline"
  | "posting_bookmark"
  | "posting_todo"
  | "application_planned"
  | "application_applied";

export type CalendarEventKind = "posting" | "application";

export type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  layer_keys: CalendarLayerKey[];
  date: string;
  title: string;
  company_name: string;
  source_label: string;
  status_label: string;
  href: string;
  detail_url: string | null;
  external_apply_url: string | null;
  badges: string[];
};

export type CalendarMonth = {
  month: string;
  month_start: string;
  month_end: string;
  events: CalendarEvent[];
};

export type ResumeTemplate = {
  id: number;
  title: string;
  summary: string;
  markdown_content: string;
  created_at: string;
  updated_at: string;
};

export type Application = {
  id: number;
  job_posting_id: number;
  job_title: string;
  company_name: string;
  source_key: string;
  source_name: string;
  detail_url: string;
  external_apply_url: string | null;
  resume_template_id: number | null;
  resume_template_title: string | null;
  application_method: string;
  status: string;
  note: string;
  applied_at: string | null;
  apply_end_date_snapshot: string | null;
  apply_period_raw_snapshot: string | null;
  resume_snapshot_title: string;
  resume_snapshot_markdown: string;
  posting_normalized_content: string;
  posting_tags: string[];
  created_at: string;
  updated_at: string;
};

export type CoverLetterItem = {
  id: number;
  application_id: number;
  question: string;
  answer_markdown: string;
  order_index: number;
  tags: string[];
  company_name: string;
  job_title: string;
  created_at: string;
  updated_at: string;
};

export type CoverLetterItemPage = PaginatedResponse<CoverLetterItem>;

export type Dashboard = {
  total_postings: number;
  todo_postings: number;
  interesting_postings: number;
  active_applications: number;
  resume_count: number;
  sources: SourceSummary[];
  recent_postings: JobPosting[];
  recent_applications: Application[];
  recent_sync_runs: SyncRun[];
};
