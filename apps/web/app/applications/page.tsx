import { updateApplicationAction } from "@/app/actions";
import { ApiUnavailable } from "@/components/ui/api-unavailable";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  inputStyle,
  monoTextareaStyle,
  pageBodyStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  textareaStyle,
} from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { getApplications } from "@/lib/api";
import { formatDateTime, toInputDate } from "@/lib/format";
import { getApplicationStatusLabel } from "@/lib/status-labels";

export const dynamic = "force-dynamic";

function toneForStatus(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "offer") return "success";
  if (status === "applied" || status === "document_passed" || status === "interview") return "info";
  if (status === "planned") return "warning";
  if (status === "rejected" || status === "withdrawn") return "danger";
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

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 160px",
  gap: 8,
  padding: "16px 24px",
  borderBottom: "1px solid var(--rw-border)",
};

const editorRow: React.CSSProperties = {
  padding: "16px 24px",
  borderBottom: "1px solid var(--rw-border)",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  padding: "12px 24px",
  borderBottom: "1px solid var(--rw-border)",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 10,
  fontWeight: 700,
  color: "var(--rw-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export default async function ApplicationsPage() {
  const applications = await getApplications().catch(() => null);

  if (!applications) {
    return <ApiUnavailable />;
  }

  const counts = {
    total: applications.length,
    planned: applications.filter((a) => a.status === "planned").length,
    inProgress: applications.filter((a) =>
      ["applied", "document_passed", "interview"].includes(a.status),
    ).length,
    offer: applications.filter((a) => a.status === "offer").length,
    rejected: applications.filter((a) =>
      ["rejected", "withdrawn"].includes(a.status),
    ).length,
  };

  return (
    <>
      <PageHeader
        title="지원 현황"
        description="지원 건마다 이력서 스냅샷이 저장되고, 상태와 메모를 함께 추적합니다."
        stats={[
          { label: "전체", value: counts.total },
          { label: "지원 예정", value: counts.planned, tone: "muted" },
          { label: "진행 중", value: counts.inProgress, tone: "accent" },
          { label: "오퍼", value: counts.offer },
          { label: "종료", value: counts.rejected, tone: "muted" },
        ]}
      />

      <div style={pageBodyStyle}>
        {applications.length === 0 ? (
          <EmptyState
            title="지원 현황이 없습니다."
            description="공고 페이지에서 이력서 템플릿을 골라 지원 현황을 만들면 이력서 스냅샷과 상태 추적이 시작됩니다."
          />
        ) : (
          <div>
            {applications.map((application) => (
              <details
                key={application.id}
                style={{ borderBottom: "1px solid var(--rw-border)" }}
              >
                <summary
                  style={{
                    listStyle: "none",
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) 200px 100px 160px",
                    alignItems: "center",
                    gap: 16,
                    padding: "12px 24px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
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
                      {application.job_title}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--rw-muted)" }}>
                    템플릿: {application.resume_template_title ?? "수동 편집"}
                  </div>
                  <div>
                    <StatusBadge
                      label={getApplicationStatusLabel(application.status)}
                      tone={toneForStatus(application.status)}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--rw-muted)",
                      fontVariantNumeric: "tabular-nums",
                      textAlign: "right",
                    }}
                  >
                    {formatDateTime(application.updated_at)}
                  </div>
                </summary>

                <div
                  style={{
                    borderTop: "1px solid var(--rw-border)",
                    backgroundColor: "var(--rw-subtle)",
                  }}
                >
                  <div
                    style={{
                      ...sectionLabelRow,
                      backgroundColor: "transparent",
                      borderBottom: "1px solid var(--rw-border)",
                    }}
                  >
                    <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>
                      바로가기
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <a
                        href={application.detail_url}
                        target="_blank"
                        rel="noreferrer"
                        style={secondaryButtonStyle}
                      >
                        공고 원문
                      </a>
                      {application.external_apply_url ? (
                        <a
                          href={application.external_apply_url}
                          target="_blank"
                          rel="noreferrer"
                          style={primaryButtonStyle}
                        >
                          제출 링크
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <form action={updateApplicationAction}>
                    <input type="hidden" name="applicationId" value={application.id} />
                    <div style={formGridStyle}>
                      <label style={labelStyle}>
                        스냅샷 제목
                        <input
                          name="resumeSnapshotTitle"
                          defaultValue={application.resume_snapshot_title}
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelStyle}>
                        상태
                        <select
                          name="status"
                          defaultValue={application.status}
                          style={inputStyle}
                        >
                          <option value="planned">지원 예정</option>
                          <option value="applied">지원 완료</option>
                          <option value="document_passed">서류 통과</option>
                          <option value="interview">면접 진행</option>
                          <option value="offer">오퍼</option>
                          <option value="rejected">불합격</option>
                          <option value="withdrawn">철회</option>
                        </select>
                      </label>
                      <label style={labelStyle}>
                        지원일
                        <input
                          type="date"
                          name="appliedAt"
                          defaultValue={toInputDate(application.applied_at)}
                          style={inputStyle}
                        />
                      </label>
                    </div>

                    <div style={editorRow}>
                      <label style={{ ...labelStyle, marginBottom: 6 }}>메모</label>
                      <textarea
                        name="note"
                        rows={4}
                        defaultValue={application.note}
                        placeholder="지원 상태, 인터뷰 준비 포인트, 제출 버전 차이 메모"
                        style={textareaStyle}
                      />
                    </div>

                    <div style={editorRow}>
                      <label style={{ ...labelStyle, marginBottom: 6 }}>
                        이력서 스냅샷 (markdown)
                      </label>
                      <textarea
                        name="resumeSnapshotMarkdown"
                        rows={18}
                        defaultValue={application.resume_snapshot_markdown}
                        style={monoTextareaStyle}
                      />
                    </div>

                    <div style={actionRow}>
                      <button type="submit" style={primaryButtonStyle}>
                        지원 현황 저장
                      </button>
                    </div>
                  </form>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
