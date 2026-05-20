import "server-only";

import postgres from "postgres";

const databaseUrl =
  process.env.SUPABASE_DB_URL ?? process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Database connection string is missing. Set SUPABASE_DB_URL for crawler-admin runtime.",
  );
}

const globalForSql = globalThis as typeof globalThis & {
  __crawlerAdminSql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForSql.__crawlerAdminSql ??
  postgres(databaseUrl, {
    idle_timeout: 5,
    max: 5,
    prepare: false,
    transform: {
      undefined: null,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForSql.__crawlerAdminSql = sql;
}
