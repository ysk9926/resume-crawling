"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { fetchSourceCrawlInfoAction, syncSourceRangeAction } from "@/app/actions";
import {
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from "@/components/ui/primitives";
import type { SourceCrawlInfo } from "@/lib/types";

function parsePage(value: string, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${fieldName}는 1 이상의 정수여야 합니다.`);
  }
  return parsed;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "요청을 처리하지 못했습니다.";
}

type SourceSyncControlsProps = {
  sourceKey: string;
};

export function SourceSyncControls({ sourceKey }: SourceSyncControlsProps) {
  const router = useRouter();
  const [startPage, setStartPage] = useState("1");
  const [endPage, setEndPage] = useState("1");
  const [crawlInfo, setCrawlInfo] = useState<SourceCrawlInfo | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isInfoPending, startInfoTransition] = useTransition();
  const [isSyncPending, startSyncTransition] = useTransition();

  const handleFetchInfo = () => {
    setMessage(null);
    startInfoTransition(async () => {
      try {
        const info = await fetchSourceCrawlInfoAction(sourceKey);
        setCrawlInfo(info);
      } catch (error) {
        setMessage(getErrorMessage(error));
      }
    });
  };

  const handleSync = () => {
    setMessage(null);
    startSyncTransition(async () => {
      try {
        const parsedStartPage = parsePage(startPage, "시작 페이지");
        const parsedEndPage = parsePage(endPage, "종료 페이지");
        if (parsedEndPage < parsedStartPage) {
          throw new Error("종료 페이지는 시작 페이지보다 크거나 같아야 합니다.");
        }
        const syncRun = await syncSourceRangeAction({
          sourceKey,
          startPage: parsedStartPage,
          endPage: parsedEndPage,
        });
        setMessage(syncRun.message ?? "동기화를 완료했습니다.");
        router.refresh();
      } catch (error) {
        setMessage(getErrorMessage(error));
      }
    });
  };

  return (
    <div style={{ display: "grid", justifyItems: "end", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <input
          aria-label={`${sourceKey} 시작 페이지`}
          inputMode="numeric"
          min={1}
          onChange={(event) => setStartPage(event.target.value)}
          style={{ ...inputStyle, width: 58, textAlign: "right" }}
          type="number"
          value={startPage}
        />
        <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>~</span>
        <input
          aria-label={`${sourceKey} 종료 페이지`}
          inputMode="numeric"
          min={1}
          onChange={(event) => setEndPage(event.target.value)}
          style={{ ...inputStyle, width: 58, textAlign: "right" }}
          type="number"
          value={endPage}
        />
        <button
          disabled={isInfoPending || isSyncPending}
          onClick={handleFetchInfo}
          style={{
            ...secondaryButtonStyle,
            cursor: isInfoPending || isSyncPending ? "progress" : secondaryButtonStyle.cursor,
            opacity: isInfoPending || isSyncPending ? 0.7 : 1,
          }}
          type="button"
        >
          {isInfoPending ? "조회 중..." : "총 페이지 조회"}
        </button>
        <button
          disabled={isInfoPending || isSyncPending}
          onClick={handleSync}
          style={{
            ...primaryButtonStyle,
            cursor: isInfoPending || isSyncPending ? "progress" : primaryButtonStyle.cursor,
            opacity: isInfoPending || isSyncPending ? 0.7 : 1,
          }}
          type="button"
        >
          {isSyncPending ? "동기화 중..." : "범위 동기화"}
        </button>
      </div>
      <div style={{ fontSize: 11, color: "var(--rw-muted)", minHeight: 16, textAlign: "right" }}>
        {crawlInfo ? `총 ${crawlInfo.total_pages.toLocaleString()}페이지 · ${crawlInfo.total_items.toLocaleString()}건` : null}
      </div>
      <div
        aria-live="polite"
        style={{
          color: message?.includes("동기화") ? "var(--rw-info)" : "var(--rw-error)",
          fontSize: 11,
          minHeight: 16,
          textAlign: "right",
        }}
      >
        {message}
      </div>
    </div>
  );
}
