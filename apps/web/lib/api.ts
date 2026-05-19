import type {
  Application,
  Dashboard,
  JobPostingPage,
  JobPosting,
  PostingOverview,
  ResumeTemplate,
  SourceCrawlInfo,
  SourceSummary,
  SyncRun,
} from "@/lib/types";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:3335";
const CACHE_TAGS = {
  dashboard: "dashboard",
  postings: "postings",
  sources: "sources",
  resumes: "resumes",
  applications: "applications",
  sourceCrawlInfo: "source-crawl-info",
} as const;

type RequestOptions = RequestInit & {
  bodyJson?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { bodyJson, headers, ...init } = options;
  const method = (init.method ?? "GET").toUpperCase();
  const isReadRequest = method === "GET";
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: isReadRequest ? (init.cache ?? "force-cache") : "no-store",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: bodyJson === undefined ? init.body : JSON.stringify(bodyJson),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `API request failed for ${path}`);
  }

  return (await response.json()) as T;
}

export async function getDashboard(): Promise<Dashboard> {
  return request<Dashboard>("/api/dashboard", {
    next: {
      revalidate: 30,
      tags: [CACHE_TAGS.dashboard],
    },
  });
}

export async function getSources(): Promise<SourceSummary[]> {
  return request<SourceSummary[]>("/api/sources", {
    next: {
      revalidate: 60,
      tags: [CACHE_TAGS.sources],
    },
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
    next: {
      revalidate: 30,
      tags: [CACHE_TAGS.postings],
    },
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
    next: {
      revalidate: 30,
      tags: [CACHE_TAGS.postings],
    },
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
    next: {
      revalidate: 30,
      tags: [CACHE_TAGS.postings],
    },
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
    next: {
      revalidate: 60,
      tags: [CACHE_TAGS.resumes],
    },
  });
}

export async function getApplications(): Promise<Application[]> {
  return request<Application[]>("/api/applications", {
    next: {
      revalidate: 30,
      tags: [CACHE_TAGS.applications],
    },
  });
}

export async function getSourceCrawlInfo(sourceKey: string): Promise<SourceCrawlInfo> {
  return request<SourceCrawlInfo>(`/api/sources/${sourceKey}/crawl-info`, {
    next: {
      revalidate: 15,
      tags: [CACHE_TAGS.sourceCrawlInfo, `${CACHE_TAGS.sourceCrawlInfo}:${sourceKey}`],
    },
  });
}

export { CACHE_TAGS };

export async function postSyncSource(sourceKey: string, startPage: number, endPage: number): Promise<SyncRun> {
  return request<SyncRun>(`/api/sources/${sourceKey}/sync`, {
    method: "POST",
    bodyJson: { start_page: startPage, end_page: endPage },
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
  status: string;
  note: string;
}) {
  return request<Application>("/api/applications", {
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
    resume_snapshot_title: string;
    resume_snapshot_markdown: string;
  },
) {
  return request<Application>(`/api/applications/${applicationId}`, {
    method: "PATCH",
    bodyJson: payload,
  });
}
