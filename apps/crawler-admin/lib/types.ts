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

export type JobKoreaFilterOption = {
  code: string;
  label: string;
  children?: JobKoreaFilterOption[];
};

export type JobKoreaFilterOptions = {
  duties: JobKoreaFilterOption[];
  locals: JobKoreaFilterOption[];
  careers: JobKoreaFilterOption[];
  educations: JobKoreaFilterOption[];
  company_types: JobKoreaFilterOption[];
  job_types: JobKoreaFilterOption[];
  industries: JobKoreaFilterOption[];
  positions: JobKoreaFilterOption[];
  salary_ranges: JobKoreaFilterOption[];
  salary_types: JobKoreaFilterOption[];
  majors: JobKoreaFilterOption[];
  licenses: JobKoreaFilterOption[];
  preferences: JobKoreaFilterOption[];
  welfare: JobKoreaFilterOption[];
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

export type JobKoreaSearchFilters = {
  duties?: string[];
  duty_keywords?: string[];
  locals?: string[];
  career_codes?: string[];
  career_start?: number;
  career_end?: number;
  education_codes?: string[];
  company_type_codes?: string[];
  job_type_codes?: string[];
  industry_codes?: string[];
  industry_keywords?: string[];
  position_codes?: string[];
  salary_codes?: string[];
  salary_type?: string;
  salary_input?: number;
  major_codes?: string[];
  license_codes?: string[];
  preference_codes?: string[];
  welfare_codes?: string[];
  include_keywords?: string[];
  exclude_keywords?: string[];
  direct_apply_only?: boolean;
  exclude_confirmed_postings?: boolean;
};

export type SourceSearchFilters = RememberSearchFilters | JobKoreaSearchFilters;

export type SourceFilterOptions = JobKoreaFilterOptions;

export type AdminStats = {
  activeSources: number;
  lastSyncedAt: string | null;
  syncCapableSources: number;
  totalPostings: number;
};
