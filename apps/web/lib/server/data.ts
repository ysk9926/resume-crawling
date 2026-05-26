import "server-only";

import { unstable_cache } from "next/cache";

import { type DbExecutor, sql } from "@/lib/db";
import { requireViewer } from "@/lib/server/auth";
import type {
  Application,
  CalendarEvent,
  CalendarMonth,
  CoverLetterItem,
  CoverLetterItemPage,
  Dashboard,
  JobPosting,
  JobPostingPage,
  PostingOverview,
  RememberSearchFilters,
  ResumeTemplate,
  SourceCrawlInfo,
  SourceSummary,
  SyncRun,
} from "@/lib/types";

const DEFAULT_CURATION_STATUS = "new";

type PostingFilters = {
  bookmarked?: boolean;
  curation_status?: string;
  page?: number;
  page_size?: number;
  posting_id?: number;
  q?: string;
  source_key?: string;
  tab?: "all" | "new" | "interesting" | "ignored" | "bookmarked" | "todo";
  todo?: boolean;
};

function asIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function asIsoDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : String(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function combineConditions(conditions: any[]) {
  return conditions.reduce(
    (current, condition, index) => (index === 0 ? condition : sql`${current} and ${condition}`),
    sql`true`,
  );
}

function normalizeWhitespace(value: string) {
  const lines = value.replaceAll("\xa0", " ").split(/\r?\n/);
  const normalized: string[] = [];
  let previousBlank = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (line) {
      normalized.push(line);
      previousBlank = false;
      continue;
    }

    if (normalized.length > 0 && !previousBlank) {
      normalized.push("");
    }
    previousBlank = true;
  }

  return normalized.join("\n").trim();
}

function normalizeLabel(value: string) {
  return value.replaceAll("\xa0", " ").split(/\s+/).filter(Boolean).join(" ");
}

function normalizeCoverLetterTag(value: string) {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

function buildSourceKey(value: string) {
  const slug = normalizeLabel(value)
    .toLowerCase()
    .replace(/[^0-9a-zA-Z가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 50) || "platform";
}

const TAG_RULES: Array<{ keywords: string[]; label: string }> = [
  { label: "Python", keywords: ["python", "파이썬"] },
  { label: "Next.js", keywords: ["next.js", "nextjs"] },
  { label: "React", keywords: ["react", "frontend", "프론트"] },
  { label: "Backend", keywords: ["backend", "백엔드", "server"] },
  { label: "Data", keywords: ["data", "데이터", "분석"] },
  { label: "Quant", keywords: ["quant", "퀀트"] },
  { label: "투자", keywords: ["투자", "운용", "자산"] },
  { label: "리서치", keywords: ["리서치", "research"] },
  { label: "마케팅", keywords: ["마케팅", "marketing"] },
  { label: "신입", keywords: ["신입"] },
  { label: "경력", keywords: ["경력"] },
  { label: "인턴", keywords: ["인턴", "intern"] },
];

function deriveTags(title: string, content: string) {
  const haystack = `${title}\n${content}`.toLowerCase();
  return TAG_RULES.filter(({ keywords }) => keywords.some((keyword) => haystack.includes(keyword)))
    .map(({ label }) => label);
}

function normalizeManualTags(title: string, content: string, tags: string[]) {
  const normalized = tags
    .map((tag) => normalizeLabel(tag))
    .filter(Boolean);
  if (normalized.length > 0) {
    return [...new Set(normalized)];
  }
  return deriveTags(title, content);
}

function resolvePostingFlags(
  currentBookmarked: boolean,
  currentTodo: boolean,
  nextBookmarked: boolean | null | undefined,
  nextTodo: boolean | null | undefined,
) {
  let bookmarked = nextBookmarked == null ? currentBookmarked : nextBookmarked;
  let todo = nextTodo == null ? currentTodo : nextTodo;

  if (nextBookmarked === false && nextTodo == null) {
    todo = false;
  }
  if (todo) {
    bookmarked = true;
  }
  if (!bookmarked) {
    todo = false;
  }

  return { is_bookmarked: bookmarked, is_todo: todo };
}

function parseDateInput(value: string | null | undefined) {
  const candidate = String(value ?? "").trim();
  return candidate || null;
}

function endOfMonth(month: string) {
  const [year, monthLabel] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthLabel, 0)).toISOString().slice(0, 10);
}

function serializeSource(row: Record<string, unknown>): SourceSummary {
  return {
    base_url: String(row.base_url ?? ""),
    id: Number(row.id),
    is_enabled: Boolean(row.is_enabled),
    key: String(row.key),
    last_synced_at: asIsoDateTime(row.last_synced_at as Date | string | null),
    name: String(row.name),
    posting_count: Number(row.posting_count ?? 0),
    supports_sync: Boolean(row.supports_sync),
  };
}

function serializeSyncRun(row: Record<string, unknown>): SyncRun {
  return {
    finished_at: asIsoDateTime(row.finished_at as Date | string | null),
    id: Number(row.id),
    inserted_count: Number(row.inserted_count ?? 0),
    message: row.message ? String(row.message) : null,
    source_id: Number(row.source_id),
    started_at: asIsoDateTime(row.started_at as Date | string) ?? new Date().toISOString(),
    status: String(row.status),
    total_count: Number(row.total_count ?? 0),
    updated_count: Number(row.updated_count ?? 0),
  };
}

function serializeResume(row: Record<string, unknown>): ResumeTemplate {
  return {
    created_at: asIsoDateTime(row.created_at as Date | string) ?? new Date().toISOString(),
    id: Number(row.id),
    markdown_content: String(row.markdown_content ?? ""),
    summary: String(row.summary ?? ""),
    title: String(row.title ?? ""),
    updated_at: asIsoDateTime(row.updated_at as Date | string) ?? new Date().toISOString(),
  };
}

function serializePosting(row: Record<string, unknown>): JobPosting {
  return {
    application_id: row.application_id == null ? null : Number(row.application_id),
    application_status: row.application_status ? String(row.application_status) : null,
    apply_end_date: asIsoDate(row.apply_end_date as Date | string | null),
    apply_period_raw: row.apply_period_raw ? String(row.apply_period_raw) : null,
    apply_start_date: asIsoDate(row.apply_start_date as Date | string | null),
    company_name: String(row.company_name),
    curation_note: row.curation_note ? String(row.curation_note) : null,
    curation_status: String(row.curation_status ?? DEFAULT_CURATION_STATUS),
    detail_url: String(row.detail_url),
    external_apply_url: row.external_apply_url ? String(row.external_apply_url) : null,
    external_id: String(row.external_id),
    id: Number(row.id),
    ingest_kind: String(row.ingest_kind ?? "crawl"),
    is_bookmarked: Boolean(row.is_bookmarked),
    is_todo: Boolean(row.is_todo),
    last_seen_at: asIsoDateTime(row.last_seen_at as Date | string) ?? new Date().toISOString(),
    normalized_content: String(row.normalized_content ?? ""),
    posted_at: asIsoDate(row.posted_at as Date | string | null),
    source_key: String(row.source_key),
    source_name: String(row.source_name),
    tags: asStringArray(row.tags),
    title: String(row.title),
  };
}

