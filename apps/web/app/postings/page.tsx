import { createApplicationAction, updatePostingCurationAction } from "@/app/actions";
import { ApiUnavailable } from "@/components/api-unavailable";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatDate, shorten } from "@/lib/format";
import { getPostings, getResumes, getSources } from "@/lib/api";

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

  return (
    <div className="grid gap-6">
      <SectionCard
        title="수집 공고"
        description="원문을 먼저 수집하고, 여기서 상태/메모/지원 여부를 정제합니다."
      >
        <form method="get" className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 lg:grid-cols-[1.8fr_1fr_1fr_auto]">
          <input
            name="q"
            defaultValue={q}
            placeholder="회사명, 제목, 본문 키워드 검색"
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500"
          />
          <select
            name="curation"
            defaultValue={curation}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500"
          >
            <option value="">모든 상태</option>
            <option value="new">new</option>
            <option value="interesting">interesting</option>
            <option value="ignored">ignored</option>
          </select>
          <select
            name="source"
            defaultValue={source}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500"
          >
            <option value="">모든 수집원</option>
            {sources.map((item) => (
              <option key={item.key} value={item.key}>
                {item.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            필터 적용
          </button>
        </form>
      </SectionCard>

      {postings.length === 0 ? (
        <EmptyState title="조건에 맞는 공고가 없습니다." description="검색 조건을 비우거나 먼저 대시보드에서 동기화를 실행해보세요." />
      ) : (
        <div className="grid gap-5">
          {postings.map((posting) => (
            <article
              key={posting.id}
              className="rounded-[30px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-4xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill label={posting.source_name} tone="info" />
                    <StatusPill label={posting.curation_status} tone={toneForStatus(posting.curation_status)} />
                    {posting.tags.map((tag) => (
                      <StatusPill key={tag} label={tag} tone="neutral" />
                    ))}
                    {posting.application_status ? (
                      <StatusPill label={`지원:${posting.application_status}`} tone="success" />
                    ) : null}
                  </div>
                  <h2 className="mt-4 font-heading text-3xl tracking-[-0.05em] text-slate-950">{posting.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {posting.company_name} · 등록일 {formatDate(posting.posted_at)} · 접수기간 {posting.apply_period_raw ?? "-"}
                  </p>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    {shorten(posting.normalized_content, 520)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={posting.detail_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    원문 보기
                  </a>
                  {posting.external_apply_url ? (
                    <a
                      href={posting.external_apply_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                    >
                      외부 지원 링크
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <form
                  action={updatePostingCurationAction}
                  className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4"
                >
                  <input type="hidden" name="postingId" value={posting.id} />
                  <div className="grid gap-3">
                    <h3 className="font-semibold text-slate-900">내부 정제</h3>
                    <select
                      name="curationStatus"
                      defaultValue={posting.curation_status}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
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
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      공고 메모 저장
                    </button>
                  </div>
                </form>

                <form
                  action={createApplicationAction}
                  className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4"
                >
                  <input type="hidden" name="jobPostingId" value={posting.id} />
                  <input type="hidden" name="status" value="planned" />
                  <div className="grid gap-3">
                    <h3 className="font-semibold text-slate-900">지원 현황 만들기</h3>
                    {resumes.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                        먼저 이력서 페이지에서 템플릿을 하나 이상 만들어야 합니다.
                      </p>
                    ) : (
                      <>
                        <select
                          name="resumeTemplateId"
                          defaultValue={resumes[0]?.id}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                        >
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
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                        />
                        <button
                          type="submit"
                          className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                        >
                          스냅샷 생성
                        </button>
                      </>
                    )}
                  </div>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
