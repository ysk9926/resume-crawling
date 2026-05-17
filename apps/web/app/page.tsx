import Link from "next/link";

import { syncSourceAction } from "@/app/actions";
import { ApiUnavailable } from "@/components/api-unavailable";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatDate, formatDateTime, shorten } from "@/lib/format";
import { getDashboard } from "@/lib/api";

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

export default async function Home() {
  const dashboard = await getDashboard().catch(() => null);

  if (!dashboard) {
    return <ApiUnavailable />;
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "수집된 공고",
            value: dashboard.total_postings,
            helper: "로컬 DB에 저장된 총 공고 수",
          },
          {
            label: "관심 공고",
            value: dashboard.interesting_postings,
            helper: "내부 정제로 `interesting` 처리한 공고",
          },
          {
            label: "진행 중 지원",
            value: dashboard.active_applications,
            helper: "철회/불합격 제외 지원 건",
          },
          {
            label: "이력서 템플릿",
            value: dashboard.resume_count,
            helper: "직무별 기본 이력서 버전 수",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[28px] border border-white/70 bg-white/78 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl"
          >
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
            <p className="mt-3 font-heading text-4xl tracking-[-0.05em] text-slate-950">{item.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.helper}</p>
          </div>
        ))}
      </section>

      <SectionCard
        title="등록된 수집원"
        description="새 사이트는 API의 crawler registry에 코드로 등록하고, UI에서는 수동 동기화만 수행합니다."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {dashboard.sources.map((source) => (
            <article
              key={source.key}
              className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-heading text-2xl tracking-[-0.04em] text-slate-950">{source.name}</h3>
                    <StatusPill label={source.is_enabled ? "활성" : "비활성"} tone={source.is_enabled ? "success" : "neutral"} />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{source.base_url}</p>
                  <div className="mt-3 grid gap-1 text-sm text-slate-600">
                    <p>누적 공고: {source.posting_count}건</p>
                    <p>마지막 동기화: {formatDateTime(source.last_synced_at)}</p>
                  </div>
                </div>
                <form action={syncSourceAction} className="flex items-center gap-3">
                  <input type="hidden" name="sourceKey" value={source.key} />
                  <input type="hidden" name="pageLimit" value="1" />
                  <button
                    type="submit"
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    1페이지 동기화
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="최근 수집 공고"
          description="최근 공고는 공고 페이지에서 메모, 태그 확인, 지원 현황 생성까지 이어집니다."
          action={
            <Link
              href="/postings"
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              공고 전체 보기
            </Link>
          }
        >
          {dashboard.recent_postings.length === 0 ? (
            <EmptyState
              title="아직 수집된 공고가 없습니다."
              description="상단의 동기화 버튼으로 KOFIA 공고를 수집하면 최근 목록이 채워집니다."
            />
          ) : (
            <div className="grid gap-4">
              {dashboard.recent_postings.map((posting) => (
                <article
                  key={posting.id}
                  className="rounded-[24px] border border-slate-200 bg-white/70 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill label={posting.curation_status} tone={statusTone(posting.curation_status)} />
                        {posting.tags.slice(0, 3).map((tag) => (
                          <StatusPill key={tag} label={tag} tone="info" />
                        ))}
                      </div>
                      <h3 className="mt-3 font-heading text-2xl tracking-[-0.04em] text-slate-950">
                        {posting.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {posting.company_name} · {formatDate(posting.posted_at)}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                        {shorten(posting.normalized_content)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={posting.detail_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        상세 원문
                      </a>
                      {posting.external_apply_url ? (
                        <a
                          href={posting.external_apply_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                        >
                          지원 링크
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="grid gap-6">
          <SectionCard title="최근 지원 현황" description="지원 건마다 해당 시점의 이력서 스냅샷이 저장됩니다.">
            {dashboard.recent_applications.length === 0 ? (
              <EmptyState
                title="지원 현황이 없습니다."
                description="공고 목록에서 이력서 템플릿을 골라 지원 현황을 만들면 이력이 쌓입니다."
              />
            ) : (
              <div className="grid gap-3">
                {dashboard.recent_applications.map((application) => (
                  <div key={application.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{application.company_name}</p>
                        <p className="mt-1 text-sm text-slate-500">{application.job_title}</p>
                      </div>
                      <StatusPill label={application.status} tone={statusTone(application.status)} />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      템플릿: {application.resume_template_title ?? "수동 편집"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="동기화 이력" description="최근 수집 실행 결과를 빠르게 확인합니다.">
            {dashboard.recent_sync_runs.length === 0 ? (
              <EmptyState title="동기화 이력이 없습니다." description="첫 수집을 실행하면 이력과 건수가 여기에 기록됩니다." />
            ) : (
              <div className="grid gap-3">
                {dashboard.recent_sync_runs.map((run) => (
                  <div key={run.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">run #{run.id}</p>
                      <StatusPill label={run.status} tone={statusTone(run.status)} />
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{run.message ?? "메시지 없음"}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDateTime(run.started_at)} · inserted {run.inserted_count} / updated {run.updated_count}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
