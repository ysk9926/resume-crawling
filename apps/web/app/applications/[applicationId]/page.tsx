import Link from "next/link";

import {
  createCoverLetterItemAction,
  deleteCoverLetterItemAction,
  updateApplicationAction,
  updateCoverLetterItemAction,
} from "@/app/actions";
import {
  ApplicationTabs,
  type ApplicationTabKey,
} from "@/components/applications/application-tabs";
import { CoverLetterTagFilter } from "@/components/applications/cover-letter-tag-filter";
import { CopyTextButton } from "@/components/applications/copy-text-button";
import { ResumeTemplatePicker } from "@/components/applications/resume-template-picker";
import { ApiUnavailable } from "@/components/ui/api-unavailable";
import {
  ActionToastForm,
  ActionToastSubmitButton,
} from "@/components/ui/action-toast-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  ghostLinkStyle,
  inputStyle,
  monoTextareaStyle,
  pageBodyStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  textareaStyle,
} from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getApplication,
  getApplicationCoverLetterItems,
  getCoverLetterLibraryPage,
  getResumes,
} from "@/lib/api";
import { formatDate, formatDateTime, shorten, toInputDate } from "@/lib/format";
import { getApplicationMethodLabel, getApplicationStatusLabel } from "@/lib/status-labels";
import type {
  Application,
  CoverLetterItem,
  CoverLetterItemPage,
  ResumeTemplate,
} from "@/lib/types";

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

type PageProps = {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ tag?: string; page?: string; tab?: string }>;
};

function parseTab(value: string | undefined, isCoverLetter: boolean): ApplicationTabKey {
  if (value === "timeline") return "timeline";
  if (value === "cover" && isCoverLetter) return "cover";
  return "info";
}