function serializeApplication(row: Record<string, unknown>): Application {
  return {
    application_method: String(row.application_method),
    applied_at: asIsoDate(row.applied_at as Date | string | null),
    apply_end_date_snapshot: asIsoDate(row.apply_end_date_snapshot as Date | string | null),
    apply_period_raw_snapshot: row.apply_period_raw_snapshot
      ? String(row.apply_period_raw_snapshot)
      : null,
    company_name: String(row.company_name),
    created_at: asIsoDateTime(row.created_at as Date | string) ?? new Date().toISOString(),
    detail_url: String(row.detail_url),
    external_apply_url: row.external_apply_url ? String(row.external_apply_url) : null,
    id: Number(row.id),
    job_posting_id: Number(row.job_posting_id),
    job_title: String(row.job_title),
    note: String(row.note ?? ""),
    posting_normalized_content: String(row.posting_normalized_content ?? ""),
    posting_tags: asStringArray(row.posting_tags),
    resume_snapshot_markdown: String(row.resume_snapshot_markdown ?? ""),
    resume_snapshot_title: String(row.resume_snapshot_title ?? ""),
    resume_template_id: row.resume_template_id == null ? null : Number(row.resume_template_id),
    resume_template_title: row.resume_template_title ? String(row.resume_template_title) : null,
    source_key: String(row.source_key),
    source_name: String(row.source_name),
    status: String(row.status),
    updated_at: asIsoDateTime(row.updated_at as Date | string) ?? new Date().toISOString(),
  };
}

function serializeCoverLetterItem(row: Record<string, unknown>): CoverLetterItem {
  return {
    answer_markdown: String(row.answer_markdown ?? ""),
    application_id: Number(row.application_id),
    company_name: String(row.company_name),
    created_at: asIsoDateTime(row.created_at as Date | string) ?? new Date().toISOString(),
    id: Number(row.id),
    job_title: String(row.job_title),
    order_index: Number(row.order_index ?? 0),
    question: String(row.question ?? ""),
    tags: asStringArray(row.tags),
    updated_at: asIsoDateTime(row.updated_at as Date | string) ?? new Date().toISOString(),
  };
}

function buildPostingFilterSql(
  viewerId: number,
  filters: PostingFilters,
) {
  const conditions = [sql`true`];

  if (filters.posting_id != null && Number.isFinite(filters.posting_id)) {
    conditions.push(sql`p.id = ${filters.posting_id}`);
  }

  if (filters.q?.trim()) {
    const wildcard = `%${filters.q.trim()}%`;
    conditions.push(sql`
      (
        p.title ilike ${wildcard}
        or p.company_name ilike ${wildcard}
        or p.normalized_content ilike ${wildcard}
      )
    `);
  }

  if (filters.source_key?.trim()) {
    conditions.push(sql`s.key = ${filters.source_key.trim()}`);
  }

  let resolvedStatus = filters.curation_status;
  let bookmarked = filters.bookmarked;
  let todo = filters.todo;

  if (filters.tab === "new") {
    resolvedStatus = DEFAULT_CURATION_STATUS;
  } else if (filters.tab === "interesting") {
    resolvedStatus = "interesting";
  } else if (filters.tab === "ignored") {
    resolvedStatus = "ignored";
  } else if (filters.tab === "bookmarked") {
    bookmarked = true;
  } else if (filters.tab === "todo") {
    todo = true;
  }

  if (resolvedStatus != null) {
    if (resolvedStatus === DEFAULT_CURATION_STATUS) {
      conditions.push(sql`(ups.id is null or ups.curation_status = ${DEFAULT_CURATION_STATUS})`);
    } else {
      conditions.push(sql`ups.curation_status = ${resolvedStatus}`);
    }
  }

  if (bookmarked != null) {
    if (bookmarked) {
      conditions.push(sql`ups.is_bookmarked is true`);
    } else {
      conditions.push(sql`(ups.id is null or ups.is_bookmarked is false)`);
    }
  }

  if (todo != null) {
    if (todo) {
      conditions.push(sql`ups.is_todo is true`);
    } else {
      conditions.push(sql`(ups.id is null or ups.is_todo is false)`);
    }
  }

  return sql`
    from job_postings p
    join sources s on s.id = p.source_id
    left join user_posting_states ups
      on ups.job_posting_id = p.id
      and ups.user_id = ${viewerId}
    left join applications a
      on a.job_posting_id = p.id
      and a.user_id = ${viewerId}
    where ${combineConditions(conditions)}
  `;
}

async function getPostingOverviewInternal(
  viewerId: number,
  filters: { posting_id?: number; q?: string; source_key?: string },
) {
  const fromSql = buildPostingFilterSql(viewerId, filters);
  const rows = await sql<Record<string, number>[]>`
    select
      count(*)::int as all,
      count(*) filter (
        where coalesce(ups.curation_status, ${DEFAULT_CURATION_STATUS}) = ${DEFAULT_CURATION_STATUS}
      )::int as new,
      count(*) filter (where ups.curation_status = 'interesting')::int as interesting,
      count(*) filter (where ups.curation_status = 'ignored')::int as ignored,
      count(*) filter (where coalesce(ups.is_bookmarked, false) is true)::int as bookmarked,
      count(*) filter (where coalesce(ups.is_todo, false) is true)::int as todo
      ${fromSql}
  `;
  const row = rows[0] ?? {
    all: 0,
    bookmarked: 0,
    ignored: 0,
    interesting: 0,
    new: 0,
    todo: 0,
  };
  return {
    all: Number(row.all ?? 0),
    bookmarked: Number(row.bookmarked ?? 0),
    ignored: Number(row.ignored ?? 0),
    interesting: Number(row.interesting ?? 0),
    new: Number(row.new ?? 0),
    todo: Number(row.todo ?? 0),
  } satisfies PostingOverview;
}

async function getPostingPageInternal(
  viewerId: number,
  filters: PostingFilters,
) {
  const page = Math.max(1, Number(filters.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.page_size ?? 25)));
  const offset = (page - 1) * pageSize;
  const fromSql = buildPostingFilterSql(viewerId, filters);

  const countRows = await sql<{ count: number }[]>`
    select count(*)::int as count
    ${fromSql}
  `;
  const totalCount = Number(countRows[0]?.count ?? 0);
  const totalPages = totalCount === 0 ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));
  const resolvedPage = Math.min(page, totalPages);
  const resolvedOffset = (resolvedPage - 1) * pageSize;

  const rows = await sql<Record<string, unknown>[]>`
    select
      p.id,
      s.key as source_key,
      s.name as source_name,
      p.external_id,
      p.company_name,
      p.title,
      p.detail_url,
      p.external_apply_url,
      p.ingest_kind,
      p.posted_at,
      p.apply_start_date,
      p.apply_end_date,
      p.apply_period_raw,
      p.normalized_content,
      p.tags,
      coalesce(ups.curation_status, ${DEFAULT_CURATION_STATUS}) as curation_status,
      ups.curation_note,
      coalesce(ups.is_bookmarked, false) as is_bookmarked,
      coalesce(ups.is_todo, false) as is_todo,
      p.last_seen_at,
      a.id as application_id,
      a.status as application_status
      ${fromSql}
    order by p.posted_at desc nulls last, p.created_at desc, p.id desc
    limit ${pageSize}
    offset ${resolvedOffset}
  `;

  return {
    has_next: resolvedPage < totalPages,
    has_prev: resolvedPage > 1,
    items: rows.map(serializePosting),
    page: resolvedPage,
    page_size: pageSize,
    total_count: totalCount,
    total_pages: totalPages,
  } satisfies JobPostingPage;
}

async function getApplicationRows(viewerId: number) {
  return sql<Record<string, unknown>[]>`
    select
      a.id,
      a.job_posting_id,
      jp.title as job_title,
      jp.company_name,
      s.key as source_key,
      s.name as source_name,
      jp.detail_url,
      jp.external_apply_url,
      a.resume_template_id,
      rt.title as resume_template_title,
      a.application_method,
      a.status,
      a.note,
      a.applied_at,
      a.apply_end_date_snapshot,
      a.apply_period_raw_snapshot,
      a.resume_snapshot_title,
      a.resume_snapshot_markdown,
      coalesce(jp.normalized_content, '') as posting_normalized_content,
      coalesce(jp.tags, '[]'::json) as posting_tags,
      a.created_at,
      a.updated_at
    from applications a
    join job_postings jp on jp.id = a.job_posting_id
    join sources s on s.id = jp.source_id
    left join resume_templates rt on rt.id = a.resume_template_id
    where a.user_id = ${viewerId}
    order by a.updated_at desc, a.id desc
  `;
}

