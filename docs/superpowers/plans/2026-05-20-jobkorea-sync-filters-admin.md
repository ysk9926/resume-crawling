# JobKorea Sync Filters Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable full JobKorea detailed-search filtering from the local `crawler-admin` runtime and run `crawl-info` plus sync with the exact same source-side payload.

**Architecture:** Keep crawl execution inside the split admin runtime: `crawler-admin` route handlers call `python-cli`, `source_admin.py` dispatches source-specific commands, and the JobKorea crawler uses a shared payload builder plus filter-options scraper. The user-facing `apps/web` runtime remains unchanged and continues to reject crawler actions.

**Tech Stack:** Next.js 16, React 19, TypeScript, Python 3.13, FastAPI support modules, httpx, BeautifulSoup, pytest

---

### Task 1: Generalize filter contracts for the admin runtime

**Files:**
- Modify: `apps/crawler-admin/lib/types.ts`
- Modify: `apps/crawler-admin/lib/python-cli.ts`
- Modify: `apps/crawler-admin/app/api/sources/crawl-info/route.ts`
- Modify: `apps/crawler-admin/app/api/sources/sync/route.ts`
- Modify: `apps/api/app/schemas.py`

- [ ] Add `JobKoreaSearchFilters`, `JobKoreaFilterOption`, `JobKoreaFilterOptions`, and `SourceSearchFilters` types in `apps/crawler-admin/lib/types.ts`.
- [ ] Replace `RememberSearchFilters`-only command inputs in `apps/crawler-admin/lib/python-cli.ts` with a source-aware union so `crawl-info` and `sync` can carry either remember or JobKorea filters.
- [ ] Update both `apps/crawler-admin` route handlers to accept `SourceSearchFilters` instead of remember-only payloads.
- [ ] Mirror the same filter union in `apps/api/app/schemas.py` so backend validation and future local routes do not regress to remember-only typing.
- [ ] Keep the `apps/web` runtime untouched; do not re-enable crawl APIs there.
- [ ] Commit.

### Task 2: Add JobKorea payload builder and option scraping helpers

**Files:**
- Create: `apps/api/app/crawlers/jobkorea_filters.py`
- Modify: `apps/api/app/crawlers/jobkorea.py`
- Test: `apps/api/tests/test_jobkorea_crawler.py`

- [ ] Move the current hardcoded `SEARCH_PAYLOAD` behavior into a helper that can build a request payload from `JobKoreaSearchFilters` plus fallback preset defaults.
- [ ] Add helper functions to map UI filter values into JobKorea request keys including `duty`, `local`, `career`, `careerStart`, `careerEnd`, `edu`, `cotype`, `jobtype`, `industry`, `position`, `pay`, `paytype`, `payinput`, `major`, `license`, `pref`, `wel`, `textinclude`, and `textexclude`.
- [ ] Keep top-level request fields such as `direct`, `order`, `pagesize`, `tabindex`, `onePick`, `confirm`, and `profile` in the builder so `crawl-info` and `sync` cannot drift.
- [ ] Add a metadata scraping helper that reads the JobKorea search page and extracts filter options for the admin UI.
- [ ] Add a small TTL cache in the helper layer so repeated option loads do not fetch the external JobKorea page every time.
- [ ] Update `JobKoreaCrawler.__init__()` to store filters and make `_fetch_list_page()` call the shared payload builder.
- [ ] Add tests for empty-filter fallback, payload field mapping, and option parsing on representative HTML fixtures.
- [ ] Commit.

### Task 3: Extend the local Python admin CLI with filter-options support

**Files:**
- Modify: `apps/api/app/scripts/source_admin.py`
- Modify: `apps/crawler-admin/lib/python-cli.ts`
- Create: `apps/crawler-admin/app/api/sources/filter-options/route.ts`
- Modify: `apps/crawler-admin/lib/types.ts`

- [ ] Add a new `filter-options` subcommand in `source_admin.py` that accepts `source_key` and returns source-specific option metadata as JSON.
- [ ] Refactor `source_admin.py` command parsing so `crawl-info`, `sync`, and `filter-options` all share the same source-neutral filter parsing and JSON printing helpers.
- [ ] Add a matching `command: "filter-options"` branch in `apps/crawler-admin/lib/python-cli.ts`.
- [ ] Implement `/api/sources/filter-options` in `apps/crawler-admin` and make it validate `sourceKey` before calling Python.
- [ ] Return a consistent error shape when the source does not support filter metadata.
- [ ] Commit.

### Task 4: Refactor crawler-admin UI into source-specific filter panels

**Files:**
- Modify: `apps/crawler-admin/components/source-sync-console.tsx`
- Create: `apps/crawler-admin/lib/jobkorea.ts`
- Create: `apps/crawler-admin/components/source-sync-panels/jobkorea-sync-panel.tsx`
- Create: `apps/crawler-admin/components/source-sync-panels/remember-sync-panel.tsx`
- Modify: `apps/crawler-admin/lib/remember.ts`

- [ ] Extract the current remember-only filter form from `SourceSyncConsole` into `remember-sync-panel.tsx` without changing remember behavior.
- [ ] Add `jobkorea.ts` helpers to normalize form state, build source URLs, and serialize selected option codes into `JobKoreaSearchFilters`.
- [ ] Implement `jobkorea-sync-panel.tsx` with fields for duty, local, career, education, company type, employment type, industry, position, salary, major, license, preference, welfare, include keywords, exclude keywords, direct-apply-only, and exclude-confirmed-postings.
- [ ] Make `SourceSyncConsole` fetch filter metadata when `sourceKey === "jobkorea"` and render the correct source panel based on the selected source.
- [ ] Keep the common page-range validation, crawl-info result box, sync result box, and pending/error messages in `SourceSyncConsole`.
- [ ] Add a JobKorea source-page link using the same serialized filter state as the crawler payload.
- [ ] Preserve the remember panel path and existing messages so this refactor does not regress remember sync.
- [ ] Commit.

### Task 5: Align sync execution and add regression coverage

**Files:**
- Modify: `apps/api/tests/test_jobkorea_crawler.py`
- Modify: `apps/api/tests/test_sync_service.py`
- Create: `apps/api/tests/test_source_admin.py`

- [ ] Extend `apps/api/tests/test_jobkorea_crawler.py` with assertions that `get_crawl_info()` and `crawl()` both use the same builder-derived request payload for identical filters.
- [ ] Add sync-service tests proving `run_source_sync_with_filters()` passes JobKorea filters through unchanged and still rejects invalid page ranges.
- [ ] Add CLI tests for `source_admin.py filter-options`, invalid filter JSON, and unsupported source behavior.
- [ ] Keep existing remember tests green to prove the source-neutral contract did not break the current remember path.
- [ ] Commit.

### Task 6: Verify the split runtime end to end

**Files:**
- Test: `apps/api/tests/test_jobkorea_crawler.py`
- Test: `apps/api/tests/test_sync_service.py`
- Test: `apps/api/tests/test_source_admin.py`
- Verify: `apps/crawler-admin`

- [ ] Run `uv run --directory apps/api pytest apps/api/tests/test_jobkorea_crawler.py apps/api/tests/test_sync_service.py apps/api/tests/test_source_admin.py -q`.
- [ ] Run `pnpm --dir apps/crawler-admin exec tsc --noEmit`.
- [ ] Run `pnpm --dir apps/crawler-admin lint`.
- [ ] Run `pnpm build:admin` to verify the local admin runtime builds after the panel split and new route addition.
- [ ] Commit.
