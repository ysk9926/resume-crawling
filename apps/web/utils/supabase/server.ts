import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireSupabaseBrowserConfig } from "@/utils/supabase/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = requireSupabaseBrowserConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always persist response cookies.
          // Middleware handles session refresh for those cases.
        }
      },
    },
  });
}
