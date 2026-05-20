import { ApiUnavailable } from "@/components/ui/api-unavailable";
import { PageHeader } from "@/components/ui/page-header";
import { pageBodyStyle } from "@/components/ui/primitives";
import { SourceWorkspace } from "@/components/ui/source-workspace";
import { getSources, getSourceSyncRuns } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { SourceSummary, SyncRun } from "@/lib/types";

type PageProps = {
  searchParams?: Promise<{ key?: string }>;
};

export default async function SourcesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const selectedKeyParam = typeof params.key === "string" ? params.key : "";

  const sources = await getSources().catch(() => null);

  if (!sources) {
    return <ApiUnavailable />;
  }

  if (sources.length === 0) {
    return (
      <>
        <PageHeader
          title="공고 동기화"
          description="등록된 채용 플랫폼별로 크롤링·동기화를 관리합니다."
        />
        <div style={pageBodyStyle}>
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--rw-muted)",
              fontSize: 12,
            }}
          >
            등록된 플랫폼이 없습니다. 크롤러 등록 후 다시 시도해 주세요.
          </div>
        </div>
      </>
    );
  }

  const fallbackSource = sources.find((source) => source.supports_sync) ?? sources[0];
  const selectedSource =
    sources.find((source) => source.key === selectedKeyParam) ?? fallbackSource;
  const recentRuns: SyncRun[] = selectedSource.supports_sync
    ? await getSourceSyncRuns(selectedSource.key, 12).catch(() => [])
    : [];

  const totalPostings = sources.reduce((acc, source) => acc + source.posting_count, 0);
  const activeCount = sources.filter((source) => source.is_enabled).length;
  const lastSyncedAt = sources
    .map((source) => source.last_synced_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return (
    <>
      <PageHeader
        title="공고 동기화"
        description="플랫폼별 크롤링·필터·동기화 이력을 한 화면에서 관리합니다."
        stats={[
          { label: "플랫폼", value: sources.length },
          { label: "활성", value: activeCount, tone: "accent" },
          { label: "누적 공고", value: totalPostings.toLocaleString() },
          { label: "마지막 동기화", value: formatDateTime(lastSyncedAt) },
        ]}
      />
      <div style={{ ...pageBodyStyle, padding: 0 }}>
        <SourceWorkspace
          canSync={false}
          sources={sources}
          selectedKey={selectedSource.key}
          recentRuns={recentRuns}
        />
      </div>
    </>
  );
}
