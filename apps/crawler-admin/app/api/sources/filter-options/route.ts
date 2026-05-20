import { NextResponse } from "next/server";

import { runSourceAdminFilterOptions } from "@/lib/python-cli";
import type { SourceFilterOptions } from "@/lib/types";

export const runtime = "nodejs";

type RequestBody = {
  sourceKey?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RequestBody;
    const sourceKey = String(payload.sourceKey ?? "").trim();

    if (!sourceKey) {
      return NextResponse.json({ error: "sourceKey is required." }, { status: 400 });
    }

    const result = await runSourceAdminFilterOptions({ sourceKey });
    return NextResponse.json(result satisfies SourceFilterOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "filter-options failed.";
    const status = message.startsWith("Source does not expose filter options:")
      ? 404
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
