import type {
  Application,
  AuthSession,
  CalendarMonth,
  CoverLetterItem,
  CoverLetterItemPage,
  Dashboard,
  JobPostingPage,
  JobPosting,
  PostingOverview,
  RememberSearchFilters,
  ResumeTemplate,
  SourceCrawlInfo,
  SourceSummary,
  SyncRun,
  Viewer,
} from "@/lib/types";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "@/lib/session";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:3335";
const CACHE_TAGS = {
  dashboard: "dashboard",
  postings: "postings",
  sources: "sources",
  resumes: "resumes",
  applications: "applications",
  coverLetter: "cover-letter",
  sourceCrawlInfo: "source-crawl-info",
} as const;

type RequestOptions = RequestInit & {
  bodyJson?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { bodyJson, headers, ...init } = options;
  const method = (init.method ?? "GET").toUpperCase();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: method === "GET" ? (init.cache ?? "no-store") : "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { "X-Session-Token": sessionToken } : {}),
      ...headers,
    },
    body: bodyJson === undefined ? init.body : JSON.stringify(bodyJson),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `API request failed for ${path}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getViewer(): Promise<Viewer> {
  return request<Viewer>("/api/auth/me", {
    cache: "no-store",
  });
}

export async function signupWithCredentials(payload: {
  username: string;
  password: string;
}) {
  return request<AuthSession>("/api/auth/signup", {
    method: "POST",
    bodyJson: payload,
  });
}

export async function loginWithCredentials(payload: {
  username: string;
  password: string;
}) {
  return request<AuthSession>("/api/auth/login", {
    method: "POST",
    bodyJson: payload,
  });
}

export async function logoutFromApi() {
  await request<void>("/api/auth/logout", {
    method: "POST",
  });
}

export async function getDashboard(): Promise<Dashboard> {
  return request<Dashboard>("/api/dashboard", {
    cache: "no-store",
  });
}

export async function getSources(): Promise<SourceSummary[]> {
  return request<SourceSummary[]>("/api/sources", {
    cache: "no-store",
  });
}

type PostingPageFilters = {
  q?: string;
  source_key?: string;
  page?: number;
  page_size?: number;
};

function buildSearchSuffix(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }
    search.set(key, String(value));
  }
  return search.size > 0 ? `?${search.toString()}` : "";
}

async function getPostingPage(path: string, filters?: PostingPageFilters): Promise<JobPostingPage> {
  const suffix = buildSearchSuffix({
    q: filters?.q,
    source_key: filters?.source_key,
    page: filters?.page,
    page_size: filters?.page_size,
  });
  return request<JobPostingPage>(`${path}${suffix}`, {
    cache: "no-store",
  });
}

export async function getPostingOverview(filters?: {
  q?: string;
  source_key?: string;
}): Promise<PostingOverview> {
  const suffix = buildSearchSuffix({
    q: filters?.q,
    source_key: filters?.source_key,
  });
  return request<PostingOverview>(`/api/postings/overview${suffix}`, {
    cache: "no-store",
  });
}

export async function getPostings(filters?: {
  q?: string;
  curation_status?: string;
  source_key?: string;
  bookmarked?: boolean;
  todo?: boolean;
}): Promise<JobPosting[]> {
  const suffix = buildSearchSuffix({
    q: filters?.q,
    curation_status: filters?.curation_status,
    source_key: filters?.source_key,
    bookmarked:
      filters?.bookmarked !== undefined ? (filters.bookmarked ? "true" : "false") : undefined,
    todo: filters?.todo !== undefined ? (filters.todo ? "true" : "false") : undefined,
  });
  return request<JobPosting[]>(`/api/postings${suffix}`, {
    cache: "no-store",
  });
}

export async function getAllPostingsPage(filters?: PostingPageFilters): Promise<JobPostingPage> {
  return getPostingPage("/api/postings/all", filters);
}

export async function getNewPostingsPage(filters?: PostingPageFilters): Promise<JobPostingPage> {
  return getPostingPage("/api/postings/new", filters);
}

export async function getInterestingPostingsPage(filters?: PostingPageFilters): Promise<JobPostingPage> {
  return getPostingPage("/api/postings/interesting", filters);
}

export async function getIgnoredPostingsPage(filters?: PostingPageFilters): Promise<JobPostingPage> {
  return getPostingPage("/api/postings/ignored", filters);
}

export async function getBookmarkedPostingsPage(filters?: PostingPageFilters): Promise<JobPostingPage> {
  return getPostingPage("/api/postings/bookmarked", filters);
}

export async function getTodoPostingsPage(filters?: PostingPageFilters): Promise<JobPostingPage> {
  return getPostingPage("/api/postings/todo", filters);
}

export async function getResumes(): Promise<ResumeTemplate[]> {
  return request<ResumeTemplate[]>("/api/resumes", {
    cache: "no-store",
  });
}

export async function getApplications(): Promise<Application[]> {
  return request<Application[]>("/api/applications", {
    cache: "no-store",
  });
}

export async function getCalendarMonth(month: string): Promise<CalendarMonth> {
  const suffix = buildSearchSuffix({ month });
  return request<CalendarMonth>(`/api/calendar${suffix}`, {
    cache: "no-store",
  });
}

export async function getApplication(applicationId: number): Promise<Application> {
  return request<Application>(`/api/applications/${applicationId}`, {
    cache: "no-store",
  });
}

export async function getApplicationCoverLetterItems(applicationId: number): Promise<CoverLetterItem[]> {
  return request<CoverLetterItem[]>(`/api/applications/${applicationId}/cover-letter-items`, {
    cache: "no-store",
  });
}

export async function getCoverLetterLibraryPage(filters?: {
  tag?: string;
  page?: number;
  page_size?: number;
}): Promise<CoverLetterItemPage> {
  const suffix = buildSearchSuffix({
    tag: filters?.tag,
    page: filters?.page,
    page_size: filters?.page_size,
  });
  return request<CoverLetterItemPage>(`/api/applications/cover-letter-library${suffix}`, {
    cache: "no-store",
  });
}

export async function getSourceSyncRuns(
  sourceKey: string,
  limit: number = 20,
): Promise<SyncRun[]> {
  const suffix = buildSearchSuffix({ limit });
  return request<SyncRun[]>(`/api/sources/${sourceKey}/sync-runs${suffix}`, {
    cache: "no-store",
  });
}

export async function getSourceCrawlInfo(sourceKey: string): Promise<SourceCrawlInfo> {
  return request<SourceCrawlInfo>(`/api/sources/${sourceKey}/crawl-info`, {
    cache: "no-store",
  });
}

export { CACHE_TAGS };

export async function postSourceCrawlInfo(
  sourceKey: string,
  filters?: RememberSearchFilters,
): Promise<SourceCrawlInfo> {
  return request<SourceCrawlInfo>(`/api/sources/${sourceKey}/crawl-info`, {
    method: "POST",
    bodyJson: { page: 1, filters },
  });
}

export async function postSyncSource(
  sourceKey: string,
  startPage: number,
  endPage: number,
  filters?: RememberSearchFilters,
): Promise<SyncRun> {
  return request<SyncRun>(`/api/sources/${sourceKey}/sync`, {
    method: "POST",
    bodyJson: { start_page: startPage, end_page: endPage, filters },
  });
}

export async function patchPosting(
  postingId: number,
  payload: {
    curation_status?: string;
    curation_note?: string;
    is_bookmarked?: boolean;
    is_todo?: boolean;
  },
) {
  return request<JobPosting>(`/api/postings/${postingId}`, {
    method: "PATCH",
    bodyJson: payload,
  });
}

export async function createResume(payload: {
  title: string;
  summary: string;
  markdown_content: string;
}) {
  return request<ResumeTemplate>("/api/resumes", {
    method: "POST",
    bodyJson: payload,
  });
}

export async function patchResume(
  resumeId: number,
  payload: {
    title: string;
    summary: string;
    markdown_content: string;
  },
) {
  return request<ResumeTemplate>(`/api/resumes/${resumeId}`, {
    method: "PATCH",
    bodyJson: payload,
  });
}

export async function createApplication(payload: {
  job_posting_id: number;
  resume_template_id: number;
  application_method: string;
  status: string;
  note: string;
  applied_at?: string | null;
}) {
  return request<Application>("/api/applications", {
    method: "POST",
    bodyJson: payload,
  });
}

export async function createManualPosting(payload: {
  platform_name: string;
  company_name: string;
  title: string;
  detail_url?: string | null;
  external_apply_url?: string | null;
  posted_at?: string | null;
  apply_start_date?: string | null;
  apply_end_date?: string | null;
  apply_period_raw?: string | null;
  normalized_content: string;
  tags: string[];
  curation_status: string;
  curation_note?: string | null;
  is_bookmarked: boolean;
  is_todo: boolean;
}) {
  return request<JobPosting>("/api/postings/manual", {
    method: "POST",
    bodyJson: payload,
  });
}

export async function createManualApplication(payload: {
  platform_name: string;
  company_name: string;
  job_title: string;
  detail_url?: string | null;
  external_apply_url?: string | null;
  posted_at?: string | null;
  apply_start_date?: string | null;
  apply_end_date?: string | null;
  apply_period_raw?: string | null;
  normalized_content: string;
  tags: string[];
  curation_status: string;
  curation_note?: string | null;
  is_bookmarked: boolean;
  is_todo: boolean;
  resume_template_id: number;
  application_method: string;
  status: string;
  note: string;
  applied_at?: string | null;
}) {
  return request<Application>("/api/applications/manual", {
    method: "POST",
    bodyJson: payload,
  });
}

export async function patchApplication(
  applicationId: number,
  payload: {
    status: string;
    note: string;
    applied_at: string | null;
    resume_template_id: number | null;
    resume_snapshot_title: string;
    resume_snapshot_markdown: string;
  },
) {
  return request<Application>(`/api/applications/${applicationId}`, {
    method: "PATCH",
    bodyJson: payload,
  });
}

export async function postCoverLetterItem(
  applicationId: number,
  payload: {
    question: string;
    answer_markdown: string;
    tags: string[];
  },
) {
  return request<CoverLetterItem>(`/api/applications/${applicationId}/cover-letter-items`, {
    method: "POST",
    bodyJson: payload,
  });
}

export async function patchCoverLetterItem(
  itemId: number,
  payload: {
    question: string;
    answer_markdown: string;
    tags: string[];
    order_index: number;
  },
) {
  return request<CoverLetterItem>(`/api/applications/cover-letter-items/${itemId}`, {
    method: "PATCH",
    bodyJson: payload,
  });
}

export async function deleteCoverLetterItem(itemId: number) {
  await request<void>(`/api/applications/cover-letter-items/${itemId}`, {
    method: "DELETE",
  });
}
