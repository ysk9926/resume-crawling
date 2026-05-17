import { createApplicationAction, updatePostingCurationAction } from "@/app/actions";
import { ApiUnavailable } from "@/components/ui/api-unavailable";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  inputStyle,
  pageBodyStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  textareaStyle,
} from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPostings, getResumes, getSources } from "@/lib/api";
import type { JobPosting, ResumeTemplate } from "@/lib/types";
import { formatDate, shorten } from "@/lib/format";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    curation?: string;
    source?: string;
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
  const q = params.q ?? "";
  const curation = params.curation ?? "";
  const source = params.source ?? "";

  const [postings, resumes, sources] = await Promise.all([
    getPostings({
      q: q || undefined,
      curation_status: curation || undefined,
      source_key: source || undefined,
    }).catch(() => null),
    getResumes().catch(() => null),
    getSources().catch(() => null),
  ]);

  if (!postings || !resumes || !sources) {
    return <ApiUnavailable />;
  }

  const counts = {
    total: postings.length,
    new: postings.filter((p) => p.curation_status === "new").length,
    interesting: postings.filter((p) => p.curation_status === "interesting").length,
    ignored: postings.filter((p) => p.curation_status === "ignored").length,
  };

  return (
    <>
      <PageHeader
        title="수집 공고"
        description="원문을 수집한 뒤 상태·메모·지원 여부를 정제합니다."
        stats={[
          { label: "전체", value: counts.total },
          { label: "NEW", value: counts.new },
          { label: "INTERESTING", value: counts.interesting, tone: "accent" },
          { label: "IGNORED", value: counts.ignored, tone: "muted" },
        ]}
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
        <input
          name="q"
          defaultValue={q}
          placeholder="회사명 / 제목 / 본문 키워드"
          style={{ ...inputStyle, width: 280 }}
        />
        <select name="curation" defaultValue={curation} style={inputStyle}>
          <option value="">모든 상태</option>
          <option value="new">new</option>
          <option value="interesting">interesting</option>
          <option value="ignored">ignored</option>
        </select>
        <select name="source" defaultValue={source} style={inputStyle}>
          <option value="">모든 수집원</option>
          {sources.map((item) => (
            <option key={item.key} value={item.key}>
              {item.name}
            </option>
          ))}
        </select>
        <button type="submit" style={primaryButtonStyle}>
          필터 적용
        </button>
        {q || curation || source ? (
          <a href="/postings" style={secondaryButtonStyle}>
            초기화
          </a>
        ) : null}
      </form>

      <div style={pageBodyStyle}>
        {postings.length === 0 ? (
          <EmptyState
            title="조건에 맞는 공고가 없습니다."
            description="검색 조건을 비우거나 먼저 대시보드에서 동기화를 실행하세요."
          />
        ) : (
          <div>
            {postings.map((posting) => (
              <PostingRow key={posting.id} posting={posting} resumes={resumes} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function PostingRow({
  posting,
  resumes,
}: {
  posting: JobPosting;
  resumes: ResumeTemplate[];
}) {
  return (
    <details
      style={{
        borderBottom: "1px solid var(--rw-border)",
      }}
    >
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          display: "grid",
          gridTemplateColumns: "160px minmax(0,1fr) 110px 90px 110px 200px",
          alignItems: "start",
          padding: "12px 24px",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, paddingTop: 2 }}>
          {posting.company_name}
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
            label={posting.curation_status}
            tone={toneForStatus(posting.curation_status)}
          />
        </div>
        <div style={{ textAlign: "center", paddingTop: 2 }}>
          {posting.application_status ? (
            <StatusBadge label={posting.application_status} tone="success" />
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
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
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
              fontSize: 10,
              fontWeight: 700,
              color: "var(--rw-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            공고 상세
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
      <form
        action={updatePostingCurationAction}
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
          <option value="new">new</option>
          <option value="interesting">interesting</option>
          <option value="ignored">ignored</option>
        </select>
        <textarea
          name="curationNote"
          rows={4}
          defaultValue={posting.curation_note ?? ""}
          placeholder="왜 관심 공고인지, 다음 액션이 뭔지 메모"
          style={textareaStyle}
        />
        <div>
          <button type="submit" style={primaryButtonStyle}>
            메모 저장
          </button>
        </div>
      </form>

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
        {resumes.length === 0 ? (
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
                스냅샷 생성
              </button>
            </div>
          </>
        )}
      </form>
      </div>
    </div>
  );
}
