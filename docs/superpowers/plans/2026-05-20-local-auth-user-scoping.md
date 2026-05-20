# Local Auth And User Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local-account login and convert personal data flows to per-user ownership while keeping crawled postings shared.

**Architecture:** FastAPI owns user/session validation and per-user query scoping. Next.js stores the API session token in its own cookie, redirects unauthenticated users to auth pages, and forwards the token on every server-side API request.

**Tech Stack:** Next.js App Router, FastAPI, SQLAlchemy, SQLite, pytest

---

### Task 1: Add persistence for users and per-user posting state

**Files:**
- Modify: `apps/api/app/models.py`
- Modify: `apps/api/app/main.py`
- Modify: `apps/api/app/seed.py`
- Test: `apps/api/tests/test_seed.py`

- [ ] Add user, session, and per-user state models and bootstrap tables.
- [ ] Add migration helpers for legacy columns and first-user adoption.
- [ ] Update seed behavior so master resume creation does not break before first signup.
- [ ] Add tests covering bootstrapping and first-user adoption.
- [ ] Commit.

### Task 2: Add auth services and routes

**Files:**
- Create: `apps/api/app/security.py`
- Create: `apps/api/app/api/routes/auth.py`
- Modify: `apps/api/app/schemas.py`
- Modify: `apps/api/app/api/routes/__init__.py`
- Modify: `apps/api/app/main.py`
- Test: `apps/api/tests/test_auth_service.py`

- [ ] Implement password hashing, session token creation, current-user resolution, and admin guard helpers.
- [ ] Add signup, login, logout, and me endpoints.
- [ ] Add tests for first-user admin assignment, login failure, and session invalidation.
- [ ] Commit.

### Task 3: Scope API reads and writes by current user

**Files:**
- Modify: `apps/api/app/api/routes/postings.py`
- Modify: `apps/api/app/api/routes/applications.py`
- Modify: `apps/api/app/api/routes/resumes.py`
- Modify: `apps/api/app/api/routes/calendar.py`
- Modify: `apps/api/app/api/routes/dashboard.py`
- Modify: `apps/api/app/api/routes/sources.py`
- Modify: `apps/api/app/services/sync.py`
- Test: `apps/api/tests/test_postings_query.py`
- Test: `apps/api/tests/test_calendar_route.py`
- Test: `apps/api/tests/test_sync_service.py`

- [ ] Replace global posting state reads with user-scoped joins.
- [ ] Require current user for resumes, applications, dashboard, and calendar.
- [ ] Restrict source sync mutations to admins.
- [ ] Update manual posting/application flows to create shared postings plus user-owned state.
- [ ] Commit.

### Task 4: Add web auth flow and route protection

**Files:**
- Create: `apps/web/app/login/page.tsx`
- Create: `apps/web/app/signup/page.tsx`
- Create: `apps/web/app/logout/route.ts`
- Create: `apps/web/middleware.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/actions.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/components/ui/sidebar.tsx`

- [ ] Add signup/login actions that call the API and set/clear the web session cookie.
- [ ] Redirect unauthenticated users away from protected routes.
- [ ] Forward the session token on every server-side API request.
- [ ] Surface current user and admin state in the sidebar.
- [ ] Commit.

### Task 5: Verify and tighten

**Files:**
- Modify: `README.md`
- Test: `apps/api/tests/test_*`

- [ ] Run targeted pytest coverage for auth, postings, calendar, and sync flows.
- [ ] Run lint or typecheck for touched web code.
- [ ] Update README with the new auth expectations.
- [ ] Commit.