export default async function ApplicationDetailPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const applicationId = Number(resolvedParams.applicationId);
  const tag = resolvedSearchParams.tag?.trim() ?? "";
  const page = parsePageNumber(resolvedSearchParams.page);

  if (!Number.isInteger(applicationId) || applicationId < 1) {
    return <ApiUnavailable />;
  }

  const application = await getApplication(applicationId).catch(() => null);
  if (!application) {
    return <ApiUnavailable />;
  }

  const resumeTemplates = await getResumes().catch(() => [] as ResumeTemplate[]);

  const isCoverLetter = application.application_method === "cover_letter";
  const activeTab = parseTab(resolvedSearchParams.tab, isCoverLetter);

  let coverLetterItems: CoverLetterItem[] = [];
  let libraryPage: CoverLetterItemPage | null = null;

  if (isCoverLetter && activeTab === "cover") {
    const [items, pageData] = await Promise.all([
      getApplicationCoverLetterItems(applicationId).catch(() => null),
      getCoverLetterLibraryPage({
        tag: tag || undefined,
        page,
        page_size: 12,
      }).catch(() => null),
    ]);

    if (!items || !pageData) {
      return <ApiUnavailable />;
    }

    coverLetterItems = items;
    libraryPage = pageData;
  }

  const deadlineLabel =
    application.apply_period_raw_snapshot ?? formatDate(application.apply_end_date_snapshot);

  const preservedSearch = (() => {
    const params = new URLSearchParams();
    if (tag) params.set("tag", tag);
    if (page > 1) params.set("page", String(page));
    return params.toString();
  })();
  const basePath = `/applications/${application.id}`;

  return (
    <>
      <PageHeader
        title={`${application.company_name} 지원 관리`}
        description={`${application.source_name} · ${application.job_title}`}
        stats={[
          {
            label: "플랫폼",
            value: application.source_name,
            tone: "muted",
          },
          {
            label: "방식",
            value: getApplicationMethodLabel(application.application_method),
            tone: application.application_method === "cover_letter" ? "accent" : "muted",
          },
          {
            label: "상태",
            value: getApplicationStatusLabel(application.status),
          },
          {
            label: "마감일",
            value: deadlineLabel,
            tone: "muted",
          },
        ]}
        action={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Link href="/applications" style={secondaryButtonStyle}>
              목록
            </Link>
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
                지원 링크
              </a>
            ) : null}
          </div>
        }
      />

      <div style={pageBodyStyle}>
        <ApplicationTabs
          active={activeTab}
          basePath={basePath}
          preservedSearch={preservedSearch}
          hideCoverTab={!isCoverLetter}
        >
          {activeTab === "info" ? (
            <InfoTab
              application={application}
              deadlineLabel={deadlineLabel}
              resumeTemplates={resumeTemplates}
            />
          ) : null}
          {activeTab === "timeline" ? (
            <TimelineTab application={application} deadlineLabel={deadlineLabel} />
          ) : null}
          {activeTab === "cover" && isCoverLetter && libraryPage ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "340px minmax(0, 1fr)",
              minHeight: 0,
            }}
          >
            <section
              style={{
                borderRight: "1px solid var(--rw-border)",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--rw-border)",
                  backgroundColor: "var(--rw-table-header)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--rw-muted)" }}>
                  참고 라이브러리
                </div>
                <CoverLetterTagFilter key={tag} initialTag={tag} />
                <div style={{ fontSize: 11, color: "var(--rw-muted)" }}>
                  {tag
                    ? `태그 "${tag}"와 일치하는 문항만 표시합니다.`
                    : "태그 입력 전에는 전체 문항을 최신순으로 표시합니다."}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto" }}>
                {libraryPage && libraryPage.items.length > 0 ? (
                  <div>
                    {libraryPage.items.map((item) => (
                      <article
                        key={item.id}
                        style={{
                          padding: "14px 18px",
                          borderBottom: "1px solid var(--rw-border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{item.question}</div>
                          <div style={{ marginTop: 4, fontSize: 11, color: "var(--rw-muted)" }}>
                            {item.company_name} · {item.job_title}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            lineHeight: 1.6,
                            whiteSpace: "pre-wrap",
                            color: "var(--rw-foreground)",
                          }}
                        >
                          {shorten(item.answer_markdown, 220)}
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {item.tags.map((itemTag) => (
                            <StatusBadge key={`${item.id}-${itemTag}`} label={itemTag} tone="info" />
                          ))}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>
                            {formatDateTime(item.updated_at)}
                          </span>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <CopyTextButton label="질문 복사" value={item.question} />
                            <CopyTextButton label="답변 복사" value={item.answer_markdown} />
                          </div>
                        </div>
                      </article>
                    ))}

                    <PaginationBar
                      page={libraryPage.page}
                      totalPages={libraryPage.total_pages}
                      totalCount={libraryPage.total_count}
                      baseHref={buildLibraryHref(application.id, tag)}
                    />
                  </div>
                ) : (
                  <EmptyState
                    title="표시할 문항이 없습니다."
                    description={
                      tag
                        ? "입력한 태그와 일치하는 문항이 없습니다."
                        : "아직 저장된 자소서 문항이 없습니다."
                    }
                  />
                )}
              </div>
            </section>

            <section style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--rw-border)",
                  backgroundColor: "var(--rw-table-header)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--rw-muted)",
                }}
              >
                현재 지원 자소서
              </div>

              <div style={{ flex: 1, overflowY: "auto" }}>
                <form
                  action={createCoverLetterItemAction}
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--rw-border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    backgroundColor: "var(--rw-subtle)",
                  }}
                >
                  <input type="hidden" name="applicationId" value={application.id} />
                  <label style={labelStyle}>
                    질문
                    <textarea
                      name="question"
                      rows={2}
                      placeholder="예: 지원 동기와 직무 적합성을 작성해주세요."
                      style={textareaStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    태그
                    <input
                      name="tags"
                      placeholder="예: 동기, 협업, backend"
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    답변
                    <textarea
                      name="answerMarkdown"
                      rows={6}
                      placeholder="저장 즉시 전역 참고 라이브러리에 자동 아카이빙됩니다."
                      style={textareaStyle}
                    />
                  </label>
                  <div>
                    <button type="submit" style={primaryButtonStyle}>
                      문항 추가
                    </button>
                  </div>
                </form>

                {coverLetterItems.length === 0 ? (
                  <EmptyState
                    title="작성된 문항이 없습니다."
                    description="첫 문항을 추가하면 자동으로 전역 라이브러리에도 저장됩니다."
                  />
                ) : (
                  <div>
                    {coverLetterItems.map((item, index) => (
                      <div
                        key={item.id}
                        style={{
                          padding: "16px 20px",
                          borderBottom: "1px solid var(--rw-border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <StatusBadge label={`문항 ${index + 1}`} tone="warning" />
                            <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>
                              저장 시 자동 아카이빙
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>
                            {formatDateTime(item.updated_at)}
                          </span>
                        </div>

                        <form action={updateCoverLetterItemAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <input type="hidden" name="applicationId" value={application.id} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="orderIndex" value={index} />
                          <label style={labelStyle}>
                            질문
                            <textarea name="question" rows={2} defaultValue={item.question} style={textareaStyle} />
                          </label>
                          <label style={labelStyle}>
                            태그
                            <input
                              name="tags"
                              defaultValue={item.tags.join(", ")}
                              style={inputStyle}
                            />
                          </label>
                          <label style={labelStyle}>
                            답변
                            <textarea
                              name="answerMarkdown"
                              rows={10}
                              defaultValue={item.answer_markdown}
                              style={textareaStyle}
                            />
                          </label>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button type="submit" style={primaryButtonStyle}>
                              문항 저장
                            </button>
                          </div>
                        </form>

                        <form action={deleteCoverLetterItemAction}>
                          <input type="hidden" name="applicationId" value={application.id} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <button type="submit" style={ghostLinkStyle}>
                            문항 삭제
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
          ) : null}
        </ApplicationTabs>
      </div>
    </>
  );
}

function parsePageNumber(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function buildLibraryHref(applicationId: number, tag: string) {
  return (page: number) => {
    const search = new URLSearchParams();
    search.set("tab", "cover");
    if (tag) {
      search.set("tag", tag);
    }
    if (page > 1) {
      search.set("page", String(page));
    }
    const suffix = search.toString();
    return suffix ? `/applications/${applicationId}?${suffix}` : `/applications/${applicationId}`;
  };
}

function PaginationBar({
  page,
  totalPages,
  totalCount,
  baseHref,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  baseHref: (page: number) => string;
}) {
  if (totalCount === 0) {
    return null;
  }

  const pages = buildPageWindow(page, totalPages);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 18px",
        borderTop: "1px solid var(--rw-border)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--rw-muted)" }}>
        총 {totalCount.toLocaleString()}건
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {page > 1 ? (
          <Link href={baseHref(page - 1)} style={secondaryButtonStyle}>
            이전
          </Link>
        ) : (
          <span style={{ ...ghostLinkStyle, cursor: "default" }}>이전</span>
        )}

        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} style={{ minWidth: 20, textAlign: "center" }}>
              ...
            </span>
          ) : (
            <Link
              key={item}
              href={baseHref(item)}
              style={{
                ...secondaryButtonStyle,
                minWidth: 36,
                padding: "6px 10px",
                backgroundColor: item === page ? "var(--rw-accent)" : "#ffffff",
                borderColor: item === page ? "var(--rw-accent)" : "var(--rw-border)",
                color: item === page ? "#ffffff" : "var(--rw-foreground)",
              }}
            >
              {item}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link href={baseHref(page + 1)} style={secondaryButtonStyle}>
            다음
          </Link>
        ) : (
          <span style={{ ...ghostLinkStyle, cursor: "default" }}>다음</span>
        )}
      </div>
    </div>
  );
}