async function getApplicationRowsForStatuses(viewerId: number, statuses?: string[]) {
  const statusCondition =
    statuses && statuses.length > 0
      ? sql`and a.status = any(${sql.array(statuses)})`
      : sql``;

  return sql<Record<string, unknown>[]>`
    select
      a.id,
      a.job_posting_id,
      jp.title as job_title,
      jp.company_name,
      s.key as source_key,
      s.name as source_name,
      jp.detail_url,
      jp.external_apply_url,
      a.resume_template_id,
      rt.title as resume_template_title,
      a.application_method,
      a.status,
      a.note,
      a.applied_at,
      a.apply_end_date_snapshot,
      a.apply_period_raw_snapshot,
      a.resume_snapshot_title,
      a.resume_snapshot_markdown,
      coalesce(jp.normalized_content, '') as posting_normalized_content,
      coalesce(jp.tags, '[]'::json) as posting_tags,
      a.created_at,
      a.updated_at
    from applications a
    join job_postings jp on jp.id = a.job_posting_id
    join sources s on s.id = jp.source_id
    left join resume_templates rt on rt.id = a.resume_template_id
    where a.user_id = ${viewerId}
      ${statusCondition}
    order by
      case when a.apply_end_date_snapshot is null then 1 else 0 end,
      a.apply_end_date_snapshot asc,
      a.updated_at desc,
      a.id desc
  `;
}

async function getRecentApplicationRows(viewerId: number, limit: number) {
  return sql<Record<string, unknown>[]>`
    select
      a.id,
      a.job_posting_id,
      jp.title as job_title,
      jp.company_name,
      s.key as source_key,
      s.name as source_name,
      jp.detail_url,
      jp.external_apply_url,
      a.resume_template_id,
      rt.title as resume_template_title,
      a.application_method,
      a.status,
      a.note,
      a.applied_at,
      a.apply_end_date_snapshot,
      a.apply_period_raw_snapshot,
      a.resume_snapshot_title,
      a.resume_snapshot_markdown,
      coalesce(jp.normalized_content, '') as posting_normalized_content,
      coalesce(jp.tags, '[]'::json) as posting_tags,
      a.created_at,
      a.updated_at
    from applications a
    join job_postings jp on jp.id = a.job_posting_id
    join sources s on s.id = jp.source_id
    left join resume_templates rt on rt.id = a.resume_template_id
    where a.user_id = ${viewerId}
    order by a.updated_at desc, a.id desc
    limit ${Math.max(1, Math.min(limit, 50))}
  `;
}

async function getRecentDashboardPostingRows(viewerId: number, limit: number) {
  return sql<Record<string, unknown>[]>`
    select
      p.id,
      s.key as source_key,
      s.name as source_name,
      p.external_id,
      p.company_name,
      p.title,
      p.detail_url,
      p.external_apply_url,
      p.ingest_kind,
      p.posted_at,
      p.apply_start_date,
      p.apply_end_date,
      p.apply_period_raw,
      p.normalized_content,
      p.tags,
      coalesce(ups.curation_status, ${DEFAULT_CURATION_STATUS}) as curation_status,
      ups.curation_note,
      coalesce(ups.is_bookmarked, false) as is_bookmarked,
      coalesce(ups.is_todo, false) as is_todo,
      p.last_seen_at,
      a.id as application_id,
      a.status as application_status
    from job_postings p
    join sources s on s.id = p.source_id
    left join user_posting_states ups
      on ups.job_posting_id = p.id
      and ups.user_id = ${viewerId}
    left join applications a
      on a.job_posting_id = p.id
      and a.user_id = ${viewerId}
    order by p.posted_at desc nulls last, p.created_at desc, p.id desc
    limit ${Math.max(1, Math.min(limit, 50))}
  `;
}

async function getSourceRows() {
  return sql<Record<string, unknown>[]>`
    select
      s.id,
      s.key,
      s.name,
      s.base_url,
      s.is_enabled,
      s.supports_sync,
      s.last_synced_at,
      coalesce(count(p.id), 0)::int as posting_count
    from sources s
    left join job_postings p on p.source_id = s.id
    group by s.id
    order by s.name asc
  `;
}

const getCachedSources = unstable_cache(
  async () => {
    const rows = await getSourceRows();
    return rows.map(serializeSource);
  },
  ["sources:list"],
  { revalidate: 10 },
);

const getCachedSourceSyncRuns = unstable_cache(
  async (sourceKey: string, limit: number) => {
    const rows = await sql<Record<string, unknown>[]>`
      select r.id, r.source_id, r.status, r.message, r.inserted_count, r.updated_count, r.total_count,
        r.started_at, r.finished_at
      from job_sync_runs r
      join sources s on s.id = r.source_id
      where s.key = ${sourceKey}
      order by r.started_at desc
      limit ${Math.max(1, Math.min(limit, 100))}
    `;
    return rows.map(serializeSyncRun);
  },
  ["sources:sync-runs"],
  { revalidate: 10 },
);

async function findOrCreateSource(
  tx: DbExecutor,
  platformName: string,
  baseUrl: string,
) {
  const normalizedName = normalizeLabel(platformName);
  if (!normalizedName) {
    throw new Error("Platform name is required.");
  }

  const existingRows = await tx<Record<string, unknown>[]>`
    select id, key, name, base_url, supports_sync
    from sources
    where lower(name) = lower(${normalizedName})
    order by id asc
    limit 1
  `;
  const existing = existingRows[0];
  if (existing) {
    if (!existing.base_url && baseUrl) {
      await tx`
        update sources
        set base_url = ${baseUrl}, updated_at = timezone('utc', now())
        where id = ${Number(existing.id)}
      `;
      existing.base_url = baseUrl;
    }
    return {
      id: Number(existing.id),
      key: String(existing.key),
    };
  }

  const keyBase = buildSourceKey(normalizedName);
  let key = keyBase;
  let suffix = 2;
  for (;;) {
    const keyRows = await tx<{ id: number }[]>`
      select id
      from sources
      where key = ${key}
      limit 1
    `;
    if (keyRows.length === 0) {
      break;
    }
    const suffixLabel = `-${suffix}`;
    key = `${keyBase.slice(0, Math.max(1, 50 - suffixLabel.length))}${suffixLabel}`;
    suffix += 1;
  }

  const rows = await tx<{ id: number; key: string }[]>`
    insert into sources (
      key,
      name,
      base_url,
      supports_sync,
      is_enabled,
      created_at,
      updated_at
    )
    values (
      ${key},
      ${normalizedName},
      ${baseUrl},
      false,
      true,
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning id, key
  `;
  return rows[0];
}

function deriveSourceBaseUrl(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return candidate;
    }
  }
  return "";
}

function resolveManualUrls(
  detailUrl: string | null | undefined,
  externalApplyUrl: string | null | undefined,
) {
  const normalizedDetail = normalizeLabel(detailUrl || "") || null;
  const normalizedExternal = normalizeLabel(externalApplyUrl || "") || null;
  const resolvedDetail = normalizedDetail || normalizedExternal;
  if (!resolvedDetail) {
    throw new Error("Manual entries require at least one URL.");
  }

  return {
    base_url: deriveSourceBaseUrl(resolvedDetail, normalizedExternal),
    detail_url: resolvedDetail,
    external_apply_url: normalizedExternal,
  };
}

