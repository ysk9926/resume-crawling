# Remember Sync Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 리멤버 공고를 필터 기반으로 조회하고 대시보드에서 같은 조건으로 동기화할 수 있게 만든다.

**Architecture:** 백엔드는 리멤버 전용 crawler와 필터 payload를 추가하고, 프론트는 기존 범위 동기화 UI를 유지하면서 리멤버에만 필터 패널과 원본 링크 생성을 얹는다.

**Tech Stack:** Next.js 16, FastAPI, SQLAlchemy, SQLite, httpx

---

### Task 1: Backend contracts

**Files:**
- Modify: `apps/api/app/schemas.py`
- Modify: `apps/api/app/api/routes/sources.py`
- Modify: `apps/api/app/services/sync.py`

- [ ] Add Remember filter schemas and filtered crawl-info request schema.
- [ ] Pass optional filters into crawl-info lookup and sync execution.

### Task 2: Remember crawler

**Files:**
- Create: `apps/api/app/crawlers/remember.py`
- Modify: `apps/api/app/crawlers/registry.py`
- Modify: `apps/api/app/crawlers/jobkorea.py`
- Modify: `apps/api/app/crawlers/kofia.py`

- [ ] Add Remember search/detail crawler with filter-aware payload builder.
- [ ] Register the crawler and keep legacy crawlers compatible with filtered construction.

### Task 3: Web integration

**Files:**
- Modify: `apps/web/lib/types.ts`
- Create: `apps/web/lib/remember.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/app/actions.ts`
- Modify: `apps/web/components/ui/source-sync-controls.tsx`

- [ ] Add Remember filter client types and URL builder helpers.
- [ ] Send filters to crawl-info and sync APIs.
- [ ] Show Remember-only filter inputs and source-page link.

### Task 4: Verification

**Files:**
- Create: `apps/api/tests/test_remember_crawler.py`
- Modify: `apps/api/tests/test_sync_service.py`

- [ ] Add focused crawler parsing tests and filter pass-through tests.
- [ ] Run API tests, web typecheck, and web lint.