function buildPageWindow(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) {
    pages.push("ellipsis");
  }

  for (let current = start; current <= end; current += 1) {
    pages.push(current);
  }

  if (end < totalPages - 1) {
    pages.push("ellipsis");
  }

  pages.push(totalPages);
  return pages;
}

function InfoTab({
  application,
  deadlineLabel,
  resumeTemplates,
}: {
  application: Application;
  deadlineLabel: string;
  resumeTemplates: ResumeTemplate[];
}) {
  return (
    <ActionToastForm
      action={updateApplicationAction}
      errorMessage="지원 현황 저장에 실패했습니다."
      successMessage="지원 현황을 저장했습니다."
    >
      <input type="hidden" name="applicationId" value={application.id} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 0.7fr) 160px 180px",
          gap: 8,
          padding: "16px 24px",
          borderBottom: "1px solid var(--rw-border)",
        }}
      >
        <label style={labelStyle}>
          스냅샷 제목
          <input
            name="resumeSnapshotTitle"
            defaultValue={application.resume_snapshot_title}
            style={inputStyle}
          />
        </label>
        <ResumeTemplatePicker
          templates={resumeTemplates}
          defaultTemplateId={application.resume_template_id}
          resumeTitleInputName="resumeSnapshotTitle"
          resumeMarkdownTextareaName="resumeSnapshotMarkdown"
        />
        <label style={labelStyle}>
          상태
          <select name="status" defaultValue={application.status} style={inputStyle}>
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
        <label style={labelStyle}>
          마감일
          <input
            defaultValue={deadlineLabel}
            disabled
            style={{ ...inputStyle, color: "var(--rw-muted)" }}
          />
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.7fr) minmax(0, 1fr) minmax(0, 1.3fr)",
          gap: 0,
          borderBottom: "1px solid var(--rw-border)",
        }}
      >
        <div
          style={{
            padding: "16px 24px",
            borderRight: "1px solid var(--rw-border)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <label style={{ ...labelStyle, marginBottom: 6 }}>메모</label>
          <textarea
            name="note"
            defaultValue={application.note}
            placeholder="지원 결과, 일정, 준비 포인트 메모"
            style={{ ...textareaStyle, minHeight: 420 }}
          />
        </div>
        <div
          style={{
            padding: "16px 24px",
            borderRight: "1px solid var(--rw-border)",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
              gap: 8,
            }}
          >
            <span style={labelStyle as React.CSSProperties}>공고 원문</span>
            {application.posting_tags.length ? (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {application.posting_tags.slice(0, 4).map((tag) => (
                  <StatusBadge key={tag} label={tag} tone="info" />
                ))}
              </div>
            ) : null}
          </div>
          {application.posting_normalized_content ? (
            <div
              style={{
                flex: 1,
                minHeight: 420,
                overflowY: "auto",
                padding: "12px 14px",
                backgroundColor: "#ffffff",
                border: "1px solid var(--rw-border)",
                borderRadius: 2,
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--rw-foreground)",
              }}
            >
              {application.posting_normalized_content}
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                minHeight: 420,
                padding: "12px 14px",
                backgroundColor: "#ffffff",
                border: "1px dashed var(--rw-border)",
                borderRadius: 2,
                fontSize: 12,
                color: "var(--rw-muted)",
              }}
            >
              수집된 공고 본문이 없습니다. 원문 링크에서 확인하세요.
            </div>
          )}
        </div>
        <div
          style={{
            padding: "16px 24px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <label style={labelStyle}>이력서 스냅샷 (Markdown)</label>
            <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>
              스크롤/리사이즈 가능
            </span>
          </div>
          <textarea
            name="resumeSnapshotMarkdown"
            defaultValue={application.resume_snapshot_markdown}
            style={{ ...monoTextareaStyle, minHeight: 420 }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "10px 24px",
          backgroundColor: "var(--rw-subtle)",
        }}
      >
        <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>
          최종 수정 · {formatDateTime(application.updated_at)}
        </span>
        <ActionToastSubmitButton
          pendingLabel="저장 중..."
          style={primaryButtonStyle}
        >
          지원 현황 저장
        </ActionToastSubmitButton>
      </div>
    </ActionToastForm>
  );
}

