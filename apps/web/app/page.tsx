import Link from "next/link";

import { ApiUnavailable } from "@/components/ui/api-unavailable";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  pageBodyStyle,
  sectionTitleStyle,
  tdStyle,
  thStyle,
} from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDashboard } from "@/lib/api";
import { formatDate, shorten } from "@/lib/format";
import {
  getApplicationStatusLabel,
  getPostingCurationLabel,
} from "@/lib/status-labels";

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
        description="로컬에 등록된 채용 공고와 지원 진행 상황을 한눈에 확인합니다."
        stats={[
          { label: "등록 공고", value: dashboard.total_postings },
          { label: "작성예정", value: dashboard.todo_postings, tone: "accent" },
          { label: "관심 공고", value: dashboard.interesting_postings, tone: "accent" },
          { label: "진행 지원", value: dashboard.active_applications },
          { label: "이력서 템플릿", value: dashboard.resume_count },
        ]}
      />

      <div style={pageBodyStyle}>
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          }}
        >
          {/* Recent postings */}
          <div style={{ borderRight: "1px solid var(--rw-border)", minWidth: 0 }}>
            <div style={sectionLabelRow}>
              <h2 style={sectionTitleStyle}>최근 공고</h2>
              <div style={{ display: "flex", gap: 12 }}>
                <Link
                  href="/sources"
                  style={{ fontSize: 11, color: "var(--rw-muted)", fontWeight: 600 }}
                >
                  동기화 →
                </Link>
                <Link href="/postings" style={{ fontSize: 11, color: "var(--rw-accent)", fontWeight: 600 }}>
                  공고 전체 보기 →
                </Link>
              </div>
            </div>
            {dashboard.recent_postings.length === 0 ? (
              <EmptyState
                title="아직 수집된 공고가 없습니다."
                description="동기화 페이지에서 플랫폼을 골라 첫 공고를 수집해보세요."
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
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{posting.company_name}</div>
                        <div style={{ marginTop: 4 }}>
                          <StatusBadge label={posting.source_name} tone="neutral" />
                        </div>
                      </td>
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
                          label={getPostingCurationLabel(posting.curation_status)}
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

          {/* Right column: applications */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
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
                {dashboard.recent_applications.slice(0, 10).map((application) => (
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
                        {application.source_name} · {application.job_title} ·{" "}
                        {application.resume_template_title ?? "수동 편집"}
                      </div>
                    </div>
                    <StatusBadge
                      label={getApplicationStatusLabel(application.status)}
                      tone={statusTone(application.status)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
