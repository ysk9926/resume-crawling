import { updateApplicationAction } from "@/app/actions";
import { ApiUnavailable } from "@/components/api-unavailable";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime, toInputDate } from "@/lib/format";
import { getApplications } from "@/lib/api";

export const dynamic = "force-dynamic";

function toneForStatus(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "offer") return "success";
  if (status === "applied" || status === "document_passed" || status === "interview") return "info";
  if (status === "planned") return "warning";
  if (status === "rejected" || status === "withdrawn") return "danger";
  return "neutral";
}

export default async function ApplicationsPage() {
  const applications = await getApplications().catch(() => null);

  if (!applications) {
    return <ApiUnavailable />;
  }

  return (
    <div className="grid gap-6">
      {applications.length === 0 ? (
        <EmptyState
          title="지원 현황이 없습니다."
          description="공고 페이지에서 이력서 템플릿을 골라 지원 현황을 만들면 이력서 스냅샷과 상태 추적이 시작됩니다."
        />
      ) : (
        applications.map((application) => (
          <SectionCard
            key={application.id}
            title={`${application.company_name} · ${application.job_title}`}
            description={`원본 템플릿 ${application.resume_template_title ?? "없음"} · 마지막 수정 ${formatDateTime(application.updated_at)}`}
            action={<StatusPill label={application.status} tone={toneForStatus(application.status)} />}
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <a
                href={application.detail_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                공고 원문
              </a>
              {application.external_apply_url ? (
                <a
                  href={application.external_apply_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                >
                  제출 링크
                </a>
              ) : null}
            </div>

            <form action={updateApplicationAction} className="grid gap-4">
              <input type="hidden" name="applicationId" value={application.id} />
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.7fr]">
                <input
                  name="resumeSnapshotTitle"
                  defaultValue={application.resume_snapshot_title}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                />
                <select
                  name="status"
                  defaultValue={application.status}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                >
                  <option value="planned">planned</option>
                  <option value="applied">applied</option>
                  <option value="document_passed">document_passed</option>
                  <option value="interview">interview</option>
                  <option value="offer">offer</option>
                  <option value="rejected">rejected</option>
                  <option value="withdrawn">withdrawn</option>
                </select>
                <input
                  type="date"
                  name="appliedAt"
                  defaultValue={toInputDate(application.applied_at)}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                />
              </div>

              <textarea
                name="note"
                rows={4}
                defaultValue={application.note}
                placeholder="지원 상태, 인터뷰 준비 포인트, 제출 버전 차이 메모"
                className="rounded-[24px] border border-slate-300 bg-white px-4 py-4 text-sm leading-7 text-slate-700 outline-none focus:border-emerald-500"
              />

              <textarea
                name="resumeSnapshotMarkdown"
                rows={20}
                defaultValue={application.resume_snapshot_markdown}
                className="rounded-[28px] border border-slate-300 bg-white px-4 py-4 font-mono text-sm leading-7 text-slate-700 outline-none focus:border-emerald-500"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  지원 현황 저장
                </button>
              </div>
            </form>
          </SectionCard>
        ))
      )}
    </div>
  );
}
