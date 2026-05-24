"use client";

import Link from "next/link";
import { useState } from "react";
import type { CSSProperties } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import type {
  CalendarEvent,
  CalendarLayerKey,
  CalendarMonth,
} from "@/lib/types";

type LayerPalette = {
  background: string;
  backgroundSelected: string;
  border: string;
  borderSelected: string;
  color: string;
  checkboxFill: string;
};

const LAYER_PALETTES: Record<CalendarLayerKey, LayerPalette> = {
  posting_deadline: {
    background: "#fef2f2",
    backgroundSelected: "#fecaca",
    border: "#fecaca",
    borderSelected: "#f87171",
    color: "#991b1b",
    checkboxFill: "#dc2626",
  },
  posting_todo: {
    background: "#fff7ed",
    backgroundSelected: "#fed7aa",
    border: "#fdba74",
    borderSelected: "#fb923c",
    color: "#9a3412",
    checkboxFill: "#ea580c",
  },
  posting_bookmark: {
    background: "#ecfdf5",
    backgroundSelected: "#d1fae5",
    border: "#a7f3d0",
    borderSelected: "#34d399",
    color: "#065f46",
    checkboxFill: "#10b981",
  },
  application_planned: {
    background: "#fef3c7",
    backgroundSelected: "#fde68a",
    border: "#fcd34d",
    borderSelected: "#f59e0b",
    color: "#92400e",
    checkboxFill: "#eab308",
  },
  application_applied: {
    background: "#eff6ff",
    backgroundSelected: "#dbeafe",
    border: "#bfdbfe",
    borderSelected: "#60a5fa",
    color: "#1e3a8a",
    checkboxFill: "#2563eb",
  },
};

const LAYER_PRIORITY: CalendarLayerKey[] = [
  "posting_deadline",
  "posting_todo",
  "posting_bookmark",
  "application_planned",
  "application_applied",
];

const FILTER_OPTIONS: Array<{ key: CalendarLayerKey; label: string }> = [
  { key: "posting_deadline", label: "공고 마감일" },
  { key: "posting_bookmark", label: "찜한 공고" },
  { key: "posting_todo", label: "작성 예정" },
  { key: "application_planned", label: "지원 예정" },
  { key: "application_applied", label: "지원 완료" },
];

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MAX_VISIBLE_EVENTS = 3;

function resolveEventLayer(event: CalendarEvent): CalendarLayerKey {
  for (const layer of LAYER_PRIORITY) {
    if (event.layer_keys.includes(layer)) {
      return layer;
    }
  }
  return event.layer_keys[0] ?? "posting_bookmark";
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMonthGrid(monthStart: string) {
  const firstDay = parseIsoDate(monthStart);
  const firstCell = new Date(firstDay);
  firstCell.setDate(firstCell.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(firstCell);
    cellDate.setDate(firstCell.getDate() + index);
    return cellDate;
  });
}

function isLayerActive(event: CalendarEvent, activeLayers: CalendarLayerKey[]) {
  return event.layer_keys.some((item) => activeLayers.includes(item));
}

function sortEvents(left: CalendarEvent, right: CalendarEvent) {
  const leftPriority = left.kind === "application" ? 0 : 1;
  const rightPriority = right.kind === "application" ? 0 : 1;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }
  return left.company_name.localeCompare(right.company_name, "ko");
}

const LAYER_TONE: Record<CalendarLayerKey, "neutral" | "info" | "success" | "warning"> = {
  posting_deadline: "warning",
  posting_todo: "warning",
  posting_bookmark: "success",
  application_planned: "warning",
  application_applied: "info",
};

function toneForEvent(event: CalendarEvent): "neutral" | "info" | "success" | "warning" {
  return LAYER_TONE[resolveEventLayer(event)] ?? "neutral";
}

function cardStyleForEvent(event: CalendarEvent, selected: boolean): CSSProperties {
  const palette = LAYER_PALETTES[resolveEventLayer(event)];
  return {
    backgroundColor: selected ? palette.backgroundSelected : palette.background,
    borderColor: selected ? palette.borderSelected : palette.border,
    color: palette.color,
  };
}