async function buildManualPosting(
  tx: DbExecutor,
  payload: {
    apply_end_date?: string | null;
    apply_period_raw?: string | null;
    apply_start_date?: string | null;
    company_name: string;
    detail_url?: string | null;
    external_apply_url?: string | null;
    normalized_content: string;
    platform_name: string;
    posted_at?: string | null;
    tags: string[];
    title: string;
  },
) {
  const normalizedCompanyName = normalizeLabel(payload.company_name);
  const normalizedTitle = normalizeLabel(payload.title);
  if (!normalizedCompanyName) {
    throw new Error("Company name is required.");
  }
  if (!normalizedTitle) {
    throw new Error("Job title is required.");
  }

  const urls = resolveManualUrls(payload.detail_url, payload.external_apply_url);
  const source = await findOrCreateSource(tx, payload.platform_name, urls.base_url);
  const content = normalizeWhitespace(payload.normalized_content);
  const tags = normalizeManualTags(normalizedTitle, content, payload.tags);

  const rows = await tx<Record<string, unknown>[]>`
    insert into job_postings (
      source_id,
      external_id,
      company_name,
      title,
      detail_url,
      external_apply_url,
      ingest_kind,
      posted_at,
      apply_period_raw,
      apply_start_date,
      apply_end_date,
      raw_content,
      normalized_content,
      tags,
      curation_status,
      curation_note,
      is_bookmarked,
      is_todo,
      first_seen_at,
      last_seen_at,
      created_at,
      updated_at
    )
    values (
      ${source.id},
      ${`manual:${crypto.randomUUID().replaceAll("-", "")}`},
      ${normalizedCompanyName},
      ${normalizedTitle},
      ${urls.detail_url},
      ${urls.external_apply_url},
      'manual',
      ${parseDateInput(payload.posted_at)},
      ${normalizeLabel(payload.apply_period_raw || "") || null},
      ${parseDateInput(payload.apply_start_date)},
      ${parseDateInput(payload.apply_end_date)},
      ${content},
      ${content},
      ${sql.json(tags)},
      ${DEFAULT_CURATION_STATUS},
      null,
      false,
      false,
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning id, source_id, external_id, company_name, title, detail_url, external_apply_url,
      ingest_kind, posted_at, apply_start_date, apply_end_date, apply_period_raw, normalized_content,
      tags, last_seen_at, created_at
  `;

  return rows[0];
}

async function getOrCreatePostingState(
  tx: DbExecutor,
  viewerId: number,
  postingId: number,
) {
  const existing = await tx<Record<string, unknown>[]>`
    select id, curation_status, curation_note, is_bookmarked, is_todo
    from user_posting_states
    where user_id = ${viewerId}
      and job_posting_id = ${postingId}
    limit 1
  `;
  if (existing[0]) {
    return existing[0];
  }

  const rows = await tx<Record<string, unknown>[]>`
    insert into user_posting_states (
      user_id,
      job_posting_id,
      curation_status,
      curation_note,
      is_bookmarked,
      is_todo,
      created_at,
      updated_at
    )
    values (
      ${viewerId},
      ${postingId},
      ${DEFAULT_CURATION_STATUS},
      null,
      false,
      false,
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning id, curation_status, curation_note, is_bookmarked, is_todo
  `;
  return rows[0];
}

async function resolveCoverLetterTagIds(
  tx: DbExecutor,
  viewerId: number,
  tags: string[],
) {
  const resolved: Array<{ id: number; label: string; name: string }> = [];
  const seen = new Set<string>();

  for (const rawTag of tags) {
    const normalized = normalizeCoverLetterTag(rawTag);
    const label = normalizeLabel(rawTag);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    const existingRows = await tx<{ id: number; label: string; name: string }[]>`
      select id, label, name
      from cover_letter_tags
      where user_id = ${viewerId}
        and name = ${normalized}
      limit 1
    `;

    if (existingRows[0]) {
      if (existingRows[0].label !== label) {
        await tx`
          update cover_letter_tags
          set label = ${label}
          where id = ${existingRows[0].id}
        `;
        existingRows[0].label = label;
      }
      resolved.push(existingRows[0]);
      seen.add(normalized);
      continue;
    }

    const insertedRows = await tx<{ id: number; label: string; name: string }[]>`
      insert into cover_letter_tags (
        user_id,
        name,
        label,
        created_at
      )
      values (
        ${viewerId},
        ${normalized},
        ${label},
        timezone('utc', now())
      )
      returning id, label, name
    `;
    resolved.push(insertedRows[0]);
    seen.add(normalized);
  }

  return resolved;
}

async function loadApplicationByIdInternal(
  viewerId: number,
  applicationId: number,
  executor: DbExecutor = sql,
) {
  const rows = await executor<Record<string, unknown>[]>`
    select
      a.id,
      a.job_posting_id,
      jp.title as job_title,
      jp.company_name,
      s.key as source_key,
      s.name as source_name,
      jp.detail_url,
      jp.external_apply_url,
      a.resume_template_id,
      rt.title as resume_template_title,
      a.application_method,
      a.status,
      a.note,
      a.applied_at,
      a.apply_end_date_snapshot,
      a.apply_period_raw_snapshot,
      a.resume_snapshot_title,
      a.resume_snapshot_markdown,
      coalesce(jp.normalized_content, '') as posting_normalized_content,
      coalesce(jp.tags, '[]'::json) as posting_tags,
      a.created_at,
      a.updated_at
    from applications a
    join job_postings jp on jp.id = a.job_posting_id
    join sources s on s.id = jp.source_id
    left join resume_templates rt on rt.id = a.resume_template_id
    where a.user_id = ${viewerId}
      and a.id = ${applicationId}
    limit 1
  `;
  return rows[0] ? serializeApplication(rows[0]) : null;
}

export async function getSources() {
  await requireViewer();
  return getCachedSources();
}

export async function getSourceSyncRuns(sourceKey: string, limit: number = 20) {
  await requireViewer();
  return getCachedSourceSyncRuns(sourceKey, limit);
}

export async function getPostingOverview(
  filters?: { posting_id?: number; q?: string; source_key?: string },
) {
  const viewer = await requireViewer();
  return getPostingOverviewInternal(viewer.id, filters ?? {});
}

export async function getPostings(filters?: PostingFilters) {
  const viewer = await requireViewer();
  const page = await getPostingPageInternal(viewer.id, {
    ...(filters ?? {}),
    page: 1,
    page_size: 1000,
  });
  return page.items;
}

export async function getAllPostingsPage(filters?: PostingFilters) {
  const viewer = await requireViewer();
  return getPostingPageInternal(viewer.id, {
    ...(filters ?? {}),
    tab: "all",
  });
}

export async function getNewPostingsPage(filters?: PostingFilters) {
  const viewer = await requireViewer();
  return getPostingPageInternal(viewer.id, {
    ...(filters ?? {}),
    tab: "new",
  });
}

export async function getInterestingPostingsPage(filters?: PostingFilters) {
  const viewer = await requireViewer();
  return getPostingPageInternal(viewer.id, {
    ...(filters ?? {}),
    tab: "interesting",
  });
}

export async function getIgnoredPostingsPage(filters?: PostingFilters) {
  const viewer = await requireViewer();
  return getPostingPageInternal(viewer.id, {
    ...(filters ?? {}),
    tab: "ignored",
  });
}

export async function getBookmarkedPostingsPage(filters?: PostingFilters) {
  const viewer = await requireViewer();
  return getPostingPageInternal(viewer.id, {
    ...(filters ?? {}),
    tab: "bookmarked",
  });
}

export async function getTodoPostingsPage(filters?: PostingFilters) {
  const viewer = await requireViewer();
  return getPostingPageInternal(viewer.id, {
    ...(filters ?? {}),
    tab: "todo",
  });
}

