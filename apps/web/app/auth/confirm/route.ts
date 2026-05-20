import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/calendar";
  }
  return value;
}

function redirectWithMessage(request: NextRequest, pathname: string, params: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNextPath(request.nextUrl.searchParams.get("next"));

  if (!tokenHash || !type) {
    return redirectWithMessage(request, "/login", {
      error: "인증 링크가 올바르지 않습니다. 다시 회원가입 메일을 확인해 주세요.",
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    console.error("auth confirm failed", error);
    return redirectWithMessage(request, "/login", {
      error: "메일 인증을 완료하지 못했습니다. 링크가 만료됐다면 다시 회원가입해 주세요.",
    });
  }

  return redirectWithMessage(request, next, {});
}
