import Link from "next/link";

import { ApiUnavailable } from "@/components/ui/api-unavailable";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SourceSyncControls } from "@/components/ui/source-sync-controls";
import {
  pageBodyStyle,
  sectionTitleStyle,
  tdStyle,
  thStyle,
} from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDashboard } from "@/lib/api";
import { formatDate, formatDateTime, shorten } from "@/lib/format";

export const dynamic = "force-dynamic";

function statusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "success" || status === "interesting" || status === "offer") {
    return "success";
  }
  if (status === "applied" || status === "document_passed" || status === "interview") {
    return "info";
  }
  if (status === "planned") {
    return "warning";
  }
  if (status === "failed" || status === "rejected" || status === "withdrawn") {
    return "danger";
  }
  return "neutral";
}

const sectionLabelRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 24px",
  borderBottom: "1px solid var(--rw-border)",
  backgroundColor: "var(--rw-table-header)",
};

export default async function Home() {
  const dashboard = await getDashboard().catch(() => null);

  if (!dashboard) {
    return <ApiUnavailable />;
  }

  return (
    <>
      <PageHeader
        title="대시보드"
        description="로컬에 수집된 채용 공고와 지원 진행 상황을 한눈에 확인합니다."
        stats={[
          { label: "수집 공고", value: dashboard.total_postings },
          { label: "관심 공고", value: dashboard.interesting_postings, tone: "accent" },
          { label: "진행 지원", value: dashboard.active_applications },
          { label: "이력서 템플릿", value: dashboard.resume_count },
        ]}
      />

      <div style={pageBodyStyle}>
        {/* Sources */}
        <section>
          <div style={sectionLabelRow}>
            <h2 style={sectionTitleStyle}>등록된 수집원</h2>
            <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>
              크롤러는 코드로 등록하고 UI에서는 수동 동기화만 수행합니다.
            </span>
          </div>
          {dashboard.sources.length === 0 ? (
            <EmptyState
              title="등록된 수집원이 없습니다."
              description="apps/api의 crawler registry에 사이트를 추가해야 합니다."
            />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>이름</th>
                  <th style={thStyle}>URL</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>상태</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>누적 공고</th>
                  <th style={thStyle}>마지막 동기화</th>
                  <th style={{ ...thStyle, textAlign: "right", width: 320 }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.sources.map((source) => (
                  <tr key={source.key}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{source.name}</td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "var(--rw-muted)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                      }}
                    >
                      {source.base_url}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <StatusBadge
                        label={source.is_enabled ? "활성" : "비활성"}
                        tone={source.is_enabled ? "success" : "neutral"}
                      />
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 600,
                      }}
                    >
                      {source.posting_count.toLocaleString()}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--rw-muted)" }}>
                      {formatDateTime(source.last_synced_at)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <SourceSyncControls sourceKey={source.key} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Two-column split */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          }}
        >
          {/* Recent postings */}
          <div style={{ borderRight: "1px solid var(--rw-border)", minWidth: 0 }}>
            <div style={sectionLabelRow}>
              <h2 style={sectionTitleStyle}>최근 수집 공고</h2>
              <Link href="/postings" style={{ fontSize: 11, color: "var(--rw-accent)", fontWeight: 600 }}>
                공고 전체 보기 →
              </Link>
            </div>
            {dashboard.recent_postings.length === 0 ? (
              <EmptyState
                title="아직 수집된 공고가 없습니다."
                description="위 동기화 버튼으로 첫 공고를 수집해보세요."
              />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>회사</th>
                    <th style={thStyle}>제목</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>상태</th>
                    <th style={thStyle}>등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recent_postings.slice(0, 8).map((posting) => (
                    <tr key={posting.id}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{posting.company_name}</td>
                      <td style={tdStyle}>
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 380,
                          }}
                        >
                          {posting.title}
                        </div>
                        {posting.normalized_content ? (
                          <div
                            style={{
                              marginTop: 2,
                              fontSize: 11,
                              color: "var(--rw-muted)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 380,
                            }}
                          >
                            {shorten(posting.normalized_content, 90)}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <StatusBadge
                          label={posting.curation_status}
                          tone={statusTone(posting.curation_status)}
                        />
                      </td>
                      <td style={{ ...tdStyle, color: "var(--rw-muted)", fontSize: 11 }}>
                        {formatDate(posting.posted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Right column: apps + sync runs */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div>
              <div style={sectionLabelRow}>
                <h2 style={sectionTitleStyle}>최근 지원 현황</h2>
                <Link
                  href="/applications"
                  style={{ fontSize: 11, color: "var(--rw-accent)", fontWeight: 600 }}
                >
                  전체 보기 →
                </Link>
              </div>
              {dashboard.recent_applications.length === 0 ? (
                <EmptyState
                  title="지원 현황이 없습니다."
                  description="공고 목록에서 이력서를 골라 지원 현황을 생성하세요."
                />
              ) : (
                <div>
                  {dashboard.recent_applications.slice(0, 6).map((application) => (
                    <div
                      key={application.id}
                      style={{
                        padding: "10px 24px",
                        borderBottom: "1px solid var(--rw-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>
                          {application.company_name}
                        </div>
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 11,
                            color: "var(--rw-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {application.job_title} ·{" "}
                          {application.resume_template_title ?? "수동 편집"}
                        </div>
                      </div>
                      <StatusBadge
                        label={application.status}
                        tone={statusTone(application.status)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid var(--rw-border)" }}>
              <div style={sectionLabelRow}>
                <h2 style={sectionTitleStyle}>동기화 이력</h2>
              </div>
              {dashboard.recent_sync_runs.length === 0 ? (
                <EmptyState
                  title="동기화 이력이 없습니다."
                  description="첫 수집을 실행하면 결과가 여기에 기록됩니다."
                />
              ) : (
                <div>
                  {dashboard.recent_sync_runs.slice(0, 6).map((run) => (
                    <div
                      key={run.id}
                      style={{
                        padding: "10px 24px",
                        borderBottom: "1px solid var(--rw-border)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          run #{run.id}
                        </span>
                        <StatusBadge label={run.status} tone={statusTone(run.status)} />
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: "var(--rw-muted)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatDateTime(run.started_at)} · +{run.inserted_count} / ~{run.updated_count}
                      </div>
                      {run.message ? (
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 11,
                            color: "var(--rw-muted)",
                          }}
                        >
                          {run.message}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