export function CalendarPageClient({ calendar }: { calendar: CalendarMonth }) {
  const [activeLayers, setActiveLayers] = useState<CalendarLayerKey[]>(
    FILTER_OPTIONS.map((item) => item.key),
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const visibleEvents = calendar.events.filter((event) => isLayerActive(event, activeLayers));
  const selectedEvent =
    visibleEvents.find((event) => event.id === selectedEventId) ?? null;

  const gridDates = buildMonthGrid(calendar.month_start);
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of visibleEvents) {
    const dateKey = event.date;
    const existing = eventsByDate.get(dateKey);
    if (existing) {
      existing.push(event);
    } else {
      eventsByDate.set(dateKey, [event]);
    }
  }
  for (const events of eventsByDate.values()) {
    events.sort(sortEvents);
  }

  const selectedDayEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) ?? [] : [];

  const todayKey = toDateKey(new Date());
  const monthKey = calendar.month_start.slice(0, 7);

  function toggleLayer(layer: CalendarLayerKey) {
    setSelectedEventId(null);
    setSelectedDateKey(null);
    setActiveLayers((current) =>
      current.includes(layer)
        ? current.filter((item) => item !== layer)
        : [...current, layer],
    );
  }

  function selectEvent(eventId: string) {
    setSelectedDateKey(null);
    setSelectedEventId(eventId);
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 24px",
          borderBottom: "1px solid var(--rw-border)",
          backgroundColor: "var(--rw-table-header)",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        {FILTER_OPTIONS.map((filter) => {
          const checked = activeLayers.includes(filter.key);
          const palette = LAYER_PALETTES[filter.key];
          return (
            <label
              key={filter.key}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "var(--rw-foreground)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleLayer(filter.key)}
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: "hidden",
                  clip: "rect(0,0,0,0)",
                  whiteSpace: "nowrap",
                  border: 0,
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: `1px solid ${checked ? palette.checkboxFill : "#cbd5e1"}`,
                  backgroundColor: checked ? palette.checkboxFill : "#ffffff",
                  color: "#ffffff",
                  fontSize: 11,
                  lineHeight: 1,
                  fontWeight: 700,
                  transition: "background-color 120ms ease, border-color 120ms ease",
                }}
              >
                {checked ? "✓" : ""}
              </span>
              {filter.label}
            </label>
          );
        })}
      </div>

      {visibleEvents.length === 0 ? (
        <EmptyState
          title={`${monthKey}에는 표시할 일정이 없습니다.`}
          description="체크박스 필터를 다시 켜거나 다른 월로 이동해 확인할 수 있습니다."
        />
      ) : null}

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 24 }}>
        <div
          style={{
            minWidth: 980,
            border: "1px solid var(--rw-border)",
            backgroundColor: "#ffffff",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              borderBottom: "1px solid var(--rw-border)",
              backgroundColor: "var(--rw-table-header)",
            }}
          >
            {WEEKDAY_LABELS.map((label, index) => (
              <div
                key={label}
                style={{
                  padding: "10px 12px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--rw-muted)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  borderRight:
                    index < WEEKDAY_LABELS.length - 1 ? "1px solid var(--rw-border)" : "none",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            }}
          >
            {gridDates.map((day, index) => {
              const dateKey = toDateKey(day);
              const dayEvents = eventsByDate.get(dateKey) ?? [];
              const isCurrentMonth = dateKey.startsWith(monthKey);
              const isToday = dateKey === todayKey;
              const visibleDayEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
              const remainingCount = dayEvents.length - visibleDayEvents.length;
              const isLastColumn = index % 7 === 6;

              return (
                <div
                  key={dateKey}
                  style={{
                    minHeight: 148,
                    padding: 10,
                    borderRight: isLastColumn ? "none" : "1px solid var(--rw-border)",
                    borderBottom: "1px solid var(--rw-border)",
                    backgroundColor: isCurrentMonth ? "#ffffff" : "#fafafa",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 24,
                        height: 24,
                        borderRadius: 999,
                        backgroundColor: isToday ? "var(--rw-accent)" : "transparent",
                        color: isToday
                          ? "#ffffff"
                          : isCurrentMonth
                          ? "var(--rw-foreground)"
                          : "var(--rw-muted)",
                        fontSize: 12,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {day.getDate()}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: dayEvents.length > 0 ? "var(--rw-muted)" : "transparent",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {dayEvents.length}건
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {visibleDayEvents.map((event) => {
                      const selected = selectedEventId === event.id;
                      const palette = cardStyleForEvent(event, selected);
                      const dotColor = LAYER_PALETTES[resolveEventLayer(event)].checkboxFill;
                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => selectEvent(event.id)}
                          title={`${event.company_name} · ${event.title}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 4,
                            border: `1px solid ${palette.borderColor}`,
                            backgroundColor: palette.backgroundColor,
                            color: palette.color,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              backgroundColor: dotColor,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {event.company_name}
                          </span>
                        </button>
                      );
                    })}

                    {remainingCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEventId(null);
                          setSelectedDateKey(dateKey);
                        }}
                        aria-label={`${formatDate(dateKey)} 일정 ${dayEvents.length}건 모두 보기`}
                        style={{
                          appearance: "none",
                          border: "none",
                          backgroundColor: "transparent",
                          padding: "2px 0",
                          fontSize: 11,
                          color: "var(--rw-muted)",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        +{remainingCount}개 더보기
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDateKey && selectedDayEvents.length > 0 ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${formatDate(selectedDateKey)} 일정 전체 보기`}
          onClick={() => setSelectedDateKey(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 50,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(420px, calc(100vw - 32px))",
              maxHeight: "min(640px, calc(100vh - 48px))",
              border: "1px solid var(--rw-border)",
              borderRadius: 8,
              backgroundColor: "#ffffff",
              boxShadow:
                "0 24px 60px -20px rgba(15, 23, 42, 0.25), 0 8px 24px -12px rgba(15, 23, 42, 0.15)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                padding: "18px 20px 14px",
                borderBottom: "1px solid var(--rw-border)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--rw-muted)",
                  }}
                >
                  전체 일정
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 17,
                    fontWeight: 700,
                    color: "var(--rw-foreground)",
                  }}
                >
                  {formatDate(selectedDateKey)}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--rw-muted)" }}>
                  {selectedDayEvents.length}건
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDateKey(null)}
                aria-label="닫기"
                style={{
                  appearance: "none",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "var(--rw-muted)",
                  cursor: "pointer",
                  fontSize: 22,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: "calc(100vh - 140px)",
                overflowY: "auto",
                padding: 20,
              }}
            >
              {selectedDayEvents.map((event) => {
                const palette = cardStyleForEvent(event, selectedEventId === event.id);
                const dotColor = LAYER_PALETTES[resolveEventLayer(event)].checkboxFill;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => selectEvent(event.id)}
                    title={`${event.company_name} · ${event.title}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: 4,
                      border: `1px solid ${palette.borderColor}`,
                      backgroundColor: palette.backgroundColor,
                      color: palette.color,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        marginTop: 6,
                        borderRadius: 999,
                        backgroundColor: dotColor,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {event.company_name}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: 3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: 11,
                          color: "var(--rw-muted)",
                        }}
                      >
                        {event.title}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {selectedEvent ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedEventId(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 50,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(360px, calc(100vw - 32px))",
              border: "1px solid var(--rw-border)",
              borderRadius: 8,
              backgroundColor: "#ffffff",
              boxShadow:
                "0 24px 60px -20px rgba(15, 23, 42, 0.25), 0 8px 24px -12px rgba(15, 23, 42, 0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                padding: "18px 20px 14px",
                borderBottom: "1px solid var(--rw-border)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--rw-muted)",
                  }}
                >
                  {selectedEvent.source_label}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 17,
                    fontWeight: 700,
                    color: "var(--rw-foreground)",
                  }}
                >
                  {selectedEvent.company_name}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--rw-muted)",
                    wordBreak: "break-word",
                  }}
                >
                  {selectedEvent.title}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  <StatusBadge
                    label={selectedEvent.status_label}
                    tone={toneForEvent(selectedEvent)}
                  />
                  {selectedEvent.badges.map((badge) => (
                    <StatusBadge key={badge} label={badge} tone="neutral" />
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEventId(null)}
                aria-label="닫기"
                style={{
                  appearance: "none",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "var(--rw-muted)",
                  cursor: "pointer",
                  fontSize: 22,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--rw-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  일정
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--rw-foreground)" }}>
                  {selectedEvent.status_label} · {formatDate(selectedEvent.date)}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link
                  href={selectedEvent.href}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 32,
                    padding: "0 14px",
                    borderRadius: 4,
                    backgroundColor: "var(--rw-accent)",
                    color: "#ffffff",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  워크벤치에서 보기
                </Link>
                {selectedEvent.detail_url ? (
                  <a
                    href={selectedEvent.detail_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 32,
                      padding: "0 14px",
                      borderRadius: 4,
                      border: "1px solid var(--rw-border)",
                      backgroundColor: "#ffffff",
                      color: "var(--rw-foreground)",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    공고 원문
                  </a>
                ) : null}
                {selectedEvent.external_apply_url ? (
                  <a
                    href={selectedEvent.external_apply_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 32,
                      padding: "0 14px",
                      borderRadius: 4,
                      border: "1px solid var(--rw-border)",
                      backgroundColor: "#ffffff",
                      color: "var(--rw-foreground)",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    지원 링크
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
