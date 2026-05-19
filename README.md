# Resume Workbench

로컬 PC 전용 `Next.js + FastAPI + SQLite` 취업 공고 수집/이력서/지원 현황 관리 도구입니다.

## 구조

- `apps/web`: Next.js App Router UI
- `apps/api`: FastAPI API, SQLite, 크롤러
- `data`: 로컬 DB 저장 위치

## 실행

```bash
pnpm bootstrap
pnpm dev
```

`pnpm dev`를 실행하면 아래 두 프로세스가 함께 실행됩니다.

- `apps/web`: Next.js 클라이언트
- `apps/api`: FastAPI Python 서버

기본 주소는 웹 `http://127.0.0.1:3334`, API `http://127.0.0.1:3335`입니다.

## 주요 개념

- 크롤러는 `apps/api/app/crawlers` 아래 사이트별 모듈로 추가합니다.
- 웹 UI에서는 등록된 소스만 수동 동기화할 수 있습니다.
- 지원 현황에는 해당 지원건의 이력서 Markdown 스냅샷이 저장됩니다.