export async function patchPosting(
  postingId: number,
  payload: {
    curation_note?: string | null;
    curation_status?: string;
    is_bookmarked?: boolean;
    is_todo?: boolean;
  },
) {
  const viewer = await requireViewer();
  return sql.begin(async (tx) => {
    const postingRows = await tx<{ id: number }[]>`
      select id
      from job_postings
      where id = ${postingId}
      limit 1
    `;
    if (postingRows.length === 0) {
      throw new Error("Job posting not found.");
    }

    const state = await getOrCreatePostingState(tx, viewer.id, postingId);
    const flags = resolvePostingFlags(
      Boolean(state.is_bookmarked),
      Boolean(state.is_todo),
      payload.is_bookmarked,
      payload.is_todo,
    );

    await tx`
      update user_posting_states
      set
        curation_status = ${payload.curation_status ?? String(state.curation_status ?? DEFAULT_CURATION_STATUS)},
        curation_note = ${normalizeWhitespace(payload.curation_note ?? String(state.curation_note ?? "")) || null},
        is_bookmarked = ${flags.is_bookmarked},
        is_todo = ${flags.is_todo},
        updated_at = timezone('utc', now())
      where id = ${Number(state.id)}
    `;

    const page = await getPostingPageInternal(viewer.id, {
      page: 1,
      page_size: 1,
      q: undefined,
      source_key: undefined,
    });
    const refreshed = (await tx<Record<string, unknown>[]>`
      select
        p.id,
        s.key as source_key,
        s.name as source_name,
        p.external_id,
        p.company_name,
        p.title,
        p.detail_url,
        p.external_apply_url,
        p.ingest_kind,
        p.posted_at,
        p.apply_start_date,
        p.apply_end_date,
        p.apply_period_raw,
        p.normalized_content,
        p.tags,
        coalesce(ups.curation_status, ${DEFAULT_CURATION_STATUS}) as curation_status,
        ups.curation_note,
        coalesce(ups.is_bookmarked, false) as is_bookmarked,
        coalesce(ups.is_todo, false) as is_todo,
        p.last_seen_at,
        a.id as application_id,
        a.status as application_status
      from job_postings p
      join sources s on s.id = p.source_id
      left join user_posting_states ups
        on ups.job_posting_id = p.id
        and ups.user_id = ${viewer.id}
      left join applications a
        on a.job_posting_id = p.id
        and a.user_id = ${viewer.id}
      where p.id = ${postingId}
      limit 1
    `)[0];
    return refreshed ? serializePosting(refreshed) : page.items[0];
  });
}

export async function getResumes() {
  const viewer = await requireViewer();
  const rows = await sql<Record<string, unknown>[]>`
    select id, title, summary, markdown_content, created_at, updated_at
    from resume_templates
    where user_id = ${viewer.id}
    order by updated_at desc, id desc
  `;
  return rows.map(serializeResume);
}

export async function createResume(payload: {
  markdown_content: string;
  summary: string;
  title: string;
}) {
  const viewer = await requireViewer();
  const rows = await sql<Record<string, unknown>[]>`
    insert into resume_templates (
      user_id,
      title,
      summary,
      markdown_content,
      created_at,
      updated_at
    )
    values (
      ${viewer.id},
      ${payload.title},
      ${payload.summary},
      ${payload.markdown_content},
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning id, title, summary, markdown_content, created_at, updated_at
  `;
  return serializeResume(rows[0]);
}

export async function patchResume(
  resumeId: number,
  payload: {
    markdown_content: string;
    summary: string;
    title: string;
  },
) {
  const viewer = await requireViewer();
  const rows = await sql<Record<string, unknown>[]>`
    update resume_templates
    set
      title = ${payload.title},
      summary = ${payload.summary},
      markdown_content = ${payload.markdown_content},
      updated_at = timezone('utc', now())
    where id = ${resumeId}
      and user_id = ${viewer.id}
    returning id, title, summary, markdown_content, created_at, updated_at
  `;
  if (!rows[0]) {
    throw new Error("Resume template not found.");
  }
  return serializeResume(rows[0]);
}

export async function getApplications() {
  const viewer = await requireViewer();
  const rows = await getApplicationRows(viewer.id);
  return rows.map(serializeApplication);
}

export async function getApplicationsByStatuses(statuses?: string[]) {
  const viewer = await requireViewer();
  const rows = await getApplicationRowsForStatuses(viewer.id, statuses);
  return rows.map(serializeApplication);
}

export async function getApplicationStats() {
  const viewer = await requireViewer();
  const rows = await sql<Record<string, number>[]>`
    select
      count(*)::int as total,
      count(*) filter (where application_method = 'simple')::int as simple,
      count(*) filter (where application_method = 'cover_letter')::int as cover_letter,
      count(*) filter (where status = 'planned')::int as planned,
      count(*) filter (
        where status in ('applied', 'document_passed', 'interview')
      )::int as in_progress,
      count(*) filter (where status = 'offer')::int as offer,
      count(*) filter (where status in ('rejected', 'withdrawn'))::int as closed
    from applications
    where user_id = ${viewer.id}
  `;

  const row = rows[0] ?? {
    closed: 0,
    cover_letter: 0,
    in_progress: 0,
    offer: 0,
    planned: 0,
    simple: 0,
    total: 0,
  };

  return {
    closed: Number(row.closed ?? 0),
    coverLetter: Number(row.cover_letter ?? 0),
    inProgress: Number(row.in_progress ?? 0),
    offer: Number(row.offer ?? 0),
    planned: Number(row.planned ?? 0),
    simple: Number(row.simple ?? 0),
    total: Number(row.total ?? 0),
  };
}

export async function getApplication(applicationId: number) {
  const viewer = await requireViewer();
  const application = await loadApplicationByIdInternal(viewer.id, applicationId);
  if (!application) {
    throw new Error("Application not found.");
  }
  return application;
}

export async function createApplication(payload: {
  application_method: string;
  applied_at?: string | null;
  job_posting_id: number;
  note: string;
  resume_template_id: number;
  status: string;
}) {
  const viewer = await requireViewer();
  return sql.begin(async (tx) => {
    const postingRows = await tx<Record<string, unknown>[]>`
      select id, company_name, apply_end_date, apply_period_raw
      from job_postings
      where id = ${payload.job_posting_id}
      limit 1
    `;
    const posting = postingRows[0];
    if (!posting) {
      throw new Error("Job posting not found.");
    }

    const templateRows = await tx<Record<string, unknown>[]>`
      select id, title, markdown_content
      from resume_templates
      where id = ${payload.resume_template_id}
        and user_id = ${viewer.id}
      limit 1
    `;
    const template = templateRows[0];
    if (!template) {
      throw new Error("Resume template not found.");
    }

    const existingRows = await tx<Record<string, unknown>[]>`
      select id, application_method
      from applications
      where user_id = ${viewer.id}
        and job_posting_id = ${payload.job_posting_id}
      limit 1
    `;

    if (!existingRows[0]) {
      const insertedRows = await tx<{ id: number }[]>`
        insert into applications (
          user_id,
          job_posting_id,
          resume_template_id,
          application_method,
          status,
          note,
          applied_at,
          apply_end_date_snapshot,
          apply_period_raw_snapshot,
          resume_snapshot_title,
          resume_snapshot_markdown,
          created_at,
          updated_at
        )
        values (
          ${viewer.id},
          ${payload.job_posting_id},
          ${payload.resume_template_id},
          ${payload.application_method},
          ${payload.status},
          ${payload.note},
          ${parseDateInput(payload.applied_at)},
          ${asIsoDate(posting.apply_end_date as Date | string | null)},
          ${posting.apply_period_raw ? String(posting.apply_period_raw) : null},
          ${`${String(template.title)} · ${String(posting.company_name)}`},
          ${String(template.markdown_content ?? "")},
          timezone('utc', now()),
          timezone('utc', now())
        )
        returning id
      `;
      const application = await loadApplicationByIdInternal(viewer.id, insertedRows[0].id, tx);
      if (!application) {
        throw new Error("Application could not be reloaded.");
      }
      return application;
    }

    if (String(existingRows[0].application_method) !== payload.application_method) {
      throw new Error("Application method cannot be changed once created.");
    }

    await tx`
      update applications
      set
        resume_template_id = ${payload.resume_template_id},
        status = ${payload.status},
        note = ${payload.note},
        applied_at = ${parseDateInput(payload.applied_at)},
        apply_end_date_snapshot = ${asIsoDate(posting.apply_end_date as Date | string | null)},
        apply_period_raw_snapshot = ${posting.apply_period_raw ? String(posting.apply_period_raw) : null},
        resume_snapshot_title = ${`${String(template.title)} · ${String(posting.company_name)}`},
        resume_snapshot_markdown = ${String(template.markdown_content ?? "")},
        updated_at = timezone('utc', now())
      where id = ${Number(existingRows[0].id)}
    `;

    const application = await loadApplicationByIdInternal(viewer.id, Number(existingRows[0].id), tx);
    if (!application) {
      throw new Error("Application could not be reloaded.");
    }
    return application;
  });
}

