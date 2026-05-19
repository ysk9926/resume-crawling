# Calendar Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공고 마감일과 지원 일정을 함께 보는 월간 캘린더 페이지를 추가한다.

**Architecture:** FastAPI에 월 단위 캘린더 집계 API를 추가하고, Next.js는 `/calendar` 페이지에서 해당 응답을 렌더링한다. 공고와 지원 데이터는 서버에서 공통 이벤트 모델로 변환하고, 웹은 체크박스 필터와 팝오버 상호작용만 담당한다.

**Tech Stack:** Next.js 16, React Server Components, FastAPI, SQLAlchemy, TypeScript, Python

---

### Task 1: Calendar API contract and tests

**Files:**
- Modify: `apps/api/app/schemas.py`
- Create: `apps/api/tests/test_calendar_route.py`

- [ ] **Step 1: Write failing API tests**

```python
def test_calendar_route_returns_posting_and_application_events(client, seeded_db):
    response = client.get("/api/calendar?month=2026-05")
    assert response.status_code == 200
    payload = response.json()
    assert payload["month"] == "2026-05"
    assert any(item["kind"] == "posting" for item in payload["events"])
    assert any("application_applied" in item["layer_keys"] for item in payload["events"])
```

- [ ] **Step 2: Add calendar response schemas**

```python
class CalendarEventOut(BaseModel):
    id: str
    kind: Literal["posting", "application"]
    layer_keys: list[str]
    date: date
    title: str
    company_name: str
    source_label: str
    status_label: str
    href: str
    badges: list[str]


class CalendarMonthOut(BaseModel):
    month: str
    month_start: date
    month_end: date
    events: list[CalendarEventOut]
```

- [ ] **Step 3: Run focused API test**

Run: `cd apps/api && uv run pytest tests/test_calendar_route.py -v`
Expected: FAIL because `/api/calendar` does not exist yet.

### Task 2: Calendar API implementation

**Files:**
- Create: `apps/api/app/api/routes/calendar.py`
- Modify: `apps/api/app/api/routes/__init__.py`
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Build the month parser and query helpers**

```python
def parse_month(value: str) -> tuple[date, date]:
    month_start = datetime.strptime(value, "%Y-%m").date().replace(day=1)
    month_end = date(month_start.year, month_start.month, monthrange(month_start.year, month_start.month)[1])
    return month_start, month_end
```

- [ ] **Step 2: Implement `/api/calendar`**

```python
@router.get("", response_model=CalendarMonthOut)
def get_calendar_month(month: str = Query(...), db: Session = Depends(get_db)) -> CalendarMonthOut:
    month_start, month_end = parse_month(month)
    events = load_calendar_events(db, month_start, month_end)
    return CalendarMonthOut(month=month, month_start=month_start, month_end=month_end, events=events)
```

- [ ] **Step 3: Include event mapping rules**

```python
if posting.apply_end_date and month_start <= posting.apply_end_date <= month_end:
    events.append(make_posting_event(posting))
if application.status == "planned" and application.apply_end_date_snapshot:
    events.append(make_application_planned_event(application))
if application.status == "applied" and application.applied_at:
    events.append(make_application_applied_event(application))
```

- [ ] **Step 4: Run focused API test**

Run: `cd apps/api && uv run pytest tests/test_calendar_route.py -v`
Expected: PASS

### Task 3: Client types and fetcher

**Files:**
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/lib/api.ts`

- [ ] **Step 1: Add calendar event types**

```ts
export type CalendarEventKind =
  | "posting"
  | "application";

export type CalendarLayerKey =
  | "posting_deadline"
  | "posting_bookmark"
  | "posting_todo"
  | "application_planned"
  | "application_applied";
```

- [ ] **Step 2: Add calendar fetch helper**

```ts
export async function getCalendarMonth(month: string): Promise<CalendarMonth> {
  return request<CalendarMonth>(`/api/calendar?month=${month}`, {
    next: { revalidate: 30, tags: [CACHE_TAGS.postings, CACHE_TAGS.applications] },
  });
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: PASS or only pre-existing unrelated errors.

### Task 4: Monthly calendar page UI

**Files:**
- Create: `apps/web/app/calendar/page.tsx`

- [ ] **Step 1: Render month navigation and filter checkboxes**

```tsx
const FILTERS = [
  { key: "posting_deadline", label: "공고 마감일" },
  { key: "posting_bookmark", label: "찜한 공고" },
  { key: "posting_todo", label: "작성 예정" },
  { key: "application_planned", label: "지원 예정" },
  { key: "application_applied", label: "지원 완료" },
];
```

- [ ] **Step 2: Build month grid and per-day event lists**

```tsx
const days = buildMonthGrid(monthStart);
const visibleEvents = calendar.events.filter((item) =>
  item.layer_keys.some((layer) => activeKinds.has(layer)),
);
```

- [ ] **Step 3: Add click popover and empty state**

```tsx
{selectedEvent ? <EventPopover event={selectedEvent} onClose={closePopover} /> : null}
```

- [ ] **Step 4: Run web lint or build**

Run: `cd apps/web && pnpm exec next build`
Expected: PASS

### Task 5: Navigation and regression verification

**Files:**
- Modify: `apps/web/components/ui/sidebar.tsx`

- [ ] **Step 1: Add sidebar entry for `/calendar`**

```tsx
{ href: "/calendar", label: "캘린더", icon: HiOutlineCalendar }
```

- [ ] **Step 2: Run targeted tests and smoke checks**

Run: `cd apps/api && uv run pytest tests/test_calendar_route.py tests/test_applications_library.py tests/test_postings_query.py -v`
Expected: PASS

Run: `cd apps/web && pnpm exec next build`
Expected: PASS
