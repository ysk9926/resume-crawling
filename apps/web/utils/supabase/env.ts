export type SupabaseBrowserConfig = {
  publishableKey: string;
  url: string;
};

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
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

export function getSiteUrl() {
  const explicitUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicitUrl) {
    return stripTrailingSlash(explicitUrl);
  }

  const vercelUrl =
    normalizeEnvValue(process.env.NEXT_PUBLIC_VERCEL_URL) ??
    normalizeEnvValue(process.env.VERCEL_URL);
  if (vercelUrl) {
    const normalized = vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
    return stripTrailingSlash(normalized);
  }

  return "http://127.0.0.1:3334";
}