export async function createManualPosting(payload: {
  apply_end_date?: string | null;
  apply_period_raw?: string | null;
  apply_start_date?: string | null;
  company_name: string;
  curation_note?: string | null;
  curation_status: string;
  detail_url?: string | null;
  external_apply_url?: string | null;
  is_bookmarked: boolean;
  is_todo: boolean;
  normalized_content: string;
  platform_name: string;
  posted_at?: string | null;
  tags: string[];
  title: string;
}) {
  const viewer = await requireViewer();
  return sql.begin(async (tx) => {
    const posting = await buildManualPosting(tx, payload);
    const state = await getOrCreatePostingState(tx, viewer.id, Number(posting.id));
    await tx`
      update user_posting_states
      set
        curation_status = ${payload.curation_status},
        curation_note = ${normalizeWhitespace(payload.curation_note ?? "") || null},
        is_bookmarked = ${payload.is_bookmarked || payload.is_todo},
        is_todo = ${payload.is_todo},
        updated_at = timezone('utc', now())
      where id = ${Number(state.id)}
    `;

    const rows = await tx<Record<string, unknown>[]>`
      select
        p.id,
        s.key as source_key,
        s.name as source_name,
        p.external_id,
        p.company_name,
        p.title,
        p.detail_url,
        p.external_apply_url,
        p.ingest_kind,
        p.posted_at,
        p.apply_start_date,
        p.apply_end_date,
        p.apply_period_raw,
        p.normalized_content,
        p.tags,
        ups.curation_status,
        ups.curation_note,
        ups.is_bookmarked,
        ups.is_todo,
        p.last_seen_at,
        null::int as application_id,
        null::text as application_status
      from job_postings p
      join sources s on s.id = p.source_id
      left join user_posting_states ups
        on ups.job_posting_id = p.id
        and ups.user_id = ${viewer.id}
      where p.id = ${Number(posting.id)}
      limit 1
    `;
    return serializePosting(rows[0]);
  });
}

export async function createManualApplication(payload: {
  application_method: string;
  applied_at?: string | null;
  apply_end_date?: string | null;
  apply_period_raw?: string | null;
  apply_start_date?: string | null;
  company_name: string;
  curation_note?: string | null;
  curation_status: string;
  detail_url?: string | null;
  external_apply_url?: string | null;
  is_bookmarked: boolean;
  is_todo: boolean;
  job_title: string;
  normalized_content: string;
  note: string;
  platform_name: string;
  posted_at?: string | null;
  resume_template_id: number;
  status: string;
  tags: string[];
}) {
  const viewer = await requireViewer();
  return sql.begin(async (tx) => {
    const templateRows = await tx<Record<string, unknown>[]>`
      select id, title, markdown_content
      from resume_templates
      where id = ${payload.resume_template_id}
        and user_id = ${viewer.id}
      limit 1
    `;
    const template = templateRows[0];
    if (!template) {
      throw new Error("Resume template not found.");
    }

    const posting = await buildManualPosting(tx, {
      ...payload,
      title: payload.job_title,
    });
    const state = await getOrCreatePostingState(tx, viewer.id, Number(posting.id));
    await tx`
      update user_posting_states
      set
        curation_status = ${payload.curation_status},
        curation_note = ${normalizeWhitespace(payload.curation_note ?? "") || null},
        is_bookmarked = ${payload.is_bookmarked || payload.is_todo},
        is_todo = ${payload.is_todo},
        updated_at = timezone('utc', now())
      where id = ${Number(state.id)}
    `;

    const applicationRows = await tx<{ id: number }[]>`
      insert into applications (
        user_id,
        job_posting_id,
        resume_template_id,
        application_method,
        status,
        note,
        applied_at,
        apply_end_date_snapshot,
        apply_period_raw_snapshot,
        resume_snapshot_title,
        resume_snapshot_markdown,
        created_at,
        updated_at
      )
      values (
        ${viewer.id},
        ${Number(posting.id)},
        ${payload.resume_template_id},
        ${payload.application_method},
        ${payload.status},
        ${payload.note},
        ${parseDateInput(payload.applied_at)},
        ${asIsoDate(posting.apply_end_date as Date | string | null)},
        ${posting.apply_period_raw ? String(posting.apply_period_raw) : null},
        ${`${String(template.title)} · ${String(posting.company_name)}`},
        ${String(template.markdown_content ?? "")},
        timezone('utc', now()),
        timezone('utc', now())
      )
      returning id
    `;

    const application = await loadApplicationByIdInternal(viewer.id, applicationRows[0].id, tx);
    if (!application) {
      throw new Error("Application could not be reloaded.");
    }
    return application;
  });
}

export async function patchApplication(
  applicationId: number,
  payload: {
    applied_at: string | null;
    note: string;
    resume_snapshot_markdown: string;
    resume_snapshot_title: string;
    resume_template_id: number | null;
    status: string;
  },
) {
  const viewer = await requireViewer();
  return sql.begin(async (tx) => {
    if (payload.resume_template_id != null) {
      const resumeRows = await tx<{ id: number }[]>`
        select id
        from resume_templates
        where id = ${payload.resume_template_id}
          and user_id = ${viewer.id}
        limit 1
      `;
      if (resumeRows.length === 0) {
        throw new Error("Resume template not found.");
      }
    }

    const rows = await tx<{ id: number }[]>`
      update applications
      set
        status = ${payload.status},
        note = ${payload.note},
        applied_at = ${parseDateInput(payload.applied_at)},
        resume_template_id = ${payload.resume_template_id},
        resume_snapshot_title = ${payload.resume_snapshot_title},
        resume_snapshot_markdown = ${payload.resume_snapshot_markdown},
        updated_at = timezone('utc', now())
      where id = ${applicationId}
        and user_id = ${viewer.id}
      returning id
    `;
    if (!rows[0]) {
      throw new Error("Application not found.");
    }
    const application = await loadApplicationByIdInternal(viewer.id, applicationId, tx);
    if (!application) {
      throw new Error("Application could not be reloaded.");
    }
    return application;
  });
}

export async function getApplicationCoverLetterItems(applicationId: number) {
  const viewer = await requireViewer();
  const rows = await sql<Record<string, unknown>[]>`
    select
      cli.id,
      cli.application_id,
      cli.question,
      cli.answer_markdown,
      cli.order_index,
      coalesce(array_remove(array_agg(distinct clt.label), null), '{}'::text[]) as tags,
      jp.company_name,
      jp.title as job_title,
      cli.created_at,
      cli.updated_at
    from cover_letter_items cli
    join applications a on a.id = cli.application_id
    join job_postings jp on jp.id = a.job_posting_id
    left join cover_letter_item_tags clit on clit.cover_letter_item_id = cli.id
    left join cover_letter_tags clt on clt.id = clit.cover_letter_tag_id
    where a.user_id = ${viewer.id}
      and cli.application_id = ${applicationId}
    group by cli.id, jp.company_name, jp.title
    order by cli.order_index asc, cli.id asc
  `;
  return rows.map(serializeCoverLetterItem);
}

