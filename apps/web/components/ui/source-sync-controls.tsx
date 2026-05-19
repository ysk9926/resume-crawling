"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import {
  fetchFilteredSourceCrawlInfoAction,
  fetchSourceCrawlInfoAction,
  syncSourceRangeAction,
} from "@/app/actions";
import { buildRememberSearchUrl, REMEMBER_COMPANY_SIZE_OPTIONS } from "@/lib/remember";
import type {
  RememberAddressFilter,
  RememberIndustryFilter,
  RememberSearchFilters,
  SourceCrawlInfo,
} from "@/lib/types";
import {
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  textareaStyle,
} from "@/components/ui/primitives";

function parsePage(value: string, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${fieldName}는 1 이상의 정수여야 합니다.`);
  }
  return parsed;
}

function parseOptionalNumber(value: string, fieldName: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName}는 0 이상의 정수여야 합니다.`);
  }
  return parsed;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "요청을 처리하지 못했습니다.";
}

function splitListValue(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAddressFilters(value: string): RememberAddressFilter[] | undefined {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  return lines.map((line) => {
    const parts = line
      .split(/[>,/]/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0 || parts.length > 2) {
      throw new Error("지역은 한 줄에 `시/도/구/군` 형식으로 입력해 주세요.");
    }

    return {
      level1: parts[0],
      ...(parts[1] ? { level2: parts[1] } : {}),
    };
  });
}

function parseIndustryFilters(value: string): RememberIndustryFilter[] | undefined {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  return lines.map((line) => {
    const parts = line
      .split(">")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0 || parts.length > 3) {
      throw new Error("산업/업종은 한 줄에 `대분류 > 중분류 > 소분류` 형식으로 입력해 주세요.");
    }

    return {
      level1: parts[0],
      ...(parts[1] ? { level2: parts[1] } : {}),
      ...(parts[2] ? { level3: parts[2] } : {}),
    };
  });
}

const filterPanelStyle: CSSProperties = {
  width: 320,
  maxWidth: "100%",
  padding: 10,
  border: "1px solid var(--rw-border)",
  backgroundColor: "#ffffff",
  display: "grid",
  gap: 10,
};

const filterLabelStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 10,
  fontWeight: 700,
  color: "var(--rw-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const checkboxLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "var(--rw-foreground)",
};

const helperTextStyle: CSSProperties = {
  fontSize: 10,
  color: "var(--rw-muted)",
  lineHeight: 1.5,
};

type SourceSyncControlsProps = {
  sourceKey: string;
};

