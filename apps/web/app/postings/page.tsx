import Link from "next/link";

import {
  createApplicationAction,
  updatePostingCurationAction,
} from "@/app/actions";
import { ManualPostingModal } from "@/components/applications/manual-posting-modal";
import {
  ActionToastForm,
  ActionToastSubmitButton,
} from "@/components/ui/action-toast-form";
import { BookmarkToggle } from "@/components/ui/bookmark-toggle";
import { TodoToggle } from "@/components/ui/todo-toggle";
import { ApiUnavailable } from "@/components/ui/api-unavailable";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  ghostLinkStyle,
  inputStyle,
  pageBodyStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  textareaStyle,
} from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getAllPostingsPage,
  getBookmarkedPostingsPage,
  getIgnoredPostingsPage,
  getInterestingPostingsPage,
  getNewPostingsPage,
  getPostingOverview,
  getResumes,
  getSources,
  getTodoPostingsPage,
} from "@/lib/api";
import type {
  JobPosting,
  JobPostingPage,
  PostingOverview,
  PostingTabKey,
  ResumeTemplate,
} from "@/lib/types";
import { formatDate, shorten } from "@/lib/format";
import {
  getApplicationStatusLabel,
  getPostingCurationLabel,
} from "@/lib/status-labels";

const PAGE_SIZE = 25;
const POSTING_TABS: Array<{
  key: PostingTabKey;
  label: string;
  badgeTone?: "neutral" | "info" | "success" | "warning" | "danger";
}> = [
  { key: "all", label: "전체" },
  { key: "new", label: "검토 전" },
  { key: "interesting", label: "관심", badgeTone: "success" },
  { key: "ignored", label: "제외", badgeTone: "danger" },
  { key: "bookmarked", label: "찜", badgeTone: "success" },
  { key: "todo", label: "작성예정", badgeTone: "warning" },
];

type PageProps = {
  searchParams: Promise<{
    id?: string;
    q?: string;
    source?: string;
    tab?: string;
    page?: string;
  }>;
};

function toneForStatus(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "interesting") return "success";
  if (status === "applied") return "info";
  if (status === "ignored") return "danger";
  return "neutral";
}

