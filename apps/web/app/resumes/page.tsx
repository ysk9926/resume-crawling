import { createResumeAction, updateResumeAction } from "@/app/actions";
import { ApiUnavailable } from "@/components/api-unavailable";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { formatDateTime } from "@/lib/format";
import { getResumes } from "@/lib/api";

export const dynamic = "force-dynamic";

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

export default async function ResumesPage() {
  const resumes = await getResumes().catch(() => null);

  if (!resumes) {
    return <ApiUnavailable />;
  }

  return (
    <div className="grid gap-6">
      <SectionCard
        title="새 이력서 템플릿"
        description="직무별 기본 버전을 만들고, 지원 시점에 스냅샷으로 복사해 수정합니다."
      >
        <form action={createResumeAction} className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <input
              name="title"
              placeholder="예: 금융 데이터용 이력서"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
            />
            <input
              name="summary"
              placeholder="어떤 포지션에 쓰는 템플릿인지 요약"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
            />
          </div>
          <textarea
            name="markdownContent"
            rows={18}
            defaultValue={defaultMarkdown}
            className="rounded-[26px] border border-slate-300 bg-white px-4 py-4 font-mono text-sm leading-7 text-slate-700 outline-none focus:border-emerald-500"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              템플릿 생성
            </button>
          </div>
        </form>
      </SectionCard>

      {resumes.length === 0 ? (
        <EmptyState
          title="이력서 템플릿이 없습니다."
          description="위 폼에서 첫 템플릿을 만들면 공고별 스냅샷 생성에 사용할 수 있습니다."
        />
      ) : (
        <div className="grid gap-5">
          {resumes.map((resume) => (
            <SectionCard
              key={resume.id}
              title={resume.title}
              description={`마지막 수정 ${formatDateTime(resume.updated_at)}`}
            >
              <form action={updateResumeAction} className="grid gap-4">
                <input type="hidden" name="resumeId" value={resume.id} />
                <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                  <input
                    name="title"
                    defaultValue={resume.title}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                  />
                  <input
                    name="summary"
                    defaultValue={resume.summary}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                  />
                </div>
                <textarea
                  name="markdownContent"
                  rows={18}
                  defaultValue={resume.markdown_content}
                  className="rounded-[26px] border border-slate-300 bg-white px-4 py-4 font-mono text-sm leading-7 text-slate-700 outline-none focus:border-emerald-500"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
                  >
                    템플릿 저장
                  </button>
                </div>
              </form>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
