"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import {
  HiOutlineExternalLink,
  HiOutlineRefresh,
  HiOutlineSearch,
} from "react-icons/hi";

import { SourceSyncControls } from "@/components/ui/source-sync-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { sectionTitleStyle } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";
import type { SourceSummary, SyncRun } from "@/lib/types";

type Props = {
  canSync: boolean;
  sources: SourceSummary[];
  selectedKey: string;
  recentRuns: SyncRun[];
};

const listContainerStyle: CSSProperties = {
  width: 280,
  minWidth: 280,
  borderRight: "1px solid var(--rw-border)",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  backgroundColor: "var(--rw-sidebar-bg)",
};

const listHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "10px 16px",
  borderBottom: "1px solid var(--rw-border)",
  backgroundColor: "var(--rw-table-header)",
};

const searchInputStyle: CSSProperties = {
  width: "100%",
  height: 30,
  padding: "6px 10px 6px 30px",
  borderRadius: 4,
  border: "1px solid var(--rw-border)",
  fontSize: 12,
  backgroundColor: "#ffffff",
  color: "var(--rw-foreground)",
  outline: "none",
};

const detailHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  padding: "16px 24px",
  borderBottom: "1px solid var(--rw-border)",
  backgroundColor: "var(--rw-background)",
};

const cardStyle: CSSProperties = {
  border: "1px solid var(--rw-border)",
  borderRadius: 4,
  backgroundColor: "#ffffff",
  overflow: "hidden",
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 16px",
  borderBottom: "1px solid var(--rw-border)",
  backgroundColor: "var(--rw-table-header)",
};

const cardBodyStyle: CSSProperties = {
  padding: 16,
};

function runStatusTone(status: string): "success" | "danger" | "warning" | "info" | "neutral" {
  if (status === "success") return "success";
  if (status === "failed") return "danger";
  if (status === "running") return "info";
  if (status === "partial") return "warning";
  return "neutral";
}

function syncRunSummary(run: SyncRun): string {
  const delta = `+${run.inserted_count.toLocaleString()} / ~${run.updated_count.toLocaleString()}`;
  if (run.total_count) {
    return `${delta} · ${run.total_count.toLocaleString()}건`;
  }
  return delta;
}