export default async function PostingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const source = params.source ?? "";
  const postingId = parsePostingId(params.id);
  const tab = parsePostingTab(params.tab);
  const page = parsePageNumber(params.page);

  const filters = {
    posting_id: postingId,
    q: q || undefined,
    source_key: source || undefined,
    page,
    page_size: PAGE_SIZE,
  };

  const [overview, postingsPage, resumes, sources] = await Promise.all([
    getPostingOverview({
      posting_id: postingId,
      q: q || undefined,
      source_key: source || undefined,
    }).catch(() => null),
    getPostingPageForTab(tab, filters).catch(() => null),
    getResumes().catch(() => null),
    getSources().catch(() => null),
  ]);

  if (!overview || !postingsPage || !resumes || !sources) {
    return <ApiUnavailable />;
  }

  const counts = {
    total: overview.all,
    todo: overview.todo,
    new: overview.new,
    interesting: overview.interesting,
    ignored: overview.ignored,
    bookmarked: overview.bookmarked,
  };
  const activeTab = POSTING_TABS.find((item) => item.key === tab) ?? POSTING_TABS[0];
  const resetHref = buildPostingsHref({ tab });

  return (
    <>
      <PageHeader
        title="공고"
        description="크롤링 공고와 수동 등록 공고를 한 화면에서 관리합니다."
        stats={[
          { label: "전체", value: counts.total },
          { label: "작성예정", value: counts.todo, tone: "accent" },
          { label: "찜", value: counts.bookmarked, tone: "accent" },
          { label: "검토 전", value: counts.new },
          { label: "관심", value: counts.interesting, tone: "accent" },
          { label: "제외", value: counts.ignored, tone: "muted" },
        ]}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 10, color: "var(--rw-muted)", textTransform: "uppercase" }}>
                현재 탭
              </span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {activeTab.label} · {postingsPage.total_count.toLocaleString()}건
              </span>
            </div>
            <ManualPostingModal />
          </div>
        }
      />

      <form
        method="get"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 24px",
          borderBottom: "1px solid var(--rw-border)",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <input type="hidden" name="tab" value={tab} />
        <input type="hidden" name="page" value="1" />
        <input
          name="q"
          defaultValue={q}
          placeholder="회사명 / 제목 / 본문 키워드"
          style={{ ...inputStyle, width: 280 }}
        />
        <select name="source" defaultValue={source} style={inputStyle}>
          <option value="">모든 플랫폼</option>
          {sources.map((item) => (
            <option key={item.key} value={item.key}>
              {item.name}
            </option>
          ))}
        </select>
        <button type="submit" style={primaryButtonStyle}>
          필터 적용
        </button>
        {q || source || postingId != null ? (
          <Link href={resetHref} style={secondaryButtonStyle}>
            초기화
          </Link>
        ) : null}
        {postingId != null ? (
          <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>
            캘린더에서 열린 단일 공고를 보고 있습니다.
          </span>
        ) : null}
      </form>

      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          borderBottom: "1px solid var(--rw-border)",
          overflowX: "auto",
          flexShrink: 0,
        }}
      >
        {POSTING_TABS.map((item) => {
          const isActive = item.key === tab;
          const count = getPostingTabCount(overview, item.key);
          return (
            <Link
              key={item.key}
              href={buildPostingsHref({ tab: item.key, q, source, page: 1 })}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                borderRight: "1px solid var(--rw-border)",
                borderBottom: isActive ? "2px solid var(--rw-accent)" : "2px solid transparent",
                backgroundColor: isActive ? "#ffffff" : "var(--rw-table-header)",
                color: isActive ? "var(--rw-foreground)" : "var(--rw-muted)",
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              <span>{item.label}</span>
              <StatusBadge label={count.toLocaleString()} tone={item.badgeTone ?? "neutral"} />
            </Link>
          );
        })}
      </div>

      <div style={pageBodyStyle}>
        <PaginationBar
          page={postingsPage.page}
          totalPages={postingsPage.total_pages}
          totalCount={postingsPage.total_count}
          baseHrefParams={{ tab, q, source }}
        />

        {postingsPage.items.length === 0 ? (
          <EmptyState
            title="조건에 맞는 공고가 없습니다."
            description={`${activeTab.label} 탭 조건에 맞는 공고가 없습니다.`}
          />
        ) : (
          <div>
            {postingsPage.items.map((posting) => (
              <PostingRow
                key={posting.id}
                posting={posting}
                resumes={resumes}
                defaultOpen={postingId != null && posting.id === postingId}
              />
            ))}
          </div>
        )}

        <PaginationBar
          page={postingsPage.page}
          totalPages={postingsPage.total_pages}
          totalCount={postingsPage.total_count}
          baseHrefParams={{ tab, q, source }}
        />
      </div>
    </>
  );
}

