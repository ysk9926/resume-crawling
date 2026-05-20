# JobKorea Sync Filters Admin Design

## Goal

로컬 운영자 전용 `crawler-admin` 화면에서 잡코리아 상세검색 조건을 모두 설정하고, 같은 조건으로 총 공고 수/총 페이지 수를 조회한 뒤 동일한 조건으로 동기화를 실행할 수 있게 만든다.

## Decisions

- 잡코리아 동기화 필터 UI는 `apps/web`가 아니라 `apps/crawler-admin`에만 둔다.
- `apps/web`의 크롤링 관련 함수는 계속 비활성 상태로 유지한다.
- 관리자 화면과 Python 실행 경계는 `crawler-admin route -> python-cli -> app.scripts.source_admin` 흐름으로 고정한다.
- 필터 계약은 `remember` 전용 타입이 아니라 source-aware union으로 일반화한다.
- 잡코리아 필터 옵션 목록은 잡코리아 검색 페이지 메타데이터를 파싱해 가져오고, 로컬 관리자 런타임에서 캐시한다.
- 잡코리아 목록 조회와 실제 동기화는 반드시 같은 payload builder를 사용한다.
- 잡코리아 필터가 비어 있을 때는 전체 검색이 아니라 현재 crawler preset을 fallback으로 사용한다.
- 확인된 잡코리아 필터만 노출하고, 성별/나이처럼 이번 범위에서 검증하지 않은 조건은 제외한다.

## Current Runtime Boundary

### User-facing runtime

- `apps/web`는 Supabase 기반 사용자 화면이다.
- `apps/web/lib/server/data.ts`의 `postSourceCrawlInfo()`와 `postSyncSource()`는 예외를 던지며, 사용자 경로에서 로컬 crawler runtime을 호출하지 않는다.
- 따라서 이번 작업 범위에 `apps/web` 필터 UI 추가는 포함하지 않는다.

### Admin and crawler runtime

- 운영자는 `apps/crawler-admin`에서 소스별 동기화와 상태 확인을 수행한다.
- `apps/crawler-admin/app/api/sources/*` 라우트는 Node 런타임에서 `apps/crawler-admin/lib/python-cli.ts`를 통해 Python CLI를 호출한다.
- Python CLI 엔트리포인트는 `apps/api/app/scripts/source_admin.py`다.
- 실제 목록 조회와 동기화는 `apps/api/app/crawlers/jobkorea.py`와 `apps/api/app/services/sync.py`가 담당한다.

## Architecture

### Contract layer

- `apps/crawler-admin/lib/types.ts`에 `SourceSearchFilters` union과 `JobKoreaSearchFilters`를 추가한다.
- `apps/api/app/schemas.py`도 동일한 source-aware 필터 구조를 반영해, 로컬 API/테스트/CLI가 같은 계약을 공유하게 한다.
- `crawl-info`, `sync`, `filter-options` 요청은 모두 `sourceKey` 기준으로 source-specific payload를 받는다.

### JobKorea filter metadata

- 잡코리아 검색 페이지의 현재 옵션 목록을 읽어 `직무`, `근무지역`, `학력`, `기업형태`, `고용형태`, `산업`, `직급/직책`, `우대전공`, `자격증`, `우대조건`, `복리후생` 메타데이터를 내려준다.
- 메타데이터 응답은 관리자 UI가 체크박스, 검색형 picker, 셀렉트 입력을 구성하는 단일 원본이 된다.
- 옵션 수가 많은 `major`, `license`, `industry`, `local`은 검색형 입력을 전제로 하고, 서버는 원본 코드와 표시명을 함께 반환한다.
- 메타데이터 조회는 매 요청마다 외부 페이지를 다시 긁지 않도록 TTL 캐시를 둔다.

### JobKorea payload builder

- 별도 helper에서 `JobKoreaSearchFilters`를 잡코리아 `condition[...]` payload와 상위 파라미터(`page`, `direct`, `order`, `pagesize`, `tabindex`, `onePick`, `confirm`, `profile`)로 변환한다.
- UI 상태와 잡코리아 전송 형식이 일치하지 않는 항목은 builder가 흡수한다.
  - `career_start` / `career_end`
  - `salary_type` / `salary_input`
  - `position` 관련 선택값
  - `textinclude` / `textexclude`
