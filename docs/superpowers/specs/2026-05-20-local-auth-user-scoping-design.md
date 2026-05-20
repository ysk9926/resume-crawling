# Local Auth And User Scoping Design

## Goal

Resume Workbench를 로컬 계정 로그인 기반으로 전환하고, 공유 공고 데이터와 사용자별 개인 데이터를 분리한다.

## Decisions

- 앱 전체는 로그인 필수다.
- 인증 방식은 로컬 `username + password` 기반이다.
- 첫 가입자는 자동으로 `admin` 권한을 가진다.
- 이후 가입자는 `member` 권한을 가진다.
- 공고 크롤링 동기화는 `admin`만 실행할 수 있다.
- 크롤링 공고, 소스, 동기화 이력은 공유 데이터로 유지한다.
- 북마크, TODO, 공고 큐레이션 상태, 이력서 템플릿, 지원서, 자소서 문항은 사용자별로 분리한다.
- 수동 등록 공고는 공유하고, 수동 등록 지원서는 생성한 사용자에게만 귀속한다.
- 기존 전역 개인 데이터는 첫 가입자 계정으로 자동 귀속한다.

## Data Model

### Shared tables

- `sources`
- `job_postings`
- `job_sync_runs`

### User-owned tables

- `users`
- `user_sessions`
- `user_posting_states`

### User-owned records in existing tables

- `resume_templates.user_id`
- `applications.user_id`
- `cover_letter_tags.user_id`

## Auth Flow

- Next.js는 로그인/회원가입 화면과 브라우저 쿠키를 관리한다.
- API는 세션 토큰을 생성하고 검증한다.
- Next.js 서버 컴포넌트와 서버 액션은 자체 쿠키에서 세션 토큰을 읽어 API 요청 헤더로 전달한다.
- API는 세션 토큰으로 현재 사용자를 조회하고 모든 개인 데이터 쿼리에 사용자 필터를 강제한다.

## Migration

1. 새 인증/상태 테이블을 추가한다.
2. 사용자 소유가 필요한 기존 테이블에 `user_id` 컬럼을 추가한다.
3. 첫 가입 시 기존 전역 개인 데이터를 첫 사용자에게 귀속한다.
4. 앱 조회/수정 로직을 사용자 스코프로 전환한다.
5. 기존 `job_postings`의 개인 상태 컬럼은 레거시 데이터 소스로만 사용하고, 새 상태 테이블로 읽기/쓰기를 이전한다.

## Risks

- SQLite 제약 변경이 제한적이므로 기존 `applications.job_posting_id` 단일 unique를 우회하는 마이그레이션이 필요하다.
- 로그인 미들웨어와 API 인증 실패 처리가 엇갈리면 무한 리다이렉트가 생길 수 있다.
- 사용자 스코프 캐시 키가 빠지면 개인정보가 섞일 수 있다.