export function SourceSyncControls({ sourceKey }: SourceSyncControlsProps) {
  const router = useRouter();
  const isRemember = sourceKey === "remember";

  const [startPage, setStartPage] = useState("1");
  const [endPage, setEndPage] = useState("1");
  const [keywordInput, setKeywordInput] = useState("");
  const [minSalaryInput, setMinSalaryInput] = useState("");
  const [maxSalaryInput, setMaxSalaryInput] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [industryInput, setIndustryInput] = useState("");
  const [careerMode, setCareerMode] = useState<"all" | "irrelevant">("all");
  const [companySizes, setCompanySizes] = useState<string[]>([]);
  const [leaderPositionOnly, setLeaderPositionOnly] = useState(false);
  const [includeHeadhunter, setIncludeHeadhunter] = useState(true);
  const [simpleApplyOnly, setSimpleApplyOnly] = useState(false);
  const [includeApplied, setIncludeApplied] = useState(false);
  const [crawlInfo, setCrawlInfo] = useState<SourceCrawlInfo | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isInfoPending, startInfoTransition] = useTransition();
  const [isSyncPending, startSyncTransition] = useTransition();

  const buildRememberFilters = (): RememberSearchFilters | undefined => {
    if (!isRemember) {
      return undefined;
    }

    const keywords = splitListValue(keywordInput);
    const filters: RememberSearchFilters = {
      ...(keywords.length ? { keywords } : {}),
      ...(minSalaryInput.trim()
        ? { min_salary: parseOptionalNumber(minSalaryInput, "최소 연봉") }
        : {}),
      ...(maxSalaryInput.trim()
        ? { max_salary: parseOptionalNumber(maxSalaryInput, "최대 연봉") }
        : {}),
      ...(addressInput.trim() ? { addresses: parseAddressFilters(addressInput) } : {}),
      ...(industryInput.trim()
        ? { industry_v2_names: parseIndustryFilters(industryInput) }
        : {}),
      ...(careerMode === "irrelevant" ? { career_year: -1 } : {}),
      ...(companySizes.length ? { company_sizes: companySizes } : {}),
      ...(leaderPositionOnly ? { leader_position: true } : {}),
      ...(!includeHeadhunter ? { organization_type: "without_headhunter" as const } : {}),
      ...(simpleApplyOnly ? { application_type: "apply" as const } : {}),
      ...(includeApplied ? { include_applied_job_posting: true } : {}),
    };

    if (
      filters.min_salary !== undefined &&
      filters.max_salary !== undefined &&
      filters.max_salary < filters.min_salary
    ) {
      throw new Error("최대 연봉은 최소 연봉보다 크거나 같아야 합니다.");
    }

    return Object.keys(filters).length > 0 ? filters : undefined;
  };

  const rememberSourceUrl = isRemember
    ? (() => {
        try {
          return buildRememberSearchUrl(
            "https://career.rememberapp.co.kr/job/postings",
            buildRememberFilters(),
          );
        } catch {
          return "https://career.rememberapp.co.kr/job/postings";
        }
      })()
    : null;

  const handleFetchInfo = () => {
    setMessage(null);
    startInfoTransition(async () => {
      try {
        const info = isRemember
          ? await fetchFilteredSourceCrawlInfoAction({
              sourceKey,
              filters: buildRememberFilters(),
            })
          : await fetchSourceCrawlInfoAction(sourceKey);
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
          filters: buildRememberFilters(),
        });
        setMessage(syncRun.message ?? "동기화를 완료했습니다.");
        router.refresh();
      } catch (error) {
        setMessage(getErrorMessage(error));
      }
    });
  };

  const toggleCompanySize = (value: string) => {
    setCompanySizes((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
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

      {isRemember ? (
        <div style={filterPanelStyle}>
          <label style={filterLabelStyle}>
            키워드
            <input
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="백엔드, 데이터"
              style={inputStyle}
              type="text"
              value={keywordInput}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={filterLabelStyle}>
              최소 연봉(만원)
              <input
                inputMode="numeric"
                min={0}
                onChange={(event) => setMinSalaryInput(event.target.value)}
                placeholder="6000"
                style={inputStyle}
                type="number"
                value={minSalaryInput}
              />
            </label>
            <label style={filterLabelStyle}>
              최대 연봉(만원)
              <input
                inputMode="numeric"
                min={0}
                onChange={(event) => setMaxSalaryInput(event.target.value)}
                placeholder="10000"
                style={inputStyle}
                type="number"
                value={maxSalaryInput}
              />
            </label>
          </div>

          <label style={filterLabelStyle}>
            지역
            <textarea
              onChange={(event) => setAddressInput(event.target.value)}
              placeholder={"서울특별시/강남구\n경기도/성남시"}
              rows={2}
              style={{ ...textareaStyle, minHeight: 68 }}
              value={addressInput}
            />
            <span style={helperTextStyle}>한 줄에 하나씩 입력합니다.</span>
          </label>

          <label style={filterLabelStyle}>
            경력
            <select
              onChange={(event) => setCareerMode(event.target.value as "all" | "irrelevant")}
              style={inputStyle}
              value={careerMode}
            >
              <option value="all">전체</option>
              <option value="irrelevant">경력 무관만</option>
            </select>
          </label>

          <div style={{ display: "grid", gap: 6 }}>
            <span style={filterLabelStyle}>기업 유형</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {REMEMBER_COMPANY_SIZE_OPTIONS.map((option) => (
                <label key={option.value} style={checkboxLabelStyle}>
                  <input
                    checked={companySizes.includes(option.value)}
                    onChange={() => toggleCompanySize(option.value)}
                    type="checkbox"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <label style={filterLabelStyle}>
            산업/업종
            <textarea
              onChange={(event) => setIndustryInput(event.target.value)}
              placeholder={"IT·통신 > AI/데이터 > 데이터 분석\n제조 > 전기·전자 > 반도체"}
              rows={2}
              style={{ ...textareaStyle, minHeight: 68 }}
              value={industryInput}
            />
            <span style={helperTextStyle}>한 줄에 하나씩 입력합니다.</span>
          </label>

          <div style={{ display: "grid", gap: 6 }}>
            <span style={filterLabelStyle}>토글</span>
            <label style={checkboxLabelStyle}>
              <input
                checked={leaderPositionOnly}
                onChange={(event) => setLeaderPositionOnly(event.target.checked)}
                type="checkbox"
              />
              <span>리더급 포지션만</span>
            </label>
            <label style={checkboxLabelStyle}>
              <input
                checked={includeHeadhunter}
                onChange={(event) => setIncludeHeadhunter(event.target.checked)}
                type="checkbox"
              />
              <span>헤드헌팅 공고 포함</span>
            </label>
            <label style={checkboxLabelStyle}>
              <input
                checked={simpleApplyOnly}
                onChange={(event) => setSimpleApplyOnly(event.target.checked)}
                type="checkbox"
              />
              <span>간편 지원만</span>
            </label>
            <label style={checkboxLabelStyle}>
              <input
                checked={includeApplied}
                onChange={(event) => setIncludeApplied(event.target.checked)}
                type="checkbox"
              />
              <span>지원한 공고 포함</span>
            </label>
          </div>

          <a
            href={rememberSourceUrl ?? "https://career.rememberapp.co.kr/job/postings"}
            rel="noreferrer"
            style={{ ...secondaryButtonStyle, justifyContent: "center" }}
            target="_blank"
          >
            리멤버 페이지 열기
          </a>
        </div>
      ) : null}

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
          width: "100%",
        }}
      >
        {message}
      </div>
    </div>
  );
}