export async function getCoverLetterLibraryPage(filters?: {
  page?: number;
  page_size?: number;
  tag?: string;
}) {
  const viewer = await requireViewer();
  const normalizedTag = filters?.tag ? normalizeCoverLetterTag(filters.tag) : null;
  const page = Math.max(1, Number(filters?.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters?.page_size ?? 20)));
  const offset = (page - 1) * pageSize;

  const filterSql = normalizedTag
    ? sql`
        exists (
          select 1
          from cover_letter_item_tags fclit
          join cover_letter_tags fclt on fclt.id = fclit.cover_letter_tag_id
          where fclit.cover_letter_item_id = cli.id
            and fclt.name = ${normalizedTag}
        )
      `
    : sql`true`;

  const countRows = await sql<{ count: number }[]>`
    select count(*)::int as count
    from cover_letter_items cli
    join applications a on a.id = cli.application_id
    where a.user_id = ${viewer.id}
      and ${filterSql}
  `;
  const totalCount = Number(countRows[0]?.count ?? 0);
  const totalPages = totalCount === 0 ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));
  const resolvedPage = Math.min(page, totalPages);
  const resolvedOffset = (resolvedPage - 1) * pageSize;

  const rows = await sql<Record<string, unknown>[]>`
    with page_ids as (
      select cli.id
      from cover_letter_items cli
      join applications a on a.id = cli.application_id
      where a.user_id = ${viewer.id}
        and ${filterSql}
      order by cli.updated_at desc, cli.id desc
      limit ${pageSize}
      offset ${resolvedOffset}
    )
    select
      cli.id,
      cli.application_id,
      cli.question,
      cli.answer_markdown,
      cli.order_index,
      coalesce(array_remove(array_agg(distinct clt.label), null), '{}'::text[]) as tags,
      jp.company_name,
      jp.title as job_title,
      cli.created_at,
      cli.updated_at
    from page_ids
    join cover_letter_items cli on cli.id = page_ids.id
    join applications a on a.id = cli.application_id
    join job_postings jp on jp.id = a.job_posting_id
    left join cover_letter_item_tags clit on clit.cover_letter_item_id = cli.id
    left join cover_letter_tags clt on clt.id = clit.cover_letter_tag_id
    group by cli.id, jp.company_name, jp.title
    order by cli.updated_at desc, cli.id desc
  `;

  return {
    has_next: resolvedPage < totalPages,
    has_prev: resolvedPage > 1,
    items: rows.map(serializeCoverLetterItem),
    page: resolvedPage,
    page_size: pageSize,
    total_count: totalCount,
    total_pages: totalPages,
  } satisfies CoverLetterItemPage;
}

export async function postCoverLetterItem(
  applicationId: number,
  payload: {
    answer_markdown: string;
    question: string;
    tags: string[];
  },
) {
  const viewer = await requireViewer();
  return sql.begin(async (tx) => {
    const applicationRows = await tx<Record<string, unknown>[]>`
      select id, application_method
      from applications
      where id = ${applicationId}
        and user_id = ${viewer.id}
      limit 1
    `;
    const application = applicationRows[0];
    if (!application) {
      throw new Error("Application not found.");
    }
    if (String(application.application_method) !== "cover_letter") {
      throw new Error("Cover letter items can only be added to cover letter applications.");
    }

    const indexRows = await tx<{ next_index: number | null }[]>`
      select max(order_index)::int as next_index
      from cover_letter_items
      where application_id = ${applicationId}
    `;
    const nextIndex = Number(indexRows[0]?.next_index ?? -1) + 1;
    const itemRows = await tx<{ id: number }[]>`
      insert into cover_letter_items (
        application_id,
        question,
        answer_markdown,
        order_index,
        created_at,
        updated_at
      )
      values (
        ${applicationId},
        ${payload.question},
        ${payload.answer_markdown},
        ${nextIndex},
        timezone('utc', now()),
        timezone('utc', now())
      )
      returning id
    `;

    const tags = await resolveCoverLetterTagIds(tx, viewer.id, payload.tags);
    for (const tag of tags) {
      await tx`
        insert into cover_letter_item_tags (cover_letter_item_id, cover_letter_tag_id)
        values (${itemRows[0].id}, ${tag.id})
        on conflict do nothing
      `;
    }

    const items = await tx<Record<string, unknown>[]>`
      select
        cli.id,
        cli.application_id,
        cli.question,
        cli.answer_markdown,
        cli.order_index,
        coalesce(array_remove(array_agg(distinct clt.label), null), '{}'::text[]) as tags,
        jp.company_name,
        jp.title as job_title,
        cli.created_at,
        cli.updated_at
      from cover_letter_items cli
      join applications a on a.id = cli.application_id
      join job_postings jp on jp.id = a.job_posting_id
      left join cover_letter_item_tags clit on clit.cover_letter_item_id = cli.id
      left join cover_letter_tags clt on clt.id = clit.cover_letter_tag_id
      where a.user_id = ${viewer.id}
        and cli.id = ${itemRows[0].id}
      group by cli.id, jp.company_name, jp.title
      limit 1
    `;
    if (!items[0]) {
      throw new Error("Cover letter item could not be reloaded.");
    }
    return serializeCoverLetterItem(items[0]);
  });
}

export async function patchCoverLetterItem(
  itemId: number,
  payload: {
    answer_markdown: string;
    order_index: number;
    question: string;
    tags: string[];
  },
) {
  const viewer = await requireViewer();
  return sql.begin(async (tx) => {
    const itemRows = await tx<{ application_id: number; id: number }[]>`
      select cli.id, cli.application_id
      from cover_letter_items cli
      join applications a on a.id = cli.application_id
      where cli.id = ${itemId}
        and a.user_id = ${viewer.id}
      limit 1
    `;
    if (!itemRows[0]) {
      throw new Error("Cover letter item not found.");
    }

    await tx`
      update cover_letter_items
      set
        question = ${payload.question},
        answer_markdown = ${payload.answer_markdown},
        order_index = ${payload.order_index},
        updated_at = timezone('utc', now())
      where id = ${itemId}
    `;
    await tx`
      delete from cover_letter_item_tags
      where cover_letter_item_id = ${itemId}
    `;
    const tags = await resolveCoverLetterTagIds(tx, viewer.id, payload.tags);
    for (const tag of tags) {
      await tx`
        insert into cover_letter_item_tags (cover_letter_item_id, cover_letter_tag_id)
        values (${itemId}, ${tag.id})
        on conflict do nothing
      `;
    }

    const rows = await tx<Record<string, unknown>[]>`
      select
        cli.id,
        cli.application_id,
        cli.question,
        cli.answer_markdown,
        cli.order_index,
        coalesce(array_remove(array_agg(distinct clt.label), null), '{}'::text[]) as tags,
        jp.company_name,
        jp.title as job_title,
        cli.created_at,
        cli.updated_at
      from cover_letter_items cli
      join applications a on a.id = cli.application_id
      join job_postings jp on jp.id = a.job_posting_id
      left join cover_letter_item_tags clit on clit.cover_letter_item_id = cli.id
      left join cover_letter_tags clt on clt.id = clit.cover_letter_tag_id
      where a.user_id = ${viewer.id}
        and cli.id = ${itemId}
      group by cli.id, jp.company_name, jp.title
      limit 1
    `;
    return serializeCoverLetterItem(rows[0]);
  });
}