function parsePostingId(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parsePostingTab(value: string | undefined): PostingTabKey {
  if (POSTING_TABS.some((item) => item.key === value)) {
    return value as PostingTabKey;
  }
  return "all";
}

function parsePageNumber(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function getPostingTabCount(overview: PostingOverview, tab: PostingTabKey): number {
  return overview[tab];
}

async function getPostingPageForTab(
  tab: PostingTabKey,
  filters: {
    q?: string;
    source_key?: string;
    page: number;
    page_size: number;
  },
): Promise<JobPostingPage> {
  switch (tab) {
    case "new":
      return getNewPostingsPage(filters);
    case "interesting":
      return getInterestingPostingsPage(filters);
    case "ignored":
      return getIgnoredPostingsPage(filters);
    case "bookmarked":
      return getBookmarkedPostingsPage(filters);
    case "todo":
      return getTodoPostingsPage(filters);
    case "all":
    default:
      return getAllPostingsPage(filters);
  }
}

function buildPostingsHref(params: {
  tab: PostingTabKey;
  q?: string;
  source?: string;
  page?: number;
}) {
  const search = new URLSearchParams();
  if (params.tab !== "all") {
    search.set("tab", params.tab);
  }
  if (params.q) {
    search.set("q", params.q);
  }
  if (params.source) {
    search.set("source", params.source);
  }
  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }

  const suffix = search.toString();
  return suffix ? `/postings?${suffix}` : "/postings";
}

function PaginationBar({
  page,
  totalPages,
  totalCount,
  baseHrefParams,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  baseHrefParams: {
    tab: PostingTabKey;
    q?: string;
    source?: string;
  };
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
        padding: "10px 24px",
        borderBottom: "1px solid var(--rw-border)",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--rw-muted)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        총 {totalCount.toLocaleString()}건 · {page} / {totalPages}페이지
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {page > 1 ? (
          <Link
            href={buildPostingsHref({ ...baseHrefParams, page: page - 1 })}
            style={secondaryButtonStyle}
          >
            이전
          </Link>
        ) : (
          <span style={{ ...ghostLinkStyle, cursor: "default" }}>이전</span>
        )}

        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              style={{ minWidth: 20, textAlign: "center", color: "var(--rw-muted)" }}
            >
              ...
            </span>
          ) : (
            <Link
              key={item}
              href={buildPostingsHref({ ...baseHrefParams, page: item })}
              style={{
                ...secondaryButtonStyle,
                minWidth: 36,
                padding: "6px 10px",
                backgroundColor: item === page ? "var(--rw-accent)" : "#ffffff",
                borderColor: item === page ? "var(--rw-accent)" : "var(--rw-border)",
                color: item === page ? "#ffffff" : "var(--rw-foreground)",
                fontWeight: item === page ? 700 : 500,
              }}
            >
              {item}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link
            href={buildPostingsHref({ ...baseHrefParams, page: page + 1 })}
            style={secondaryButtonStyle}
          >
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

function PostingRow({
  posting,
  resumes,
  defaultOpen = false,
}: {
  posting: JobPosting;
  resumes: ResumeTemplate[];
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen || undefined}
      style={{
        borderBottom: "1px solid var(--rw-border)",
      }}
    >
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          display: "grid",
          gridTemplateColumns: "32px 160px minmax(0,1fr) 110px 90px 110px 320px",
          alignItems: "start",
          padding: "12px 24px",
          gap: 16,
        }}
      >
        <BookmarkToggle postingId={posting.id} isBookmarked={posting.is_bookmarked} />
        <div style={{ paddingTop: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{posting.company_name}</div>
          <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
            <StatusBadge label={posting.source_name} tone="neutral" />
            {posting.ingest_kind === "manual" ? (
              <StatusBadge label="수동" tone="warning" />
            ) : null}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {posting.title}
          </div>
          {posting.is_todo ? (
            <div style={{ marginTop: 4 }}>
              <StatusBadge label="작성예정" tone="warning" />
            </div>
          ) : null}
          {posting.tags.length ? (
            <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {posting.tags.slice(0, 4).map((tag) => (
                <StatusBadge key={tag} label={tag} tone="info" />
              ))}
            </div>
          ) : null}
          {posting.normalized_content ? (
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "var(--rw-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {shorten(posting.normalized_content, 140)}
            </div>
          ) : null}
        </div>
        <div style={{ textAlign: "center", paddingTop: 2 }}>
          <StatusBadge
            label={getPostingCurationLabel(posting.curation_status)}
            tone={toneForStatus(posting.curation_status)}
          />
        </div>
        <div style={{ textAlign: "center", paddingTop: 2 }}>
          {posting.application_status ? (
            <StatusBadge
              label={getApplicationStatusLabel(posting.application_status)}
              tone="success"
            />
          ) : (
            <span style={{ color: "var(--rw-muted)", fontSize: 11 }}>—</span>
          )}
        </div>
        <div
          style={{
            paddingTop: 2,
            color: "var(--rw-muted)",
            fontSize: 11,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatDate(posting.posted_at)}
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <TodoToggle postingId={posting.id} isTodo={posting.is_todo} />
          <a
            href={posting.detail_url}
            target="_blank"
            rel="noreferrer"
            style={secondaryButtonStyle}
          >
            원문
          </a>
          {posting.external_apply_url ? (
            <a
              href={posting.external_apply_url}
              target="_blank"
              rel="noreferrer"
              style={primaryButtonStyle}
            >
              지원
            </a>
          ) : null}
        </div>
      </summary>

      <ExpandBody posting={posting} resumes={resumes} />
    </details>
  );
}

function ExpandBody({ posting, resumes }: { posting: JobPosting; resumes: ResumeTemplate[] }) {
  const periodLabel =
    posting.apply_period_raw ??
    (posting.apply_start_date || posting.apply_end_date
      ? `${formatDate(posting.apply_start_date)} ~ ${formatDate(posting.apply_end_date)}`
      : null);

  return (
    <div
      style={{
        backgroundColor: "var(--rw-subtle)",
        borderTop: "1px solid var(--rw-border)",
      }}
    >
      <section
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--rw-border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--rw-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              공고 상세
            </div>
            <StatusBadge label={posting.source_name} tone="neutral" />
          </div>
          {periodLabel ? (
            <div
              style={{
                fontSize: 11,
                color: "var(--rw-muted)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              접수기간 · {periodLabel}
            </div>
          ) : null}
        </div>
        {posting.normalized_content ? (
          <div
            style={{
              maxHeight: 360,
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
            {posting.normalized_content}
          </div>
        ) : (
          <div
            style={{
              padding: "12px 14px",
              backgroundColor: "#ffffff",
              border: "1px dashed var(--rw-border)",
              borderRadius: 2,
              fontSize: 12,
              color: "var(--rw-muted)",
            }}
          >
            수집된 본문이 없습니다. 원문 링크에서 확인하세요.
          </div>
        )}
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        <ActionToastForm
          action={updatePostingCurationAction}
          errorMessage="공고 메모 저장에 실패했습니다."
          successMessage="공고 메모를 저장했습니다."
          style={{
            padding: "16px 24px",
            borderRight: "1px solid var(--rw-border)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <input type="hidden" name="postingId" value={posting.id} />
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--rw-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            내부 정제
          </div>
          <select
            name="curationStatus"
            defaultValue={posting.curation_status}
            style={inputStyle}
          >
            <option value="new">검토 전</option>
            <option value="interesting">관심</option>
            <option value="ignored">제외</option>
          </select>
          <textarea
            name="curationNote"
            rows={4}
            defaultValue={posting.curation_note ?? ""}
            placeholder="왜 관심 공고인지, 다음 액션이 뭔지 메모"
            style={textareaStyle}
          />
          <div>
            <ActionToastSubmitButton
              pendingLabel="저장 중..."
              style={primaryButtonStyle}
            >
              메모 저장
            </ActionToastSubmitButton>
          </div>
        </ActionToastForm>

        <form
          action={createApplicationAction}
          style={{
            padding: "16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <input type="hidden" name="jobPostingId" value={posting.id} />
          <input type="hidden" name="status" value="planned" />
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--rw-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            지원 현황 만들기
          </div>
          {posting.application_id ? (
            <div
              style={{
                padding: "12px",
                border: "1px solid var(--rw-border)",
                backgroundColor: "#fff",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--rw-foreground)" }}>
                이미 지원 현황이 생성되어 있습니다.
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <StatusBadge
                  label={getApplicationStatusLabel(posting.application_status ?? "planned")}
                  tone="info"
                />
                <Link href={`/applications/${posting.application_id}`} style={secondaryButtonStyle}>
                  지원 관리
                </Link>
              </div>
            </div>
          ) : resumes.length === 0 ? (
            <div
              style={{
                padding: "12px",
                border: "1px dashed var(--rw-border)",
                fontSize: 12,
                color: "var(--rw-muted)",
                backgroundColor: "#fff",
              }}
            >
              먼저 이력서 페이지에서 템플릿을 만들어야 합니다.
            </div>
          ) : (
            <>
              <select name="applicationMethod" defaultValue="simple" style={inputStyle}>
                <option value="simple">간편지원</option>
                <option value="cover_letter">자소서 작성</option>
              </select>
              <select name="resumeTemplateId" defaultValue={resumes[0]?.id} style={inputStyle}>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.title}
                  </option>
                ))}
              </select>
              <textarea
                name="note"
                rows={4}
                placeholder="해당 지원건의 초기 메모"
                style={textareaStyle}
              />
              <div>
                <button type="submit" style={primaryButtonStyle}>
                  지원 현황 생성
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
