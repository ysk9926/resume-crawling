export function ApiUnavailable() {
  return (
    <div className="rounded-[30px] border border-rose-200 bg-white/80 p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <h2 className="font-heading text-2xl tracking-[-0.03em] text-slate-950">API에 연결할 수 없습니다.</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
        `apps/api` 서버가 실행되지 않았거나 초기 마이그레이션이 끝나지 않았을 수 있습니다.
        루트에서 `uv sync --project apps/api` 후 `pnpm dev`로 다시 시작하면 됩니다.
      </p>
    </div>
  );
}
