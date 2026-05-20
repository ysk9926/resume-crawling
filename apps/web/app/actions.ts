"use server";

import { cookies } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import {
  CACHE_TAGS,
  createApplication,
  createManualApplication,
  createManualPosting,
  createResume,
  deleteCoverLetterItem,
  patchCoverLetterItem,
  patchApplication,
  patchPosting,
  patchResume,
  postSourceCrawlInfo,
  postCoverLetterItem,
  postSyncSource,
  loginWithCredentials,
  signupWithCredentials,
} from "@/lib/api";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import type { RememberSearchFilters } from "@/lib/types";

function parseRequiredNumber(value: FormDataEntryValue | null, fieldName: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${fieldName}`);
  }
  return parsed;
}

function parseTagList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseOptionalText(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function parseCheckbox(value: FormDataEntryValue | null) {
  return value === "on";
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/postings");
  revalidatePath("/resumes");
  revalidatePath("/applications");
}

function updateTags(tags: string[]) {
  for (const tag of tags) {
    updateTag(tag);
  }
}

async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

function buildAuthRedirect(pathname: string, message: string) {
  const search = new URLSearchParams({ error: message });
  return `${pathname}?${search.toString()}`;
}

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    const session = await loginWithCredentials({ username, password });
    await setSessionCookie(session.session_token);
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "로그인에 실패했습니다.";
    redirect(buildAuthRedirect("/login", message));
  }

  redirect("/calendar");
}

export async function signupAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password !== confirmPassword) {
    redirect(buildAuthRedirect("/signup", "비밀번호 확인이 일치하지 않습니다."));
  }

  try {
    const session = await signupWithCredentials({ username, password });
    await setSessionCookie(session.session_token);
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "회원가입에 실패했습니다.";
    redirect(buildAuthRedirect("/signup", message));
  }

  redirect("/calendar");
}

export async function syncSourceAction(formData: FormData) {
  const sourceKey = String(formData.get("sourceKey") ?? "");
  const startPage = parseRequiredNumber(formData.get("startPage"), "startPage");
  const endPage = parseRequiredNumber(formData.get("endPage"), "endPage");
  await postSyncSource(sourceKey, startPage, endPage);
  updateTags([
    CACHE_TAGS.dashboard,
    CACHE_TAGS.sources,
    CACHE_TAGS.postings,
    CACHE_TAGS.applications,
    CACHE_TAGS.sourceCrawlInfo,
    `${CACHE_TAGS.sourceCrawlInfo}:${sourceKey}`,
  ]);
  revalidateAll();
}

export async function fetchSourceCrawlInfoAction(sourceKey: string) {
  return postSourceCrawlInfo(sourceKey);
}

export async function syncSourceRangeAction(input: {
  sourceKey: string;
  startPage: number;
  endPage: number;
  filters?: RememberSearchFilters;
}) {
  const syncRun = await postSyncSource(
    input.sourceKey,
    input.startPage,
    input.endPage,
    input.filters,
  );
  updateTags([
    CACHE_TAGS.dashboard,
    CACHE_TAGS.sources,
    CACHE_TAGS.postings,
    CACHE_TAGS.applications,
    CACHE_TAGS.sourceCrawlInfo,
    `${CACHE_TAGS.sourceCrawlInfo}:${input.sourceKey}`,
  ]);
  revalidateAll();
  return syncRun;
}

export async function fetchFilteredSourceCrawlInfoAction(input: {
  sourceKey: string;
  filters?: RememberSearchFilters;
}) {
  return postSourceCrawlInfo(input.sourceKey, input.filters);
}

export async function updatePostingCurationAction(formData: FormData) {
  const postingId = parseRequiredNumber(formData.get("postingId"), "postingId");
  const curationStatus = String(formData.get("curationStatus") ?? "new");
  const curationNote = String(formData.get("curationNote") ?? "");
  await patchPosting(postingId, {
    curation_status: curationStatus,
    curation_note: curationNote,
  });
  updateTags([CACHE_TAGS.dashboard, CACHE_TAGS.postings]);
  revalidateAll();
}

export async function togglePostingBookmarkAction(formData: FormData) {
  const postingId = parseRequiredNumber(formData.get("postingId"), "postingId");
  const next = String(formData.get("nextBookmarked") ?? "1") === "1";
  await patchPosting(postingId, { is_bookmarked: next });
  updateTags([CACHE_TAGS.dashboard, CACHE_TAGS.postings]);
  revalidateAll();
}

export async function togglePostingTodoAction(formData: FormData) {
  const postingId = parseRequiredNumber(formData.get("postingId"), "postingId");
  const next = String(formData.get("nextTodo") ?? "1") === "1";
  await patchPosting(postingId, { is_todo: next });
  updateTags([CACHE_TAGS.dashboard, CACHE_TAGS.postings]);
  revalidateAll();
}

export async function createResumeAction(formData: FormData) {
  await createResume({
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    markdown_content: String(formData.get("markdownContent") ?? ""),
  });
  updateTags([CACHE_TAGS.dashboard, CACHE_TAGS.resumes, CACHE_TAGS.applications]);
  revalidateAll();
}

export async function updateResumeAction(formData: FormData) {
  const resumeId = parseRequiredNumber(formData.get("resumeId"), "resumeId");
  await patchResume(resumeId, {
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    markdown_content: String(formData.get("markdownContent") ?? ""),
  });
  updateTags([CACHE_TAGS.dashboard, CACHE_TAGS.resumes, CACHE_TAGS.applications]);
  revalidateAll();
}

export async function createApplicationAction(formData: FormData) {
  const jobPostingId = parseRequiredNumber(formData.get("jobPostingId"), "jobPostingId");
  const resumeTemplateId = parseRequiredNumber(formData.get("resumeTemplateId"), "resumeTemplateId");
  const application = await createApplication({
    job_posting_id: jobPostingId,
    resume_template_id: resumeTemplateId,
    application_method: String(formData.get("applicationMethod") ?? "simple"),
    status: String(formData.get("status") ?? "planned"),
    note: String(formData.get("note") ?? ""),
    applied_at: parseOptionalText(formData.get("appliedAt")),
  });
  updateTags([
    CACHE_TAGS.dashboard,
    CACHE_TAGS.postings,
    CACHE_TAGS.applications,
    CACHE_TAGS.coverLetter,
  ]);
  revalidateAll();
  revalidatePath(`/applications/${application.id}`);
  if (application.application_method === "cover_letter") {
    redirect(`/applications/${application.id}`);
  }
}

export async function createManualPostingAction(formData: FormData) {
  await createManualPosting({
    platform_name: String(formData.get("platformName") ?? ""),
    company_name: String(formData.get("companyName") ?? ""),
    title: String(formData.get("jobTitle") ?? ""),
    detail_url: parseOptionalText(formData.get("detailUrl")),
    external_apply_url: parseOptionalText(formData.get("externalApplyUrl")),
    posted_at: parseOptionalText(formData.get("postedAt")),
    apply_start_date: parseOptionalText(formData.get("applyStartDate")),
    apply_end_date: parseOptionalText(formData.get("applyEndDate")),
    apply_period_raw: parseOptionalText(formData.get("applyPeriodRaw")),
    normalized_content: String(formData.get("normalizedContent") ?? ""),
    tags: parseTagList(formData.get("tags")),
    curation_status: String(formData.get("curationStatus") ?? "new"),
    curation_note: parseOptionalText(formData.get("curationNote")),
    is_bookmarked: parseCheckbox(formData.get("isBookmarked")),
    is_todo: parseCheckbox(formData.get("isTodo")),
  });
  updateTags([CACHE_TAGS.dashboard, CACHE_TAGS.sources, CACHE_TAGS.postings]);
  revalidateAll();
  redirect("/postings");
}

export async function createManualApplicationAction(formData: FormData) {
  const application = await createManualApplication({
    platform_name: String(formData.get("platformName") ?? ""),
    company_name: String(formData.get("companyName") ?? ""),
    job_title: String(formData.get("jobTitle") ?? ""),
    detail_url: parseOptionalText(formData.get("detailUrl")),
    external_apply_url: parseOptionalText(formData.get("externalApplyUrl")),
    posted_at: parseOptionalText(formData.get("postedAt")),
    apply_start_date: parseOptionalText(formData.get("applyStartDate")),
    apply_end_date: parseOptionalText(formData.get("applyEndDate")),
    apply_period_raw: parseOptionalText(formData.get("applyPeriodRaw")),
    normalized_content: String(formData.get("normalizedContent") ?? ""),
    tags: parseTagList(formData.get("tags")),
    curation_status: String(formData.get("curationStatus") ?? "interesting"),
    curation_note: parseOptionalText(formData.get("curationNote")),
    is_bookmarked: parseCheckbox(formData.get("isBookmarked")),
    is_todo: parseCheckbox(formData.get("isTodo")),
    resume_template_id: parseRequiredNumber(formData.get("resumeTemplateId"), "resumeTemplateId"),
    application_method: String(formData.get("applicationMethod") ?? "simple"),
    status: String(formData.get("status") ?? "planned"),
    note: String(formData.get("note") ?? ""),
    applied_at: parseOptionalText(formData.get("appliedAt")),
  });
  updateTags([
    CACHE_TAGS.dashboard,
    CACHE_TAGS.sources,
    CACHE_TAGS.postings,
    CACHE_TAGS.applications,
    CACHE_TAGS.coverLetter,
  ]);
  revalidateAll();
  revalidatePath(`/applications/${application.id}`);
  if (application.application_method === "cover_letter") {
    redirect(`/applications/${application.id}`);
  }
  redirect("/applications");
}

export async function updateApplicationAction(formData: FormData) {
  const applicationId = parseRequiredNumber(formData.get("applicationId"), "applicationId");
  const appliedAt = String(formData.get("appliedAt") ?? "").trim();
  const resumeTemplateIdRaw = String(formData.get("resumeTemplateId") ?? "").trim();
  const resumeTemplateId = resumeTemplateIdRaw ? Number(resumeTemplateIdRaw) : null;
  await patchApplication(applicationId, {
    status: String(formData.get("status") ?? "planned"),
    note: String(formData.get("note") ?? ""),
    applied_at: appliedAt || null,
    resume_template_id:
      resumeTemplateId !== null && Number.isFinite(resumeTemplateId) ? resumeTemplateId : null,
    resume_snapshot_title: String(formData.get("resumeSnapshotTitle") ?? ""),
    resume_snapshot_markdown: String(formData.get("resumeSnapshotMarkdown") ?? ""),
  });
  updateTags([CACHE_TAGS.dashboard, CACHE_TAGS.postings, CACHE_TAGS.applications]);
  revalidateAll();
  revalidatePath(`/applications/${applicationId}`);
}

export async function createCoverLetterItemAction(formData: FormData) {
  const applicationId = parseRequiredNumber(formData.get("applicationId"), "applicationId");
  await postCoverLetterItem(applicationId, {
    question: String(formData.get("question") ?? ""),
    answer_markdown: String(formData.get("answerMarkdown") ?? ""),
    tags: parseTagList(formData.get("tags")),
  });
  updateTags([CACHE_TAGS.applications, CACHE_TAGS.coverLetter]);
  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
}

export async function updateCoverLetterItemAction(formData: FormData) {
  const applicationId = parseRequiredNumber(formData.get("applicationId"), "applicationId");
  const itemId = parseRequiredNumber(formData.get("itemId"), "itemId");
  await patchCoverLetterItem(itemId, {
    question: String(formData.get("question") ?? ""),
    answer_markdown: String(formData.get("answerMarkdown") ?? ""),
    tags: parseTagList(formData.get("tags")),
    order_index: parseRequiredNumber(formData.get("orderIndex"), "orderIndex"),
  });
  updateTags([CACHE_TAGS.applications, CACHE_TAGS.coverLetter]);
  revalidatePath(`/applications/${applicationId}`);
}

export async function deleteCoverLetterItemAction(formData: FormData) {
  const applicationId = parseRequiredNumber(formData.get("applicationId"), "applicationId");
  const itemId = parseRequiredNumber(formData.get("itemId"), "itemId");
  await deleteCoverLetterItem(itemId);
  updateTags([CACHE_TAGS.applications, CACHE_TAGS.coverLetter]);
  revalidatePath(`/applications/${applicationId}`);
}
