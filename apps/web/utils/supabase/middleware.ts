import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseBrowserConfig } from "@/utils/supabase/env";

function nextWithHeaders(request: NextRequest, requestHeaders: Headers) {
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export async function updateSession(request: NextRequest, requestHeaders = request.headers) {
  const config = getSupabaseBrowserConfig();
  if (!config) {
    return nextWithHeaders(request, requestHeaders);
  }

  let response = nextWithHeaders(request, requestHeaders);

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = nextWithHeaders(request, requestHeaders);
        cookiesToSet.forEach(({ name, options, value }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser().catch(() => undefined);
  return response;
}
