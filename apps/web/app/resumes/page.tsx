import { createResumeAction, updateResumeAction } from "@/app/actions";
import { ApiUnavailable } from "@/components/ui/api-unavailable";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  inputStyle,
  monoTextareaStyle,
  pageBodyStyle,
  primaryButtonStyle,
} from "@/components/ui/primitives";
import { getResumes } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

const defaultMarkdown = `# 이름 / 연락처
- 이메일:
- GitHub:
- 포트폴리오:

# 한 줄 소개
금융/데이터/웹 서비스를 직접 만들고 운영한 경험을 바탕으로, 문제를 빠르게 구조화하고 실제 제품으로 구현합니다.

# 기술 스택
- Python
- FastAPI
- Next.js
- TypeScript
- SQLite / PostgreSQL

# 주요 경력
## 프로젝트 또는 회사명
- 무엇을 만들었는지
- 어떤 역할을 맡았는지
- 어떤 결과를 냈는지

# 지원 포인트
- 이 회사에 맞춰 조정할 문장
`;

const sectionLabelRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 24px",
  borderBottom: "1px solid var(--rw-border)",
  backgroundColor: "var(--rw-table-header)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--rw-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: 0,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)",
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

export default async function ResumesPage() {
  const resumes = await getResumes().catch(() => null);

  if (!resumes) {
    return <ApiUnavailable />;
  }

  const latestUpdate = resumes
    .map((r) => r.updated_at)
    .sort()
    .pop();

  return (
    <>
      <PageHeader
        title="이력서 템플릿"
        description="직무별 기본 버전을 만들고, 지원 시점에 스냅샷으로 복사해 수정합니다."
        stats={[
          { label: "템플릿 수", value: resumes.length, tone: "accent" },
          {
            label: "마지막 수정",
            value: latestUpdate ? formatDateTime(latestUpdate) : "-",
            tone: "muted",
          },
        ]}
      />

      <div style={pageBodyStyle}>
        {/* Create */}
        <section>
          <div style={sectionLabelRow}>
            <h2 style={sectionTitle}>새 템플릿</h2>
            <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>
              기본 마크다운을 그대로 두고 생성한 뒤 아래에서 수정할 수 있습니다.
            </span>
          </div>
          <form action={createResumeAction}>
            <div style={formGridStyle}>
              <input
                name="title"
                placeholder="예: 금융 데이터용 이력서"
                style={inputStyle}
              />
              <input
                name="summary"
                placeholder="어떤 포지션에 쓰는 템플릿인지 요약"
                style={inputStyle}
              />
            </div>
            <div style={editorRow}>
              <textarea
                name="markdownContent"
                rows={16}
                defaultValue={defaultMarkdown}
                style={monoTextareaStyle}
              />
            </div>
            <div style={actionRow}>
              <button type="submit" style={primaryButtonStyle}>
                템플릿 생성
              </button>
            </div>
          </form>
        </section>

        {/* Existing */}
        <section>
          <div style={sectionLabelRow}>
            <h2 style={sectionTitle}>등록된 템플릿</h2>
            <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>
              총 {resumes.length}개
            </span>
          </div>

          {resumes.length === 0 ? (
            <EmptyState
              title="이력서 템플릿이 없습니다."
              description="위 폼에서 첫 템플릿을 만들면 공고별 스냅샷 생성에 사용할 수 있습니다."
            />
          ) : (
            <div>
              {resumes.map((resume) => (
                <details
                  key={resume.id}
                  style={{ borderBottom: "1px solid var(--rw-border)" }}
                >
                  <summary
                    style={{
                      listStyle: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 24px",
                      gap: 16,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{resume.title}</div>
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
                        {resume.summary || "요약 없음"}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--rw-muted)",
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDateTime(resume.updated_at)}
                    </div>
                  </summary>

                  <form
                    action={updateResumeAction}
                    style={{
                      borderTop: "1px solid var(--rw-border)",
                      backgroundColor: "var(--rw-subtle)",
                    }}
                  >
                    <input type="hidden" name="resumeId" value={resume.id} />
                    <div style={formGridStyle}>
                      <input name="title" defaultValue={resume.title} style={inputStyle} />
                      <input name="summary" defaultValue={resume.summary} style={inputStyle} />
                    </div>
                    <div style={editorRow}>
                      <textarea
                        name="markdownContent"
                        rows={20}
                        defaultValue={resume.markdown_content}
                        style={monoTextareaStyle}
                      />
                    </div>
                    <div style={actionRow}>
                      <button type="submit" style={primaryButtonStyle}>
                        템플릿 저장
                      </button>
                    </div>
                  </form>
                </details>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
