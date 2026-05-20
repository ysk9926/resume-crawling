import { PageHeader } from "./page-header";

export function ApiUnavailable() {
  return (
    <>
      <PageHeader
        title="데이터를 불러올 수 없습니다"
        description="Supabase 연결 정보가 없거나, 로컬 크롤러가 아직 공용 스키마/데이터를 준비하지 않았을 수 있습니다."
      />
      <div
        style={{
          padding: "24px",
          fontSize: 12,
          color: "var(--rw-muted)",
          lineHeight: 1.7,
        }}
        >
        먼저 Supabase 환경변수를 확인하고, 스키마/기준 데이터를 만들기 위해 로컬 크롤러 런타임을 한 번 실행해 주세요.
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
        >{`pnpm dev
# 또는
pnpm dev:api:supabase`}</pre>
      </div>
    </>
  );
}
