# Postings Tabbed Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공고 페이지를 탭별 조회 API와 서버 페이지네이션 구조로 바꾼다.

**Architecture:** 백엔드는 탭별 라우트와 overview 집계를 제공하고, 프론트는 현재 탭에 맞는 API만 호출한다.

**Tech Stack:** Next.js 16, FastAPI, SQLAlchemy, SQLite

---

### Task 1: API contracts

**Files:**
- Modify: `apps/api/app/schemas.py`
- Modify: `apps/api/app/api/routes/postings.py`

- [ ] Add overview and paginated posting response models.
- [ ] Add tab-specific posting routes and shared filter helpers.

### Task 2: Web integration

**Files:**
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/app/postings/page.tsx`

- [ ] Add overview and paginated posting client types.
- [ ] Add per-tab API clients.
- [ ] Replace client-derived counts with overview response and server pagination UI.

### Task 3: Verification

**Files:**
- Create: `apps/api/tests/test_postings_query.py`

- [ ] Add focused tests for tab counts and pagination.
- [ ] Run tests, lint, typecheck, and production build.
