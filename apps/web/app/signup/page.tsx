import type { CSSProperties } from "react";
import Link from "next/link";

import { signupAction } from "@/app/actions";

type PageProps = {
  searchParams?: Promise<{ error?: string }>;
};

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background:
    "linear-gradient(180deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,1) 28%, rgba(255,255,255,1) 100%)",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 460,
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

export default async function SignupPage({ searchParams }: PageProps) {
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
              color: "#059669",
            }}
          >
            Local Account
          </div>
          <h1 style={{ margin: "10px 0 6px", fontSize: 28, lineHeight: 1.1 }}>회원가입</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--rw-muted)", lineHeight: 1.6 }}>
            아이디는 3~32자 영문, 숫자, 점, 대시, 언더스코어를 사용할 수 있습니다.
          </p>
        </div>

        <form action={signupAction} style={{ padding: 28, display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>아이디</span>
            <input name="username" placeholder="ysk9926" required style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>비밀번호</span>
            <input name="password" required style={inputStyle} type="password" />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>비밀번호 확인</span>
            <input name="confirmPassword" required style={inputStyle} type="password" />
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
              backgroundColor: "#059669",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            계정 만들기
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
          <span>첫 가입자는 동기화 권한을 가진 관리자입니다.</span>
          <Link href="/login" style={{ color: "var(--rw-accent)", fontWeight: 700 }}>
            로그인 →
          </Link>
        </div>
      </div>
    </div>
  );
}
