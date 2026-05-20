# Resume Workbench

로컬 PC 전용 취업 공고 수집 / 이력서 관리 / 지원 현황 추적 도구입니다.
모든 데이터는 외부 서비스 없이 로컬 SQLite 파일 하나(`data/resume-tracker.db`)에 저장됩니다.
앱 진입은 로컬 계정 로그인 기반이며, 첫 가입자는 자동으로 관리자 권한을 받습니다.

- **Web**: Next.js (App Router) — `http://127.0.0.1:3334`
- **API**: FastAPI + SQLAlchemy + SQLite — `http://127.0.0.1:3335`
- **DB**: 레포 루트의 `data/resume-tracker.db` (자동 생성)

## 1. 요구 사항

| 도구 | 버전 | 설치 |
|------|------|------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 10.33.0 | `corepack enable && corepack prepare pnpm@10.33.0 --activate` |
| Python | 3.14+ | https://www.python.org/downloads |
| uv | 최신 | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |

> macOS 기준 가이드입니다. Windows의 경우 셸 명령만 동등한 것으로 바꾸면 동일하게 동작합니다.

## 2. 최초 셋업

```bash
# 1) 레포 클론 후 루트에서
pnpm bootstrap
```

`pnpm bootstrap`은 두 가지를 수행합니다.

1. `pnpm install` — 워크스페이스 전체의 Node 의존성 설치
2. `uv sync --project apps/api` — FastAPI 쪽 Python 가상환경 생성 및 의존성 설치

이 시점에는 아직 DB 파일이 생성되지 않습니다. **DB는 API 서버를 처음 띄울 때 자동으로 만들어집니다.**

## 3. 로컬 DB 동작 방식

- DB 파일 경로: `<repo>/data/resume-tracker.db` (SQLite)
- 경로 설정: `apps/api/app/config.py`
  - `APP_DATA_DIR` 환경 변수로 디렉터리 변경 가능
  - `APP_DB_PATH` 환경 변수로 파일 경로 직접 지정 가능
- 스키마 관리: 별도 마이그레이션 도구 없이 FastAPI `lifespan` 훅에서
  - `Base.metadata.create_all()` 로 테이블 자동 생성
  - `_ensure_sqlite_columns()` 로 누락 컬럼/인덱스 자동 보강
- 시드 데이터:
  - 크롤러 레지스트리에 등록된 소스(`jobkorea`, `kofia`)가 `sources` 테이블에 자동 upsert
  - 비어 있으면 `apps/web/lib/master-resume-template.md` 가 마스터 이력서 템플릿으로 등록

따라서 **첫 실행 = DB 생성 + 스키마 생성 + 시드** 가 한 번에 끝납니다.
DB를 초기화하고 싶으면 `data/resume-tracker.db` 파일을 지우고 서버만 다시 띄우면 됩니다.

```bash
# DB 초기화
rm data/resume-tracker.db
pnpm dev   # 재실행 시 새로 생성됨
```

## 4. 개발 서버 실행

```bash
pnpm dev
```

`concurrently` 로 web / api 두 프로세스를 함께 띄웁니다.

- web: `pnpm --dir apps/web dev` → `http://127.0.0.1:3334`
- api: `uv run --directory apps/api uvicorn app.main:app --reload --host 127.0.0.1 --port 3335`

API 단독 실행도 가능합니다.

```bash
pnpm dev:web   # Next.js 만
pnpm dev:api   # FastAPI + DB 부트스트랩만
```

서버가 떠 있는 동안 `GET http://127.0.0.1:3335/health` 가 `{"status":"ok"}` 를 돌려주면 정상입니다.

## 4-1. 로그인 / 권한

- 웹 앱은 로그인 후에만 접근할 수 있습니다.
- 최초 회원가입 사용자는 자동으로 `admin` 권한을 받아 공고 동기화를 실행할 수 있습니다.
- 이후 가입 사용자는 기본적으로 개인 공고 상태, 이력서, 지원 현황만 관리할 수 있습니다.
- 공유 데이터:
  - `sources`, `job_postings`, `job_sync_runs`
- 사용자별 데이터:
  - 공고 큐레이션 상태 / 찜 / 작성예정
  - 이력서 템플릿
  - 지원 현황 / 자소서 문항

## 5. 공고 수집 (크롤러)

크롤러는 `apps/api/app/crawlers/` 아래 사이트별 모듈로 정의되어 있고, 현재 `jobkorea`, `kofia` 가 등록되어 있습니다.

웹 UI(`/postings`)에서 소스별 "동기화" 버튼으로 실행할 수도 있고, CLI 로도 가능합니다.

```bash
# 특정 소스를 페이지 범위로 동기화
pnpm api:sync kofia --start-page 1 --end-page 2
```

내부적으로 `apps/api/app/scripts/sync_source.py` 가 실행되어 결과를 stdout 으로 출력합니다.

새 사이트를 추가하려면:

1. `apps/api/app/crawlers/<site>.py` 를 만들고 `Crawler` 베이스를 상속
2. `apps/api/app/crawlers/registry.py` 의 `CRAWLER_REGISTRY` 에 등록
3. 서버 재시작 시 `seed_sources()` 가 자동으로 `sources` 테이블에 반영

## 6. 자주 쓰는 명령

| 명령 | 설명 |
|------|------|
| `pnpm bootstrap` | Node + Python 의존성 일괄 설치 |
| `pnpm dev` | web + api 동시 실행 |
| `pnpm dev:web` / `pnpm dev:api` | 한쪽만 실행 |
| `pnpm lint` | Next.js ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm api:test` | FastAPI 측 pytest |
| `pnpm api:sync <source_key>` | 단일 크롤러 동기화 |

## 7. 디렉터리 구조

```
resume/
├─ apps/
│  ├─ web/                Next.js App Router UI
│  └─ api/                FastAPI + SQLite + 크롤러
│     └─ app/
│        ├─ main.py       FastAPI 엔트리, lifespan에서 DB 부트스트랩
│        ├─ config.py     DB 경로 및 캐시 TTL 설정
│        ├─ database.py   SQLAlchemy 엔진/세션
│        ├─ models.py     ORM 모델
│        ├─ seed.py       소스 / 마스터 이력서 시드
│        ├─ crawlers/     사이트별 크롤러 + 레지스트리
│        ├─ services/     비즈니스 로직 (sync 등)
│        ├─ api/routes/   FastAPI 라우터
│        └─ scripts/      CLI 스크립트 (sync_source.py)
├─ packages/shared/       web/api 공용 타입·상수
└─ data/                  로컬 DB 저장 위치 (gitignored)
```

## 8. 트러블슈팅

- **`uv: command not found`** — 위 설치 가이드대로 `uv` 를 설치하거나 `brew install uv` 사용.
- **`Python 3.14` 가 없다고 함** — `uv python install 3.14` 로 설치 후 다시 `pnpm bootstrap`.
- **DB 스키마가 꼬였을 때** — `data/resume-tracker.db` 삭제 후 `pnpm dev` 재실행.
- **포트 충돌** — 3334(web), 3335(api). 점유 중인 프로세스를 종료하거나 `next dev` / `uvicorn` 명령의 포트를 수정.
- **CORS 오류** — API 는 `127.0.0.1:3334` / `localhost:3334` 만 허용합니다(`apps/api/app/main.py`). 다른 호스트로 띄우려면 화이트리스트를 수정.
