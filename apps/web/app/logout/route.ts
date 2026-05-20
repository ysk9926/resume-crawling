import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:3335";

async function handle(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        "X-Session-Token": token,
      },
      cache: "no-store",
    }).catch(() => undefined);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  const next = request.nextUrl.searchParams.get("next") || "/login";
  return NextResponse.redirect(new URL(next, request.url));
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
