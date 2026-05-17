import type {
  Application,
  Dashboard,
  JobPosting,
  ResumeTemplate,
  SourceSummary,
  SyncRun,
} from "@/lib/types";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";

type RequestOptions = RequestInit & {
  bodyJson?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { bodyJson, headers, ...init } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
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
  return request<Dashboard>("/api/dashboard");
}

export async function getSources(): Promise<SourceSummary[]> {
  return request<SourceSummary[]>("/api/sources");
}

export async function getPostings(filters?: {
  q?: string;
  curation_status?: string;
  source_key?: string;
}): Promise<JobPosting[]> {
  const search = new URLSearchParams();
  if (filters?.q) search.set("q", filters.q);
  if (filters?.curation_status) search.set("curation_status", filters.curation_status);
  if (filters?.source_key) search.set("source_key", filters.source_key);
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return request<JobPosting[]>(`/api/postings${suffix}`);
}

export async function getResumes(): Promise<ResumeTemplate[]> {
  return request<ResumeTemplate[]>("/api/resumes");
}

export async function getApplications(): Promise<Application[]> {
  return request<Application[]>("/api/applications");
}

export async function postSyncSource(sourceKey: string, pageLimit: number): Promise<SyncRun> {
  return request<SyncRun>(`/api/sources/${sourceKey}/sync`, {
    method: "POST",
    bodyJson: { page_limit: pageLimit },
  });
}

export async function patchPosting(postingId: number, payload: { curation_status: string; curation_note: string }) {
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
