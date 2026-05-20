import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions";
import { getViewer } from "@/lib/api";

type PageProps = {
  searchParams?: Promise<{ error?: string }>;
};

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background:
    "linear-gradient(180deg, rgba(14,165,233,0.08) 0%, rgba(255,255,255,1) 28%, rgba(255,255,255,1) 100%)",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 420,
  border: "1px solid var(--rw-border)",
  borderRadius: 8,
  backgroundColor: "#ffffff",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)",
  overflow: "hidden",
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: 42,
  border: "1px solid var(--rw-border)",
  borderRadius: 6,
  padding: "0 12px",
  fontSize: 14,
  outline: "none",
};

export default async function LoginPage({ searchParams }: PageProps) {
  const viewer = await getViewer().catch(() => null);
  if (viewer) {
    redirect("/calendar");
  }

  const params = (await searchParams) ?? {};
  const error = params.error ?? "";

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ padding: "28px 28px 20px", borderBottom: "1px solid var(--rw-border)" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--rw-accent)",
            }}
          >
            Resume Workbench
          </div>
          <h1 style={{ margin: "10px 0 6px", fontSize: 28, lineHeight: 1.1 }}>로그인</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--rw-muted)", lineHeight: 1.6 }}>
            Supabase 계정으로 로그인하면 개인 공고 상태, 이력서, 지원서를 분리해서 관리합니다.
          </p>
        </div>

        <form action={loginAction} style={{ padding: 28, display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>이메일</span>
            <input
              name="email"
              placeholder="you@example.com"
              required
              style={inputStyle}
              type="email"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>비밀번호</span>
            <input name="password" required style={inputStyle} type="password" />
          </label>

          {error ? (
            <div
              style={{
                border: "1px solid #fecaca",
                backgroundColor: "#fef2f2",
                color: "#b91c1c",
                borderRadius: 6,
                padding: "10px 12px",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            style={{
              height: 44,
              border: "none",
              borderRadius: 6,
              backgroundColor: "var(--rw-accent)",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            로그인
          </button>
        </form>

        <div
          style={{
            padding: "0 28px 28px",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 12,
            color: "var(--rw-muted)",
          }}
        >
          <span>계정이 없다면 첫 가입자가 자동 관리자입니다.</span>
          <Link href="/signup" style={{ color: "var(--rw-accent)", fontWeight: 700 }}>
            회원가입 →
          </Link>
        </div>
      </div>
    </div>
  );
}
