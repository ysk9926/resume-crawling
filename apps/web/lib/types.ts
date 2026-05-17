export type SourceSummary = {
  id: number;
  key: string;
  name: string;
  base_url: string;
  is_enabled: boolean;
  last_synced_at: string | null;
  posting_count: number;
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

export type JobPosting = {
  id: number;
  source_key: string;
  source_name: string;
  external_id: string;
  company_name: string;
  title: string;
  detail_url: string;
  external_apply_url: string | null;
  posted_at: string | null;
  apply_start_date: string | null;
  apply_end_date: string | null;
  apply_period_raw: string | null;
  normalized_content: string;
  tags: string[];
  curation_status: string;
  curation_note: string | null;
  last_seen_at: string;
  application_id: number | null;
  application_status: string | null;
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
  detail_url: string;
  external_apply_url: string | null;
  resume_template_id: number | null;
  resume_template_title: string | null;
  status: string;
  note: string;
  applied_at: string | null;
  resume_snapshot_title: string;
  resume_snapshot_markdown: string;
  created_at: string;
  updated_at: string;
};

export type Dashboard = {
  total_postings: number;
  interesting_postings: number;
  active_applications: number;
  resume_count: number;
  sources: SourceSummary[];
  recent_postings: JobPosting[];
  recent_applications: Application[];
  recent_sync_runs: SyncRun[];
};