export async function deleteCoverLetterItem(itemId: number) {
  const viewer = await requireViewer();
  const rows = await sql<{ id: number }[]>`
    delete from cover_letter_items cli
    using applications a
    where cli.application_id = a.id
      and cli.id = ${itemId}
      and a.user_id = ${viewer.id}
    returning cli.id
  `;
  if (rows.length === 0) {
    throw new Error("Cover letter item not found.");
  }
}

export async function getCalendarMonth(month: string) {
  const viewer = await requireViewer();
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    throw new Error("Month must be formatted as YYYY-MM.");
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error("Month must be between 01 and 12.");
  }

  const monthStart = `${match[1]}-${match[2]}-01`;
  const monthEnd = endOfMonth(`${match[1]}-${match[2]}`);

  const postingRows = await sql<Record<string, unknown>[]>`
    select
      p.id,
      p.title,
      p.company_name,
      s.name as source_name,
      s.key as source_key,
      p.apply_end_date,
      p.detail_url,
      p.external_apply_url,
      p.ingest_kind,
      coalesce(ups.is_bookmarked, false) as is_bookmarked,
      coalesce(ups.is_todo, false) as is_todo
    from job_postings p
    join sources s on s.id = p.source_id
    left join user_posting_states ups
      on ups.job_posting_id = p.id
      and ups.user_id = ${viewer.id}
    where p.apply_end_date is not null
      and p.apply_end_date >= ${monthStart}
      and p.apply_end_date <= ${monthEnd}
    order by p.apply_end_date asc, p.company_name asc, p.title asc
  `;

  const applicationRows = await sql<Record<string, unknown>[]>`
    select
      a.id,
      a.status,
      a.application_method,
      a.applied_at,
      a.apply_end_date_snapshot,
      jp.title,
      jp.company_name,
      jp.detail_url,
      jp.external_apply_url,
      s.name as source_name
    from applications a
    join job_postings jp on jp.id = a.job_posting_id
    join sources s on s.id = jp.source_id
    where a.user_id = ${viewer.id}
      and (
        (
          a.status = 'planned'
          and a.apply_end_date_snapshot is not null
          and a.apply_end_date_snapshot >= ${monthStart}
          and a.apply_end_date_snapshot <= ${monthEnd}
        )
        or (
          a.status = 'applied'
          and a.applied_at is not null
          and a.applied_at >= ${monthStart}
          and a.applied_at <= ${monthEnd}
        )
      )
    order by a.updated_at desc, a.id desc
  `;

  const events: CalendarEvent[] = [
    ...postingRows.map((row) => {
      const badges: string[] = [];
      const layerKeys: CalendarEvent["layer_keys"] = ["posting_deadline"];
      if (Boolean(row.is_bookmarked)) {
        layerKeys.push("posting_bookmark");
        badges.push("찜");
      }
      if (Boolean(row.is_todo)) {
        layerKeys.push("posting_todo");
        badges.push("작성 예정");
      }
      if (String(row.ingest_kind) === "manual") {
        badges.push("수동");
      }
      return {
        badges,
        company_name: String(row.company_name),
        date: asIsoDate(row.apply_end_date as Date | string) ?? monthStart,
        detail_url: row.detail_url ? String(row.detail_url) : null,
        external_apply_url: row.external_apply_url ? String(row.external_apply_url) : null,
        href: `/postings?source=${encodeURIComponent(String(row.source_key))}&q=${encodeURIComponent(`${String(row.company_name)} ${String(row.title)}`)}`,
        id: `posting:${row.id}`,
        kind: "posting",
        layer_keys: layerKeys,
        source_label: String(row.source_name),
        status_label: "공고 마감일",
        title: String(row.title),
      } satisfies CalendarEvent;
    }),
    ...applicationRows.map((row) => {
      const planned = String(row.status) === "planned";
      return {
        badges: [String(row.application_method) === "cover_letter" ? "자소서 작성" : "간편지원"],
        company_name: String(row.company_name),
        date: planned
          ? asIsoDate(row.apply_end_date_snapshot as Date | string | null) ?? monthStart
          : asIsoDate(row.applied_at as Date | string | null) ?? monthStart,
        detail_url: row.detail_url ? String(row.detail_url) : null,
        external_apply_url: row.external_apply_url ? String(row.external_apply_url) : null,
        href: `/applications/${row.id}`,
        id: `application:${row.id}:${String(row.status)}`,
        kind: "application",
        layer_keys: planned ? ["application_planned"] : ["application_applied"],
        source_label: String(row.source_name),
        status_label: planned ? "지원 예정" : "지원 완료",
        title: String(row.title),
      } satisfies CalendarEvent;
    }),
  ].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }
    if (left.kind !== right.kind) {
      return left.kind === "application" ? -1 : 1;
    }
    if (left.company_name !== right.company_name) {
      return left.company_name.localeCompare(right.company_name);
    }
    return left.title.localeCompare(right.title);
  });

  return {
    events,
    month: `${match[1]}-${match[2]}`,
    month_end: monthEnd,
    month_start: monthStart,
  } satisfies CalendarMonth;
}

export async function getDashboard() {
  const viewer = await requireViewer();
  const [countRows, sources, recentPostingRows, recentApplicationsRows, recentSyncRunsRows] =
    await Promise.all([
      sql<Record<string, number>[]>`
        select
          (select count(*)::int from job_postings) as total_postings,
          (
            select count(*)::int
            from user_posting_states
            where user_id = ${viewer.id}
              and is_todo is true
          ) as todo_postings,
          (
            select count(*)::int
            from user_posting_states
            where user_id = ${viewer.id}
              and curation_status = 'interesting'
          ) as interesting_postings,
          (
            select count(*)::int
            from applications
            where user_id = ${viewer.id}
              and status not in ('rejected', 'withdrawn')
          ) as active_applications,
          (
            select count(*)::int
            from resume_templates
            where user_id = ${viewer.id}
          ) as resume_count
      `,
      getCachedSources(),
      getRecentDashboardPostingRows(viewer.id, 6),
      getRecentApplicationRows(viewer.id, 6),
      sql<Record<string, unknown>[]>`
        select id, source_id, status, message, inserted_count, updated_count, total_count, started_at, finished_at
        from job_sync_runs
        order by started_at desc
        limit 6
      `,
    ]);

  const counts = countRows[0] ?? {
    active_applications: 0,
    interesting_postings: 0,
    resume_count: 0,
    todo_postings: 0,
    total_postings: 0,
  };

  return {
    active_applications: Number(counts.active_applications ?? 0),
    interesting_postings: Number(counts.interesting_postings ?? 0),
    recent_applications: recentApplicationsRows.slice(0, 6).map(serializeApplication),
    recent_postings: recentPostingRows.map(serializePosting),
    recent_sync_runs: recentSyncRunsRows.map(serializeSyncRun),
    resume_count: Number(counts.resume_count ?? 0),
    sources,
    todo_postings: Number(counts.todo_postings ?? 0),
    total_postings: Number(counts.total_postings ?? 0),
  } satisfies Dashboard;
}

export async function getSourceCrawlInfo(_sourceKey: string): Promise<SourceCrawlInfo> {
  throw new Error("Source crawl info is only available from the local crawler runtime.");
}

export async function postSourceCrawlInfo(
  _sourceKey: string,
  _filters?: RememberSearchFilters,
): Promise<SourceCrawlInfo> {
  throw new Error("Source crawl info is only available from the local crawler runtime.");
}

export async function postSyncSource(
  _sourceKey: string,
  _startPage: number,
  _endPage: number,
  _filters?: RememberSearchFilters,
): Promise<SyncRun> {
  throw new Error("Source sync is only available from the local crawler runtime.");
}
