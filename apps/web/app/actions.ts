"use server";

import { revalidatePath } from "next/cache";

import {
  createApplication,
  createResume,
  getSourceCrawlInfo,
  patchApplication,
  patchPosting,
  patchResume,
  postSyncSource,
} from "@/lib/api";

function parseRequiredNumber(value: FormDataEntryValue | null, fieldName: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${fieldName}`);
  }
  return parsed;
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/postings");
  revalidatePath("/resumes");
  revalidatePath("/applications");
}

export async function syncSourceAction(formData: FormData) {
  const sourceKey = String(formData.get("sourceKey") ?? "");
  const startPage = parseRequiredNumber(formData.get("startPage"), "startPage");
  const endPage = parseRequiredNumber(formData.get("endPage"), "endPage");
  await postSyncSource(sourceKey, startPage, endPage);
  revalidateAll();
}

export async function fetchSourceCrawlInfoAction(sourceKey: string) {
  return getSourceCrawlInfo(sourceKey);
}

export async function syncSourceRangeAction(input: {
  sourceKey: string;
  startPage: number;
  endPage: number;
}) {
  const syncRun = await postSyncSource(input.sourceKey, input.startPage, input.endPage);
  revalidateAll();
  return syncRun;
}

export async function updatePostingCurationAction(formData: FormData) {
  const postingId = parseRequiredNumber(formData.get("postingId"), "postingId");
  const curationStatus = String(formData.get("curationStatus") ?? "new");
  const curationNote = String(formData.get("curationNote") ?? "");
  await patchPosting(postingId, {
    curation_status: curationStatus,
    curation_note: curationNote,
  });
  revalidateAll();
}

export async function createResumeAction(formData: FormData) {
  await createResume({
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    markdown_content: String(formData.get("markdownContent") ?? ""),
  });
  revalidateAll();
}

export async function updateResumeAction(formData: FormData) {
  const resumeId = parseRequiredNumber(formData.get("resumeId"), "resumeId");
  await patchResume(resumeId, {
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    markdown_content: String(formData.get("markdownContent") ?? ""),
  });
  revalidateAll();
}

export async function createApplicationAction(formData: FormData) {
  const jobPostingId = parseRequiredNumber(formData.get("jobPostingId"), "jobPostingId");
  const resumeTemplateId = parseRequiredNumber(formData.get("resumeTemplateId"), "resumeTemplateId");
  await createApplication({
    job_posting_id: jobPostingId,
    resume_template_id: resumeTemplateId,
    status: String(formData.get("status") ?? "planned"),
    note: String(formData.get("note") ?? ""),
  });
  revalidateAll();
}

export async function updateApplicationAction(formData: FormData) {
  const applicationId = parseRequiredNumber(formData.get("applicationId"), "applicationId");
  const appliedAt = String(formData.get("appliedAt") ?? "").trim();
  await patchApplication(applicationId, {
    status: String(formData.get("status") ?? "planned"),
    note: String(formData.get("note") ?? ""),
    applied_at: appliedAt || null,
    resume_snapshot_title: String(formData.get("resumeSnapshotTitle") ?? ""),
    resume_snapshot_markdown: String(formData.get("resumeSnapshotMarkdown") ?? ""),
  });
  revalidateAll();
}