export function SourceWorkspace({ canSync, sources, selectedKey, recentRuns }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filteredSources = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sources;
    return sources.filter((source) =>
      source.name.toLowerCase().includes(normalized) ||
      source.base_url.toLowerCase().includes(normalized) ||
      source.key.toLowerCase().includes(normalized),
    );
  }, [sources, query]);

  const selected = sources.find((source) => source.key === selectedKey) ?? sources[0];

  const navigateTo = (key: string) => {
    router.push(`/sources?key=${encodeURIComponent(key)}`);
  };

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <aside style={listContainerStyle}>
        <div style={listHeaderStyle}>
          <h2 style={sectionTitleStyle}>플랫폼</h2>
          <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>
            {filteredSources.length}/{sources.length}
          </span>
        </div>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--rw-border)" }}>
          <div style={{ position: "relative" }}>
            <HiOutlineSearch
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--rw-muted)",
                pointerEvents: "none",
              }}
            />
            <input
              aria-label="플랫폼 검색"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름 또는 URL 검색"
              style={searchInputStyle}
              type="search"
              value={query}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {filteredSources.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                fontSize: 12,
                color: "var(--rw-muted)",
                textAlign: "center",
              }}
            >
              일치하는 플랫폼이 없습니다.
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {filteredSources.map((source) => {
                const isActive = source.key === selected.key;
                return (
                  <li key={source.key}>
                    <button
                      onClick={() => navigateTo(source.key)}
                      style={{
                        all: "unset",
                        boxSizing: "border-box",
                        display: "block",
                        width: "100%",
                        padding: "10px 16px",
                        borderLeft: isActive
                          ? "3px solid var(--rw-accent)"
                          : "3px solid transparent",
                        borderBottom: "1px solid var(--rw-border)",
                        backgroundColor: isActive
                          ? "var(--rw-sidebar-active)"
                          : "transparent",
                        cursor: "pointer",
                      }}
                      type="button"
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--rw-foreground)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {source.name}
                        </span>
                        <StatusBadge
                          label={source.supports_sync ? "크롤링" : "수동"}
                          tone={source.supports_sync ? "info" : "warning"}
                        />
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          fontSize: 11,
                          color: "var(--rw-muted)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <span>{source.posting_count.toLocaleString()}건</span>
                        <span>
                          {source.last_synced_at
                            ? formatDateTime(source.last_synced_at)
                            : "동기화 이력 없음"}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <section
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--rw-subtle)",
        }}
      >
        <div style={detailHeaderStyle}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                }}
              >
                {selected.name}
              </h2>
              <StatusBadge
                label={selected.supports_sync ? "크롤링" : "수동"}
                tone={selected.supports_sync ? "info" : "warning"}
              />
              <StatusBadge
                label={selected.is_enabled ? "활성" : "비활성"}
                tone={selected.is_enabled ? "success" : "neutral"}
              />
            </div>
            <div
              style={{
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                fontSize: 11,
                color: "var(--rw-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 520,
                }}
              >
                {selected.base_url || "—"}
              </span>
              {selected.base_url ? (
                <Link
                  href={selected.base_url}
                  rel="noreferrer"
                  target="_blank"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "var(--rw-accent)",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 600,
                  }}
                >
                  <HiOutlineExternalLink size={12} /> 열기
                </Link>
              ) : null}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, auto))",
              gap: 16,
              fontVariantNumeric: "tabular-nums",
              textAlign: "right",
            }}
          >
            <Stat label="누적 공고" value={selected.posting_count.toLocaleString()} />
            <Stat
              label="마지막 동기화"
              value={selected.last_synced_at ? formatDateTime(selected.last_synced_at) : "없음"}
            />
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 24,
            display: "grid",
            gap: 16,
            alignContent: "start",
          }}
        >
          {selected.supports_sync ? (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <HiOutlineRefresh size={14} style={{ color: "var(--rw-muted)" }} />
                  <h3 style={sectionTitleStyle}>동기화</h3>
                </div>
                <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>
                  페이지 범위를 지정하여 크롤링을 실행합니다.
                </span>
              </div>
              <div style={cardBodyStyle}>
                {canSync ? (
                  <SourceSyncControls key={selected.key} sourceKey={selected.key} variant="inline" />
                ) : (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--rw-muted)",
                      lineHeight: 1.7,
                    }}
                  >
                    웹에서는 동기화를 실행하지 않습니다. 로컬에서 `pnpm dev` 또는 `pnpm api:sync:supabase`로 크롤러를 돌린 뒤, 여기서는 최근 이력만 확인합니다.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={sectionTitleStyle}>수동 등록 플랫폼</h3>
              </div>
              <div
                style={{
                  ...cardBodyStyle,
                  fontSize: 12,
                  color: "var(--rw-muted)",
                  lineHeight: 1.7,
                }}
              >
                이 플랫폼은 자동 크롤링을 지원하지 않습니다. 공고 페이지에서{" "}
                <Link
                  href="/postings"
                  style={{ color: "var(--rw-accent)", fontWeight: 600 }}
                >
                  수동 공고 등록
                </Link>
                을 사용해 공고를 추가하세요.
              </div>
            </div>
          )}

          {selected.supports_sync ? (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={sectionTitleStyle}>동기화 이력</h3>
                <span style={{ fontSize: 11, color: "var(--rw-muted)" }}>
                  최근 {recentRuns.length}건
                </span>
              </div>
              {recentRuns.length === 0 ? (
                <div
                  style={{
                    padding: "32px 16px",
                    textAlign: "center",
                    fontSize: 12,
                    color: "var(--rw-muted)",
                  }}
                >
                  아직 동기화 이력이 없습니다. 로컬 크롤러를 한 번 실행하면 이력이 여기에 표시됩니다.
                </div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {recentRuns.map((run) => (
                    <li
                      key={run.id}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--rw-border)",
                        display: "grid",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          run #{run.id}
                        </span>
                        <StatusBadge label={run.status} tone={runStatusTone(run.status)} />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          fontSize: 11,
                          color: "var(--rw-muted)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <span>{formatDateTime(run.started_at)}</span>
                        <span>{syncRunSummary(run)}</span>
                      </div>
                      {run.message ? (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--rw-muted)",
                            lineHeight: 1.6,
                            wordBreak: "break-word",
                          }}
                        >
                          {run.message}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          color: "var(--rw-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 2, fontSize: 13, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