type TimelineEventTone = "muted" | "info" | "success" | "warning" | "danger";

type TimelineEvent = {
  date: string;
  label: string;
  detail: string;
  tone: TimelineEventTone;
};

function TimelineTab({
  application,
  deadlineLabel,
}: {
  application: Application;
  deadlineLabel: string;
}) {
  const events: TimelineEvent[] = [];

  events.push({
    date: application.created_at,
    label: "지원 이력 생성",
    detail: "리소스에 지원 항목이 등록되었습니다.",
    tone: "muted",
  });

  if (application.applied_at) {
    events.push({
      date: `${application.applied_at}T00:00:00`,
      label: "지원 제출",
      detail: `지원일: ${formatDate(application.applied_at)}`,
      tone: "info",
    });
  }

  if (application.apply_end_date_snapshot) {
    events.push({
      date: `${application.apply_end_date_snapshot}T23:59:59`,
      label: "공고 마감",
      detail: deadlineLabel,
      tone: "warning",
    });
  }

  const statusTone: TimelineEventTone =
    application.status === "offer"
      ? "success"
      : application.status === "rejected" || application.status === "withdrawn"
        ? "danger"
        : application.status === "applied" ||
            application.status === "document_passed" ||
            application.status === "interview"
          ? "info"
          : "warning";

  events.push({
    date: application.updated_at,
    label: `현재 상태: ${getApplicationStatusLabel(application.status)}`,
    detail: `최종 수정 ${formatDateTime(application.updated_at)}`,
    tone: statusTone,
  });

  events.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div style={{ padding: "24px" }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--rw-muted)",
          marginBottom: 16,
        }}
      >
        지원 흐름과 주요 일정을 시간순으로 보여줍니다. 상세 상태 변경 이력은 향후 별도
        제공됩니다.
      </div>
      <ol className="rw-timeline">
        {events.map((event, index) => (
          <li key={`${event.label}-${index}`} className="rw-timeline-item">
            <span className={`rw-timeline-dot rw-timeline-dot--${event.tone}`} aria-hidden />
            <div className="rw-timeline-content">
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--rw-foreground)" }}>
                  {event.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--rw-muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatDateTime(event.date)}
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--rw-muted)" }}>
                {event.detail}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
