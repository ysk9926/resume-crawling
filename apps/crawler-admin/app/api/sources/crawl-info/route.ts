import { NextResponse } from "next/server";

import { runSourceAdminCommand } from "@/lib/python-cli";
import type { SourceCrawlInfo, SourceSearchFilters } from "@/lib/types";

export const runtime = "nodejs";

type RequestBody = {
  filters?: SourceSearchFilters;
  page?: number;
  sourceKey?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RequestBody;
    const sourceKey = String(payload.sourceKey ?? "").trim();
    const page = Number(payload.page ?? 1);

    if (!sourceKey) {
      return NextResponse.json({ error: "sourceKey is required." }, { status: 400 });
    }

    if (!Number.isInteger(page) || page < 1) {
      return NextResponse.json({ error: "page must be an integer >= 1." }, { status: 400 });
    }

    const result = await runSourceAdminCommand<SourceCrawlInfo>({
      command: "crawl-info",
      sourceKey,
      page,
      filters: payload.filters,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "crawl-info failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
