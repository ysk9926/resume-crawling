import Link from "next/link";

import { SourceSyncConsole } from "@/components/source-sync-console";
import { formatDateTime } from "@/lib/format";
import { getSourceSyncRuns, getSources, summarizeSources } from "@/lib/data";

type PageProps = {
  searchParams?: Promise<{ key?: string }>;
};

function runTone(status: string) {
  if (status === "success") {
    return "success";
  }
  if (status === "failed") {
    return "danger";
  }
  return "neutral";
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const selectedKeyParam = typeof params.key === "string" ? params.key : "";

  const sources = await getSources();
  const stats = summarizeSources(sources);
  const fallbackSource = sources.find((source) => source.supports_sync) ?? sources[0] ?? null;
  const selected =
    sources.find((source) => source.key === selectedKeyParam) ?? fallbackSource;
  const recentRuns = selected ? await getSourceSyncRuns(selected.key, 12) : [];

  return (
    <div className="admin-root">
      <div className="admin-shell">
        <aside className="source-rail">
          <div className="brand-card">
            <div className="section-kicker">Local Only</div>
            <h1>Crawler Admin</h1>
            <p>
              배포 DB를 직접 읽고, Python 크롤러를 로컬에서 즉시 실행하는 분리형 관리자 콘솔입니다.
            </p>
          </div>

          <div className="rail-stats">
            <div className="mini-stat">
              <span className="metric-label">활성 소스</span>
              <strong>{stats.activeSources}</strong>
            </div>
            <div className="mini-stat">
              <span className="metric-label">크롤링 가능</span>
              <strong>{stats.syncCapableSources}</strong>
            </div>
            <div className="mini-stat">
              <span className="metric-label">누적 공고</span>
              <strong>{stats.totalPostings.toLocaleString()}</strong>
            </div>
          </div>

          <nav className="source-list" aria-label="sources">
            {sources.map((source) => {
              const isSelected = selected?.key === source.key;
              return (
                <Link
                  className={`source-link ${isSelected ? "selected" : ""}`}
                  href={`/?key=${encodeURIComponent(source.key)}`}
                  key={source.key}
                >
                  <div className="source-link-header">
                    <strong>{source.name}</strong>
                    <span className={`pill ${source.supports_sync ? "info" : "neutral"}`}>
                      {source.supports_sync ? "crawler" : "manual"}
                    </span>
                  </div>
                  <div className="source-link-meta">
                    <span>{source.posting_count.toLocaleString()}건</span>
                    <span>{formatDateTime(source.last_synced_at)}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="detail-stage">
          <header className="hero-panel">
            <div>
              <div className="section-kicker">Execution Surface</div>
              <h2>{selected?.name ?? "소스를 선택해 주세요"}</h2>
              <p className="muted-copy">
                API 인증 없이 로컬에서만 열리는 관리자 화면입니다. 실제 동기화 결과는 기존 배포 DB에 바로 기록됩니다.
              </p>
            </div>

            <div className="hero-stats">
              <div className="metric-tile">
                <span className="metric-label">마지막 동기화</span>
                <strong>{formatDateTime(stats.lastSyncedAt)}</strong>
              </div>
              <div className="metric-tile">
                <span className="metric-label">선택 소스 공고</span>
                <strong>{selected ? selected.posting_count.toLocaleString() : "-"}</strong>
              </div>
              <div className="metric-tile">
                <span className="metric-label">연결 URL</span>
                <strong className="truncate-inline">{selected?.base_url ?? "-"}</strong>
              </div>
            </div>
          </header>

          {selected ? (
            <section className="workspace-grid">
              <div className="workspace-main">
                <SourceSyncConsole
                  key={selected.key}
                  sourceKey={selected.key}
                  supportsSync={selected.supports_sync}
                />
              </div>

              <div className="workspace-side">
                <div className="admin-card admin-stack">
                  <div className="section-kicker">Selected Source</div>
                  <h3 className="section-title">{selected.key}</h3>
                  <div className="meta-pairs">
                    <div>
                      <span className="metric-label">활성 상태</span>
                      <strong>{selected.is_enabled ? "enabled" : "disabled"}</strong>
                    </div>
                    <div>
                      <span className="metric-label">동기화 지원</span>
                      <strong>{selected.supports_sync ? "yes" : "no"}</strong>
                    </div>
                  </div>
                  <a
                    className="admin-button ghost"
                    href={selected.base_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    원본 페이지 열기
                  </a>
                </div>
              </div>
            </section>
          ) : (
            <div className="admin-card">
              <p className="muted-copy">표시할 소스가 없습니다.</p>
            </div>
          )}

          <section className="admin-card admin-stack">
            <div className="panel-header">
              <div>
                <div className="section-kicker">History</div>
                <h3 className="section-title">최근 동기화 이력</h3>
              </div>
              <span className="metric-label">{recentRuns.length} runs</span>
            </div>

            {recentRuns.length === 0 ? (
              <p className="muted-copy">아직 동기화 이력이 없습니다.</p>
            ) : (
              <div className="table-wrap">
                <table className="run-table">
                  <thead>
                    <tr>
                      <th>run</th>
                      <th>status</th>
                      <th>summary</th>
                      <th>started</th>
                      <th>finished</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRuns.map((run) => (
                      <tr key={run.id}>
                        <td className="mono">#{run.id}</td>
                        <td>
                          <span className={`pill ${runTone(run.status)}`}>{run.status}</span>
                        </td>
                        <td>
                          <div className="table-summary">
                            <strong>{run.total_count.toLocaleString()}건</strong>
                            <span>
                              +{run.inserted_count.toLocaleString()} / ~
                              {run.updated_count.toLocaleString()}
                            </span>
                            {run.message ? <span>{run.message}</span> : null}
                          </div>
                        </td>
                        <td>{formatDateTime(run.started_at)}</td>
                        <td>{formatDateTime(run.finished_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
