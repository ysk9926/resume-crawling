import "server-only";

import postgres from "postgres";

const databaseUrl =
  process.env.SUPABASE_DB_URL ?? process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Database connection string is missing. Set SUPABASE_DB_URL for apps/web runtime.",
  );
}

const globalForSql = globalThis as typeof globalThis & {
  __resumeWorkbenchSql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForSql.__resumeWorkbenchSql ??
  postgres(databaseUrl, {
    idle_timeout: 5,
    max: 5,
    prepare: false,
    transform: {
      undefined: null,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForSql.__resumeWorkbenchSql = sql;
}

export type DbExecutor = {
  [key: string]: any;
  <T = any>(template: TemplateStringsArray, ...parameters: unknown[]): T;
};
