# Supabase Prod Runtime Design

## Goal

Resume Workbench를 로컬 전용 `Next.js + FastAPI + SQLite` 구조에서, 사용자 트래픽은 `Next.js + Supabase`로 처리하고 크롤링 작업만 로컬 `FastAPI`가 담당하는 프로덕션 구조로 전환한다.

## Decisions

- 프로덕션 사용자 진입점은 `apps/web` 하나로 통일한다.
- `apps/web`는 `Vercel`에 배포한다.
- 단일 원본 데이터베이스는 `Supabase Postgres`로 통일한다.
- 인증은 기존 로컬 세션이 아니라 `Supabase Auth`를 사용한다.
- 사용자 요청은 `browser -> Next.js -> Supabase` 경로만 사용한다.
- 프로덕션 사용자 요청은 `apps/api`를 거치지 않는다.
- `apps/api`는 배포 대상이 아니라 로컬 운영자 전용 크롤링/관리 도구로 유지한다.
- 로컬 크롤러는 `Supabase Postgres`에 직접 쓰기한다.
- 공용 데이터와 사용자별 데이터는 스키마와 권한에서 명확히 분리한다.
- 스키마 생성과 변경은 앱 부팅 시 자동 생성이 아니라 migration으로 관리한다.

## Architecture

### User-facing runtime

- `apps/web`는 `Vercel`에 배포한다.
- `apps/web`는 `Supabase Auth`로 로그인과 세션을 처리한다.
- 페이지 조회, 폼 제출, 갱신 요청은 `Next.js` 서버 컴포넌트, 서버 액션, 라우트 핸들러를 통해 `Supabase`에 접근한다.
- 브라우저는 `Supabase anon key`와 사용자 세션 범위 안에서만 동작한다.

### Admin and crawler runtime

- `apps/api`는 프로덕션 외부에 둔다.
- 운영자는 로컬 PC에서만 `FastAPI`와 Python 스크립트를 실행한다.
- 크롤러는 기존 서비스 계층과 스크립트를 재사용하되, 데이터 저장 대상은 SQLite가 아니라 `Supabase Postgres`로 바꾼다.
- 크롤링 실행, 기준 데이터 보정, 백필 작업은 모두 로컬 관리자 경로에서만 수행한다.

### Boundary rule

- 사용자 기능은 로컬 `FastAPI`를 호출하지 않는다.
- 로컬 `FastAPI`는 사용자 세션을 받지 않는다.
- 공용 데이터 쓰기 권한은 로컬 관리자 경로만 가진다.

## Data Ownership

### Shared tables

- `sources`
- `job_postings`
- `job_sync_runs`

이 테이블들은 모든 로그인 사용자가 읽을 수 있는 공용 데이터다. 쓰기는 로컬 관리자 경로만 수행한다.

### User-owned tables or records

- `resume_templates`
- `applications`
- `cover_letter_tags`
- `user_posting_states`

이 데이터는 각 사용자에게 귀속된다. 사용자 식별자는 `Supabase Auth`의 `auth.users.id` UUID를 기준으로 맞춘다.

## Auth And Authorization

- 로그인 방식은 `Supabase Auth`의 `email/password`를 기본값으로 둔다.
- `apps/web`는 기존 `rw_session` 쿠키와 FastAPI 세션 검증을 제거한다.
- 사용자 식별자는 자체 증가 정수 대신 `auth.users.id`를 기준 키로 사용한다.
- 사용자별 데이터는 `auth.uid() = user_id` 규칙으로 접근을 제한한다.
- 공용 조회 테이블은 인증된 사용자 전체 read를 허용한다.
- 공용 테이블 write는 브라우저 경로에서 금지한다.
- 지금 단계에서는 크롤링 실행 UI를 웹에 노출하지 않는다.

## RLS Policy Direction

- 사용자 데이터 테이블은 `select`, `insert`, `update`, `delete` 모두 본인 소유 행만 허용한다.
- 공용 테이블은 `select`만 인증 사용자에게 허용한다.
- 공용 테이블 `insert`, `update`, `delete`는 브라우저 세션으로는 허용하지 않는다.
- 로컬 크롤러는 브라우저 키가 아니라 서버 전용 DB 연결 정보로 쓰기 작업을 수행한다.

## Environment And Secrets

### Vercel

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`apps/web`의 일반 사용자 경로에는 `service_role`을 넣지 않는다.

### Local crawler and admin runtime

- `SUPABASE_DB_URL` 또는 동등한 Postgres 연결 문자열
- 필요 시 별도 관리자 전용 환경 변수

강한 권한의 비밀값은 로컬 운영 환경에만 둔다.

## Deployment And Operations

- 프로덕션 배포 대상은 `apps/web` 하나다.
- `Supabase`는 `Postgres`와 `Auth`를 담당한다.
- 스키마 변경은 migration으로 관리한다.
- 앱 부팅 시 `create_all()`과 자동 seed는 프로덕션에서 제거한다.
- 기준 데이터는 SQL seed 또는 별도 관리자 스크립트로 관리한다.
- 사용자 오류는 `Vercel` 로그에서, DB 문제는 `Supabase` 로그에서 확인한다.
- 크롤링 실행 결과는 로컬 로그와 `job_sync_runs`에 기록한다.
- 크롤러 write는 `upsert` 중심으로 설계해 재실행 가능하게 유지한다.

## Migration Plan

1. `Supabase` 프로젝트를 생성하고 `Postgres`와 `Auth`를 준비한다.
2. SQLite 스키마를 기준으로 `Supabase` migration 초안을 작성한다.
3. 공용 데이터와 사용자별 데이터를 분리한 스키마를 확정한다.
4. 사용자 소유 데이터에 `auth.users.id` 기반 키를 연결하고 RLS를 적용한다.
5. `apps/web`의 인증 흐름을 `Supabase Auth`로 교체한다.
6. `apps/web/lib/api.ts` 중심의 `FastAPI` 호출을 `Supabase` 기반 접근으로 전환한다.
7. `apps/api`의 DB 연결을 SQLite에서 `Supabase Postgres`로 교체한다.
8. 프로덕션에서 `create_all()`과 앱 부팅 자동 seed를 제거한다.
9. `apps/web`를 `Vercel`에 연결하고 환경 변수를 주입한다.
10. 회원가입, 로그인, 공고 조회, 북마크, 지원현황, 이력서 CRUD, 크롤러 upsert를 순서대로 검증한다.

## Risks

- 현재 `apps/web`는 `apps/api` 호출과 자체 세션 쿠키에 강하게 묶여 있어 인증 전환 범위가 생각보다 넓다.
- SQLite 기반 모델과 `Supabase Postgres` 스키마 사이에 타입 차이와 제약 차이가 있어 migration 설계가 필요하다.
- 사용자별 데이터와 공용 데이터를 분리하는 과정에서 기존 로컬 데이터 이관 전략을 따로 세워야 한다.
- `service_role` 또는 고권한 DB 연결 문자열이 웹 경로에 섞이면 RLS 의미가 무너진다.
- 크롤러가 기존처럼 앱 부팅 시 seed를 기대하면 운영 환경과 로컬 환경이 어긋날 수 있다.

## Non-Goals

- 프로덕션에 공개 관리자 UI를 추가하지 않는다.
- 크롤러 실행을 사용자가 웹에서 트리거하게 만들지 않는다.
- 이번 단계에서 `apps/api`를 완전히 삭제하지 않는다.
