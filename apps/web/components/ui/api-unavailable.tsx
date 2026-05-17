import { PageHeader } from "./page-header";

export function ApiUnavailable() {
  return (
    <>
      <PageHeader
        title="API에 연결할 수 없습니다"
        description="apps/api 서버가 실행되지 않았거나 초기 마이그레이션이 끝나지 않았을 수 있습니다."
      />
      <div
        style={{
          padding: "24px",
          fontSize: 12,
          color: "var(--rw-muted)",
          lineHeight: 1.7,
        }}
      >
        루트에서 다음 명령을 실행하면 API 서버를 다시 시작할 수 있습니다.
        <pre
          style={{
            marginTop: 12,
            padding: "12px 16px",
            backgroundColor: "var(--rw-subtle)",
            border: "1px solid var(--rw-border)",
            borderRadius: 2,
            fontSize: 12,
            color: "var(--rw-foreground)",
            fontFamily: "var(--font-mono)",
          }}
        >{`uv sync --project apps/api
pnpm dev`}</pre>
      </div>
    </>
  );
}
