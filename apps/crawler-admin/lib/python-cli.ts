import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

import type {
  SourceCrawlInfo,
  SourceFilterOptions,
  SourceSearchFilters,
  SyncRun,
} from "@/lib/types";

const execFileAsync = promisify(execFile);

type SourceAdminCommand =
  | {
      command: "crawl-info";
      filters?: SourceSearchFilters;
      page?: number;
      sourceKey: string;
    }
  | {
      command: "filter-options";
      sourceKey: string;
    }
  | {
      command: "sync";
      endPage: number;
      filters?: SourceSearchFilters;
      sourceKey: string;
      startPage: number;
    };

function getRepoRoot() {
  return path.resolve(process.cwd(), "../..");
}

function getApiDir() {
  return process.env.CRAWLER_API_DIR ?? path.resolve(process.cwd(), "../api");
}

function getApiEnvFile() {
  return process.env.CRAWLER_API_ENV_FILE ?? path.resolve(getApiDir(), ".env.supabase");
}

function buildCommandArgs(input: SourceAdminCommand) {
  const args = [
    "run",
    "--directory",
    getApiDir(),
    "--env-file",
    getApiEnvFile(),
    "python",
    "-m",
    "app.scripts.source_admin",
    input.command,
    input.sourceKey,
  ];

  if (input.command === "crawl-info") {
    args.push("--page", String(input.page ?? 1));
  }

  if (input.command === "sync") {
    args.push("--start-page", String(input.startPage));
    args.push("--end-page", String(input.endPage));
  }

  if ("filters" in input && input.filters && Object.keys(input.filters).length > 0) {
    args.push("--filters-json", JSON.stringify(input.filters));
  }

  return args;
}

function extractErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "stderr" in error &&
    typeof error.stderr === "string" &&
    error.stderr.trim()
  ) {
    return error.stderr.trim();
  }

  if (
    error &&
    typeof error === "object" &&
    "stdout" in error &&
    typeof error.stdout === "string" &&
    error.stdout.trim()
  ) {
    return error.stdout.trim();
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Python crawler command failed.";
}

export async function runSourceAdminCommand<
  T extends SourceCrawlInfo | SourceFilterOptions | SyncRun,
>(
  input: SourceAdminCommand,
) {
  try {
    const { stdout } = await execFileAsync("uv", buildCommandArgs(input), {
      cwd: getRepoRoot(),
      maxBuffer: 1024 * 1024 * 10,
      timeout: 1000 * 60 * 20,
    });
    return JSON.parse(stdout) as T;
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}

export async function runSourceAdminFilterOptions(input: { sourceKey: string }) {
  return runSourceAdminCommand<SourceFilterOptions>({
    command: "filter-options",
    sourceKey: input.sourceKey,
  });
}
