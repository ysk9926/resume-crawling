import { NextResponse } from "next/server";

import { runSourceAdminCommand } from "@/lib/python-cli";
import type { SourceSearchFilters, SyncRun } from "@/lib/types";

export const runtime = "nodejs";

type RequestBody = {
  endPage?: number;
  filters?: SourceSearchFilters;
  sourceKey?: string;
  startPage?: number;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RequestBody;
    const sourceKey = String(payload.sourceKey ?? "").trim();
    const startPage = Number(payload.startPage ?? 1);
    const endPage = Number(payload.endPage ?? 1);

    if (!sourceKey) {
      return NextResponse.json({ error: "sourceKey is required." }, { status: 400 });
    }

    if (!Number.isInteger(startPage) || startPage < 1) {
      return NextResponse.json({ error: "startPage must be an integer >= 1." }, { status: 400 });
    }

    if (!Number.isInteger(endPage) || endPage < startPage) {
      return NextResponse.json(
        { error: "endPage must be an integer >= startPage." },
        { status: 400 },
      );
    }

    const result = await runSourceAdminCommand<SyncRun>({
      command: "sync",
      sourceKey,
      startPage,
      endPage,
      filters: payload.filters,
    });

    if (result.status === "failed") {
      return NextResponse.json(
        { error: result.message ?? "Sync failed." },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
