export type SupabaseBrowserConfig = {
  publishableKey: string;
  url: string;
};

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getSupabaseBrowserConfig(): SupabaseBrowserConfig | null {
  const url = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (!url || !publishableKey) {
    return null;
  }

  return {
    publishableKey,
    url,
  };
}

export function requireSupabaseBrowserConfig(): SupabaseBrowserConfig {
  const config = getSupabaseBrowserConfig();
  if (!config) {
    throw new Error(
      "Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return config;
}
