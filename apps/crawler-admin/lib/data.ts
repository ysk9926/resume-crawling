import "server-only";

import { sql } from "@/lib/db";
import type { AdminStats, SourceSummary, SyncRun } from "@/lib/types";

type SourceRow = {
  base_url: string;
  id: number;
  is_enabled: boolean;
  key: string;
  last_synced_at: Date | string | null;
  name: string;
  posting_count: number;
  supports_sync: boolean;
};

type SyncRunRow = {
  finished_at: Date | string | null;
  id: number;
  inserted_count: number;
  message: string | null;
  source_id: number;
  started_at: Date | string;
  status: string;
  total_count: number;
  updated_count: number;
};

function asIsoDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : String(value);
}

function serializeSource(row: SourceRow): SourceSummary {
  return {
    id: Number(row.id),
    key: row.key,
    name: row.name,
    base_url: row.base_url,
    is_enabled: Boolean(row.is_enabled),
    supports_sync: Boolean(row.supports_sync),
    last_synced_at: asIsoDateTime(row.last_synced_at),
    posting_count: Number(row.posting_count ?? 0),
  };
}

function serializeSyncRun(row: SyncRunRow): SyncRun {
  return {
    id: Number(row.id),
    source_id: Number(row.source_id),
    status: row.status,
    message: row.message,
    inserted_count: Number(row.inserted_count ?? 0),
    updated_count: Number(row.updated_count ?? 0),
    total_count: Number(row.total_count ?? 0),
    started_at: asIsoDateTime(row.started_at) ?? new Date().toISOString(),
    finished_at: asIsoDateTime(row.finished_at),
  };
}

export async function getSources() {
  const rows = await sql<SourceRow[]>`
    select
      s.id,
      s.key,
      s.name,
      s.base_url,
      s.is_enabled,
      s.supports_sync,
      s.last_synced_at,
      count(jp.id)::int as posting_count
    from sources s
    left join job_postings jp on jp.source_id = s.id
    group by s.id, s.key, s.name, s.base_url, s.is_enabled, s.supports_sync, s.last_synced_at
    order by s.name asc
  `;

  return rows.map(serializeSource);
}

export async function getSourceSyncRuns(sourceKey: string, limit = 12) {
  const rows = await sql<SyncRunRow[]>`
    select
      r.id,
      r.source_id,
      r.status,
      r.message,
      r.inserted_count,
      r.updated_count,
      r.total_count,
      r.started_at,
      r.finished_at
    from job_sync_runs r
    join sources s on s.id = r.source_id
    where s.key = ${sourceKey}
    order by r.started_at desc
    limit ${Math.max(1, Math.min(limit, 50))}
  `;

  return rows.map(serializeSyncRun);
}

export function summarizeSources(sources: SourceSummary[]): AdminStats {
  return {
    activeSources: sources.filter((source) => source.is_enabled).length,
    syncCapableSources: sources.filter((source) => source.supports_sync).length,
    totalPostings: sources.reduce((acc, source) => acc + source.posting_count, 0),
    lastSyncedAt:
      sources
        .map((source) => source.last_synced_at)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null,
  };
}