- 빈 필터일 때는 현재 `SEARCH_PAYLOAD`와 동일한 preset을 기준으로 payload를 만든다.

### Admin UI

- `SourceSyncConsole`은 공통 페이지 범위 입력/결과 표시를 유지하고, source-specific 필터 패널만 분기한다.
- `remember`와 `jobkorea`는 각각 전용 panel/helper를 가진다.
- 잡코리아 패널은 아래 항목을 여기서 모두 설정할 수 있어야 한다.
  - 직무
  - 근무지역
  - 경력
  - 학력
  - 기업형태
  - 고용형태
  - 산업
  - 직급/직책
  - 연봉
  - 우대전공
  - 자격증
  - 우대조건
  - 복리후생
  - 포함 키워드
  - 제외 키워드
  - 즉시지원만
  - 확인한 공고 제외
- 관리자 화면은 현재 설정값 기준의 잡코리아 원본 검색 URL도 함께 보여준다.

## Data Flow

1. 운영자가 `crawler-admin`에서 잡코리아 필터를 설정한다.
2. 화면은 `/api/sources/filter-options`로 옵션 목록을 받고, `/api/sources/crawl-info`로 총 건수/총 페이지 수를 조회한다.
3. 두 요청 모두 `python-cli.ts`를 거쳐 `source_admin.py` 서브커맨드를 호출한다.
4. Python 쪽에서 잡코리아 payload builder를 사용해 동일한 검색 조건을 만든다.
5. 운영자가 동기화를 실행하면 같은 builder 결과로 `run_source_sync_with_filters()`를 호출한다.
6. 크롤러는 Supabase Postgres에 동기화 결과를 저장하고, `job_sync_runs`에 실행 결과를 남긴다.

## Error Handling

- 잘못된 페이지 범위는 `crawler-admin` route에서 먼저 막는다.
- 잘못된 잡코리아 필터 조합은 TypeScript 입력 검증과 Python builder 검증 둘 다에서 막는다.
- 외부 옵션 메타데이터 파싱이 실패하면 관리자 화면에는 에러 메시지를 보여주고, 기존 동기화 preset 실행은 유지한다.
- 옵션 메타데이터 캐시가 만료되기 전까지는 일시적인 잡코리아 프론트 변경에도 화면이 즉시 깨지지 않게 한다.
- `crawl-info`와 `sync`가 서로 다른 payload를 만들지 않도록 builder를 단일 함수 경로로 강제한다.

## Scope

### In scope

- `crawler-admin`에서 잡코리아 상세검색 필터 전체 설정
- 필터 옵션 메타데이터 조회용 로컬 관리자 API
- 잡코리아 필터 payload builder
- 필터 기반 `crawl-info` / `sync` 실행
- 잡코리아 원본 검색 URL 생성
- 관련 테스트와 관리자 빌드 검증

### Out of scope

- `apps/web` 사용자 화면에 크롤링 UI 노출
- 잡코리아 미검증 필터의 신규 지원
- 프로덕션 공개 관리자 화면
- 전체 잡코리아 무필터 동기화를 기본 동작으로 바꾸는 것

## Risks

- 잡코리아 검색 페이지 DOM/스크립트가 바뀌면 옵션 파서가 깨질 수 있다.
- `major`, `license`, `industry`, `local` 옵션 수가 많아 UI 입력 방식이 과도하게 무거워질 수 있다.
- `crawl-info`와 `sync`가 서로 다른 기본값을 쓰면 사용자가 본 총 페이지 수와 실제 동기화 범위가 어긋날 수 있다.
- 현재 `source_admin.py`는 source-neutral 구조가 약하므로, `filter-options` 추가 시 커맨드 분기가 빠르게 커질 수 있다.

## Non-Goals

- 크롤링 실행 경로를 다시 `apps/web`로 되돌리지 않는다.
- 잡코리아 옵션 코드를 프론트에 하드코딩하지 않는다.
- 리멤버 필터 UX를 이번 작업에서 다시 설계하지 않는다.
