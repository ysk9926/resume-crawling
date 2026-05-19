import Link from "next/link";

import { CalendarPageClient } from "@/components/calendar/calendar-page-client";
import { ApiUnavailable } from "@/components/ui/api-unavailable";
import { PageHeader } from "@/components/ui/page-header";
import { pageBodyStyle, secondaryButtonStyle } from "@/components/ui/primitives";
import { getCalendarMonth } from "@/lib/api";
import type { CalendarMonth } from "@/lib/types";

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

function isValidMonth(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }
  const month = Number(value.slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

function getDefaultMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const [year, monthLabel] = month.split("-").map(Number);
  const shifted = new Date(year, monthLabel - 1 + delta, 1);
  return `${shifted.getFullYear()}-${`${shifted.getMonth() + 1}`.padStart(2, "0")}`;
}

function formatMonthLabel(month: string) {
  const [year, monthLabel] = month.split("-").map(Number);
  return `${year}년 ${monthLabel}월`;
}

function countEvents(
  calendar: CalendarMonth,
  predicate: (item: CalendarMonth["events"][number]) => boolean,
) {
  return calendar.events.filter(predicate).length;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const month = isValidMonth(params.month) ? params.month! : getDefaultMonth();
  const calendar = await getCalendarMonth(month).catch(() => null);

  if (!calendar) {
    return <ApiUnavailable />;
  }

  const previousMonth = shiftMonth(calendar.month, -1);
  const nextMonth = shiftMonth(calendar.month, 1);
  const postingCount = countEvents(calendar, (event) => event.kind === "posting");
  const plannedCount = countEvents(calendar, (event) =>
    event.layer_keys.includes("application_planned"),
  );
  const appliedCount = countEvents(calendar, (event) =>
    event.layer_keys.includes("application_applied"),
  );

  return (
    <>
      <PageHeader
        title="캘린더"
        description="공고 마감일과 지원 일정을 월 단위로 함께 확인합니다."
        stats={[
          { label: "전체 일정", value: calendar.events.length },
          { label: "공고", value: postingCount, tone: "accent" },
          { label: "지원 예정", value: plannedCount, tone: "muted" },
          { label: "지원 완료", value: appliedCount },
        ]}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href={`/calendar?month=${previousMonth}`} style={secondaryButtonStyle}>
              이전 월
            </Link>
            <div
              style={{
                minWidth: 112,
                textAlign: "center",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--rw-foreground)",
              }}
            >
              {formatMonthLabel(calendar.month)}
            </div>
            <Link href={`/calendar?month=${nextMonth}`} style={secondaryButtonStyle}>
              다음 월
            </Link>
          </div>
        }
      />

      <div style={{ ...pageBodyStyle, display: "flex", flexDirection: "column" }}>
        <CalendarPageClient key={calendar.month} calendar={calendar} />
      </div>
    </>
  );
}
