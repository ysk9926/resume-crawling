"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  buildJobKoreaSearchFilters,
  buildJobKoreaSearchUrl,
  defaultJobKoreaFilterFormState,
} from "@/lib/jobkorea";
import {
  buildRememberSearchFilters,
  buildRememberSearchUrl,
  defaultRememberFilterFormState,
} from "@/lib/remember";
import type {
  SourceCrawlInfo,
  SourceFilterOptions,
  SourceSearchFilters,
  SyncRun,
} from "@/lib/types";
import { JobKoreaSyncPanel } from "@/components/source-sync-panels/jobkorea-sync-panel";
import { RememberSyncPanel } from "@/components/source-sync-panels/remember-sync-panel";

type SourceSyncConsoleProps = {
  sourceKey: string;
  supportsSync: boolean;
};

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

async function requestJson<T>(url: string, payload: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;

  if (!response.ok) {
    const errorMessage =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "요청에 실패했습니다.";
    throw new Error(errorMessage);
  }

  return body as T;
}

export function SourceSyncConsole({ sourceKey, supportsSync }: SourceSyncConsoleProps) {
  const router = useRouter();
  const isRemember = sourceKey === "remember";
  const isJobKorea = sourceKey === "jobkorea";

  const [startPage, setStartPage] = useState("1");
  const [endPage, setEndPage] = useState("1");
  const [rememberState, setRememberState] = useState(defaultRememberFilterFormState);
  const [jobKoreaState, setJobKoreaState] = useState(defaultJobKoreaFilterFormState);
  const [filterOptions, setFilterOptions] = useState<SourceFilterOptions | null>(null);
  const [filterOptionsError, setFilterOptionsError] = useState<string | null>(null);
  const [crawlInfo, setCrawlInfo] = useState<SourceCrawlInfo | null>(null);
  const [syncRun, setSyncRun] = useState<SyncRun | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isInfoPending, startInfoTransition] = useTransition();
  const [isSyncPending, startSyncTransition] = useTransition();
  const isOptionsLoading = isJobKorea && filterOptions === null && filterOptionsError === null;

  const buildSourceFilters = (): SourceSearchFilters | undefined => {
    if (isRemember) {
      return buildRememberSearchFilters(rememberState);
    }
    if (isJobKorea) {
      return buildJobKoreaSearchFilters(jobKoreaState);
    }
    return undefined;
  };

  const sourcePageUrl = useMemo(() => {
    try {
      if (isRemember) {
        return buildRememberSearchUrl(
          "https://career.rememberapp.co.kr/job/postings",
          buildRememberSearchFilters(rememberState),
        );
      }
      if (isJobKorea) {
        return buildJobKoreaSearchUrl(
          "https://www.jobkorea.co.kr/recruit/joblist",
          buildJobKoreaSearchFilters(jobKoreaState),
        );
      }
    } catch {
      return null;
    }

    return null;
  }, [isJobKorea, isRemember, jobKoreaState, rememberState]);

  useEffect(() => {
    if (!supportsSync || !isJobKorea) {
      return undefined;
    }

    let cancelled = false;

    void requestJson<SourceFilterOptions>("/api/sources/filter-options", { sourceKey })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setFilterOptionsError(null);
        setFilterOptions(result);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const errorMessage = getErrorMessage(error);
        setFilterOptions(null);
        setFilterOptionsError(errorMessage);
        setMessage(errorMessage);
      });

    return () => {
      cancelled = true;
    };
  }, [isJobKorea, sourceKey, supportsSync]);

  const handleFetchInfo = () => {
    setMessage(null);
    startInfoTransition(async () => {
      try {
        const info = await requestJson<SourceCrawlInfo>("/api/sources/crawl-info", {
          sourceKey,
          page: 1,
          filters: buildSourceFilters(),
        });
        setCrawlInfo(info);
      } catch (error) {
        setMessage(getErrorMessage(error));
      }
    });
  };

  const handleSync = () => {
    setMessage(null);
    setSyncRun(null);

    startSyncTransition(async () => {
      try {
        const parsedStartPage = parsePage(startPage, "시작 페이지");
        const parsedEndPage = parsePage(endPage, "종료 페이지");

        if (parsedEndPage < parsedStartPage) {
          throw new Error("종료 페이지는 시작 페이지보다 크거나 같아야 합니다.");
        }

        const result = await requestJson<SyncRun>("/api/sources/sync", {
          sourceKey,
          startPage: parsedStartPage,
          endPage: parsedEndPage,
          filters: buildSourceFilters(),
        });

        setSyncRun(result);
        setMessage(result.message ?? "동기화를 완료했습니다.");
        router.refresh();
      } catch (error) {
        setMessage(getErrorMessage(error));
      }
    });
  };

  const updateRememberState = (patch: Partial<typeof rememberState>) => {
    setRememberState((current) => ({ ...current, ...patch }));
  };

  const updateJobKoreaState = (patch: Partial<typeof jobKoreaState>) => {
    setJobKoreaState((current) => ({ ...current, ...patch }));
  };

  if (!supportsSync) {
    return (
      <div className="admin-card admin-stack">
        <div className="section-kicker">Manual Source</div>
        <h3 className="section-title">자동 크롤링 미지원</h3>
        <p className="muted-copy">
          이 소스는 현재 자동 크롤링 대상이 아닙니다. 별도 수동 입력 플로우에서만 다루도록 유지됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-stack">
      <div className="admin-card admin-stack">
        <div className="section-kicker">Run Control</div>
        <div className="console-toolbar">
          <div className="range-group">
            <label className="field-label">
              시작 페이지
              <input
                className="admin-input narrow"
                inputMode="numeric"
                min={1}
                onChange={(event) => setStartPage(event.target.value)}
                type="number"
                value={startPage}
              />
            </label>
            <label className="field-label">
              종료 페이지
              <input
                className="admin-input narrow"
                inputMode="numeric"
                min={1}
                onChange={(event) => setEndPage(event.target.value)}
                type="number"
                value={endPage}
              />
            </label>
          </div>

          <div className="toolbar-actions">
            <button
              className="admin-button ghost"
              disabled={isInfoPending || isSyncPending || isOptionsLoading}
              onClick={handleFetchInfo}
              type="button"
            >
              {isInfoPending ? "조회 중..." : "총 페이지 조회"}
            </button>
            <button
              className="admin-button"
              disabled={isInfoPending || isSyncPending || isOptionsLoading}
              onClick={handleSync}
              type="button"
            >
              {isSyncPending ? "동기화 중..." : "범위 동기화"}
            </button>
          </div>
        </div>

        {crawlInfo ? (
          <div className="status-strip">
            <span>현재 페이지 {crawlInfo.current_page.toLocaleString()}</span>
            <span>총 {crawlInfo.total_pages.toLocaleString()}페이지</span>
            <span>{crawlInfo.total_items.toLocaleString()}건</span>
          </div>
        ) : null}

        {message ? (
          <div
            className={`callout ${message.includes("동기화") ? "success" : "danger"}`}
            role="status"
          >
            {message}
          </div>
        ) : null}

        {syncRun ? (
          <div className="result-grid">
            <div className="metric-tile">
              <span className="metric-label">Run Status</span>
              <strong>{syncRun.status}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Inserted</span>
              <strong>{syncRun.inserted_count.toLocaleString()}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Updated</span>
              <strong>{syncRun.updated_count.toLocaleString()}</strong>
            </div>
            <div className="metric-tile">
              <span className="metric-label">Total</span>
              <strong>{syncRun.total_count.toLocaleString()}</strong>
            </div>
          </div>
        ) : null}
      </div>

      {isRemember ? (
        <RememberSyncPanel
          sourceUrl={sourcePageUrl ?? "https://career.rememberapp.co.kr/job/postings"}
          state={rememberState}
          updateState={updateRememberState}
        />
      ) : null}

      {isJobKorea ? (
        <JobKoreaSyncPanel
          filterOptions={filterOptions}
          isLoadingOptions={isOptionsLoading}
          sourceUrl={
            sourcePageUrl ?? "https://www.jobkorea.co.kr/recruit/joblist?menucode=search"
          }
          state={jobKoreaState}
          updateState={updateJobKoreaState}
        />
      ) : null}
    </div>
  );
}
