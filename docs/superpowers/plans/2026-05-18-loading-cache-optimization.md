# Loading Cache Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 반복 페이지 진입 시 API/DB 재계산을 줄이고, 수정 직후에는 즉시 최신 데이터를 보여준다.

**Architecture:** Next fetch 캐시와 FastAPI TTL 캐시를 함께 사용한다. 읽기 경로는 짧게 캐시하고, 쓰기 경로에서는 태그/메모리 캐시를 함께 무효화한다.

**Tech Stack:** Next.js 16 App Router, Server Actions, FastAPI, SQLAlchemy, SQLite

---

### Task 1: Web fetch cache and invalidation

**Files:**
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/app/actions.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/postings/page.tsx`
- Modify: `apps/web/app/resumes/page.tsx`
- Modify: `apps/web/app/applications/page.tsx`

- [ ] Replace unconditional `no-store` GET behavior with tagged `force-cache` requests.
- [ ] Remove page-level `force-dynamic` so cached GET requests can work in production mode.
- [ ] In Server Actions, use tag updates and path revalidation after every mutation.

### Task 2: API TTL cache

**Files:**
- Create: `apps/api/app/services/cache.py`
- Modify: `apps/api/app/config.py`
- Modify: `apps/api/app/api/routes/dashboard.py`
- Modify: `apps/api/app/api/routes/sources.py`
- Modify: `apps/api/app/api/routes/postings.py`
- Modify: `apps/api/app/api/routes/resumes.py`
- Modify: `apps/api/app/api/routes/applications.py`
- Modify: `apps/api/app/services/sync.py`

- [ ] Add a small in-process TTL cache keyed by route namespace and query parameters.
- [ ] Wrap read-heavy GET endpoints with cache lookups.
- [ ] Invalidate read caches after sync and write operations.

### Task 3: SQLite index and verification

**Files:**
- Modify: `apps/api/app/models.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/test_read_cache.py`

- [ ] Add metadata/index definitions for recent-list and sort-heavy columns.
- [ ] Ensure existing local databases receive missing indexes on startup.
- [ ] Add focused cache tests and run API tests, lint, and typecheck.
