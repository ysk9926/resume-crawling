---
title: Loading Cache Optimization
date: 2026-05-18
status: approved
---

# Loading Cache Optimization

매 페이지 진입 시마다 웹 레이어가 항상 새 요청을 보내고, API 레이어도 항상 SQLite 집계와 목록 조회를 다시 수행하는 구조를 완화한다.

## Problem

- `apps/web/lib/api.ts`가 모든 요청에 `cache: "no-store"`를 강제한다.
- `apps/web/app/page.tsx`, `postings/page.tsx`, `resumes/page.tsx`, `applications/page.tsx`가 `force-dynamic`으로 고정되어 있다.
- API의 읽기 라우트는 대시보드 집계, 공고 목록, 이력서/지원 목록을 매 요청마다 다시 계산한다.
- 개발 환경에서는 Next 페이지 캐시가 기본적으로 비활성화되므로, 웹 캐시만으로는 로컬 체감 개선이 제한적이다.

## Goals

- 반복 진입 시 로딩 시간을 줄인다.
- 수정/동기화 직후에는 사용자가 바로 갱신된 결과를 본다.
- 로컬 단독 실행 구조를 유지하고, Redis 같은 외부 인프라는 추가하지 않는다.

## Chosen Approach

### 1. Web cache

- GET 요청에 `force-cache` + `next.revalidate` + `next.tags`를 적용한다.
- 페이지의 `force-dynamic`을 제거해 캐시 가능한 fetch가 실제로 동작하게 만든다.
- Server Action에서는 `updateTag`와 `revalidatePath`를 함께 사용해 수정 직후 stale 응답을 피한다.

### 2. API cache

- FastAPI 프로세스 내부에 짧은 TTL 메모리 캐시를 둔다.
- 대상:
  - 대시보드
  - 수집원 목록
  - 공고 목록
  - 이력서 목록
  - 지원 목록
  - 수집원 crawl info
- TTL:
  - 대시보드/공고/지원 목록: 15~30초
  - 수집원/이력서 목록: 60초
  - crawl info: 15초
- 무효화 시점:
  - 공고 수정
  - 이력서 생성/수정
  - 지원 생성/수정
  - 소스 동기화 성공/실패

### 3. SQLite index

- 정렬과 최근 목록 조회에 자주 쓰는 컬럼 인덱스를 추가한다.
- 대상:
  - `job_postings(posted_at, created_at)`
  - `applications(updated_at)`
  - `resume_templates(updated_at)`
  - `job_sync_runs(started_at)`

## Non-Goals

- Redis/SQLite 외부 캐시 도입
- full-text search 재설계
- 무한 스크롤, 페이지네이션, 비동기 prefetch 도입
