import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

async function handle(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut().catch(() => undefined);

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
