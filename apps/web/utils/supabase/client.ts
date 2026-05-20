import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseBrowserConfig } from "@/utils/supabase/env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (browserClient) {
    return browserClient;
  }

  const { publishableKey, url } = requireSupabaseBrowserConfig();
  browserClient = createBrowserClient(url, publishableKey);
  return browserClient;
}
