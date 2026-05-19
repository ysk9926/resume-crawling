import Link from "next/link";

import { ApplicationRow } from "@/components/applications/application-row";
import { ManualApplicationModal } from "@/components/applications/manual-application-modal";
import { ApiUnavailable } from "@/components/ui/api-unavailable";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { pageBodyStyle, secondaryButtonStyle } from "@/components/ui/primitives";
import { getApplications, getResumes } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Application } from "@/lib/types";

type StatusFilter = "all" | "active" | "offer" | "closed";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

const STATUS_FILTERS: Array<{
  key: StatusFilter;
  label: string;
  match: (status: string) => boolean;
}> = [
  { key: "all", label: "전체", match: () => true },
  {
    key: "active",
    label: "진행 중",
    match: (s) => ["planned", "applied", "document_passed", "interview"].includes(s),
  },
  { key: "offer", label: "오퍼", match: (s) => s === "offer" },
  {
    key: "closed",
    label: "종료",
    match: (s) => ["rejected", "withdrawn"].includes(s),
  },
];

const ROW_GRID_COLUMNS = "92px minmax(0, 1fr) 120px 140px";

type DeadlineInfo = {
  label: string;
  detail: string | null;
  tone: "neutral" | "info" | "warning" | "danger" | "success";
};

function getDeadlineInfo(application: Application): DeadlineInfo {
  const endDate = application.apply_end_date_snapshot;
  if (!endDate) {
    return {
      label: application.apply_period_raw_snapshot ?? "마감일 미정",
      detail: null,
      tone: "neutral",
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(endDate);
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.round((endDay.getTime() - today.getTime()) / msPerDay);

  const formatted = formatDate(endDate);

  if (diff < 0) {
    return { label: "마감", detail: formatted, tone: "neutral" };
  }
  if (diff === 0) {
    return { label: "D-day", detail: formatted, tone: "danger" };
  }
  if (diff <= 3) {
    return { label: `D-${diff}`, detail: formatted, tone: "danger" };
  }
  if (diff <= 7) {
    return { label: `D-${diff}`, detail: formatted, tone: "warning" };
  }
  return { label: `D-${diff}`, detail: formatted, tone: "info" };
}

function parseStatusFilter(value: string | undefined): StatusFilter {
  if (value === "active" || value === "offer" || value === "closed") {
    return value;
  }
  return "all";
}

const filterTabsRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "10px 24px",
  borderBottom: "1px solid var(--rw-border)",
  backgroundColor: "var(--rw-table-header)",
};

const filterTabBaseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 12px",
  height: 26,
  borderRadius: 999,
  border: "1px solid var(--rw-border)",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--rw-muted)",
  backgroundColor: "#ffffff",
  textDecoration: "none",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "background-color 150ms ease, color 150ms ease, border-color 150ms ease",
};

const filterTabActiveStyle: React.CSSProperties = {
  ...filterTabBaseStyle,
  backgroundColor: "var(--rw-accent)",
  borderColor: "var(--rw-accent)",
  color: "#ffffff",
};

const filterCountStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  opacity: 0.75,
};

const columnHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: ROW_GRID_COLUMNS,
  alignItems: "center",
  gap: 16,
  padding: "10px 24px",
  borderBottom: "1px solid var(--rw-border)",
  backgroundColor: "var(--rw-table-header)",
  position: "sticky",
  top: 0,
  zIndex: 1,
  fontSize: 10,
  fontWeight: 700,
  color: "var(--rw-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export default async function ApplicationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const activeFilter = parseStatusFilter(params.status);
  const [applications, resumes] = await Promise.all([
    getApplications().catch(() => null),
    getResumes().catch(() => null),
  ]);

  if (!applications || !resumes) {
    return <ApiUnavailable />;
  }

  const counts = {
    total: applications.length,
    simple: applications.filter((a) => a.application_method === "simple").length,
    coverLetter: applications.filter((a) => a.application_method === "cover_letter")
      .length,
    planned: applications.filter((a) => a.status === "planned").length,
    inProgress: applications.filter((a) =>
      ["applied", "document_passed", "interview"].includes(a.status),
    ).length,
    offer: applications.filter((a) => a.status === "offer").length,
    closed: applications.filter((a) =>
      ["rejected", "withdrawn"].includes(a.status),
    ).length,
  };

  const tabCounts: Record<StatusFilter, number> = {
    all: counts.total,
    active: counts.planned + counts.inProgress,
    offer: counts.offer,
    closed: counts.closed,
  };

  const activeFilterConfig =
    STATUS_FILTERS.find((tab) => tab.key === activeFilter) ?? STATUS_FILTERS[0];

  const visibleApplications = applications
    .filter((application) => activeFilterConfig.match(application.status))
    .sort((a, b) => {
      const aDate = a.apply_end_date_snapshot;
      const bDate = b.apply_end_date_snapshot;
      if (aDate && bDate) {
        return aDate.localeCompare(bDate);
      }
      if (aDate) return -1;
      if (bDate) return 1;
      return b.updated_at.localeCompare(a.updated_at);
    });

  return (
    <>
      <PageHeader
        title="지원 현황"
        description="마감일이 임박한 순으로 정렬되며, 행을 클릭하면 요약 모달이 열립니다."
        stats={[
          { label: "전체", value: counts.total },
          { label: "간편지원", value: counts.simple, tone: "muted" },
          { label: "자소서 작성", value: counts.coverLetter, tone: "accent" },
          { label: "지원 예정", value: counts.planned, tone: "muted" },
          { label: "진행 중", value: counts.inProgress, tone: "accent" },
          { label: "오퍼", value: counts.offer },
          { label: "종료", value: counts.closed, tone: "muted" },
        ]}
        action={<ManualApplicationModal resumes={resumes} />}
      />

      <div style={filterTabsRowStyle}>
        {STATUS_FILTERS.map((tab) => {
          const isActive = tab.key === activeFilter;
          const href = tab.key === "all" ? "/applications" : `/applications?status=${tab.key}`;
          return (
            <Link
              key={tab.key}
              href={href}
              style={isActive ? filterTabActiveStyle : filterTabBaseStyle}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
              <span style={filterCountStyle}>{tabCounts[tab.key]}</span>
            </Link>
          );
        })}
      </div>

      <div style={pageBodyStyle}>
        {visibleApplications.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <EmptyState
              title={
                activeFilter === "all"
                  ? "지원 현황이 없습니다."
                  : "이 필터에 해당하는 지원 현황이 없습니다."
              }
              description={
                activeFilter === "all"
                  ? "공고 페이지에서 이력서 템플릿을 골라 지원 현황을 만들거나, 수동으로 지원 이력을 추가할 수 있습니다."
                  : "다른 필터를 선택하거나 전체에서 확인할 수 있습니다."
              }
            />
            {activeFilter === "all" ? (
              <div style={{ paddingBottom: 32 }}>
                <ManualApplicationModal
                  resumes={resumes}
                  triggerStyle={secondaryButtonStyle}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            <div style={columnHeaderStyle}>
              <span>상태</span>
              <span>회사 / 직무</span>
              <span>마감</span>
              <span style={{ textAlign: "right" }}>최근 업데이트</span>
            </div>
            <div role="list">
              {visibleApplications.map((application) => (
                <ApplicationRow
                  key={application.id}
                  application={application}
                  deadline={getDeadlineInfo(application)}
                  gridTemplateColumns={ROW_GRID_COLUMNS}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

