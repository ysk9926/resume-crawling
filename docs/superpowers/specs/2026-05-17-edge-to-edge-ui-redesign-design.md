---
title: Edge-to-Edge UI Redesign (erp-base parity)
date: 2026-05-17
status: approved
---

# Edge-to-Edge UI Redesign

기존 글래스모피즘/그라데이션 기반 UI를 erp-base 방식의 라인 기반 슬릭·플랫 레이아웃으로 전환한다.

## Core Principles

- **Edge-to-edge**: 최상위 컨테이너는 `height: 100vh; overflow: hidden; display: flex`. 외곽 margin 없음.
- **No box spacing**: 카드/섹션 간 `gap`, `margin`, 외곽 padding 금지. 섹션 내부 padding(20~24px)만 허용.
- **Line-based separation**: `borderBottom: "1px solid var(--rw-border)"`, `borderRight` 만 사용.
- **Slick & flat**: shadow 금지, `border-radius: 0~4px`, 흰 배경 + `#eaeaea` 보더.
- **Grid splits**: KPI 등은 `display: grid; gridTemplateColumns: "repeat(N, 1fr)"` + 각 칸 `borderRight`.
- **Compact typography**: 섹션 타이틀 13px/600, 캡션 10~11px, 본문 12px. Pretendard + tabular-nums.

## Design Tokens (globals.css)

```
--rw-accent: #065f46       /* emerald, 현 정체성 유지 */
--rw-accent-light: #d1fae5
--rw-background: #ffffff
--rw-foreground: #0a0a0a
--rw-muted: #666666
--rw-border: #eaeaea
--rw-sidebar-bg: #fafafa
--rw-sidebar-active: #e8e8e8
--rw-table-header: #fafafa
--rw-success: #10b981
--rw-warning: #f5a623
--rw-error: #ee0000
```

Font: Pretendard Variable (CDN) → fallback Apple SD Gothic Neo, Noto Sans KR.
Body: `font-feature-settings: "tnum"`.

## Layout

```
<html>
  <body>                                  /* h-100vh overflow-hidden */
    <div .app-root>                       /* flex h-100vh overflow-hidden */
      <Sidebar />                         /* 220px, borderRight, collapsible */
      <main>                              /* flex-1 flex-col overflow-hidden */
        <PageHeader />                    /* 56~72px, borderBottom */
        <div .page-body>                  /* flex-1 overflow-auto */
          {children}
        </div>
      </main>
    </div>
  </body>
</html>
```

### Sidebar

- 220px (collapsed 64px). `localStorage`에 접힘 상태 저장.
- Header (56px, borderBottom): "Resume Workbench" 워드마크 + 토글 버튼.
- 4 nav items (플랫, 그룹 없음):
  - Dashboard / 공고 / 이력서 / 지원 현황
- 각 항목: 아이콘(react-icons hi outline) + 라벨, active 시 `--rw-sidebar-active` 배경 + accent 텍스트.
- Footer (borderTop): 정적 "로컬 전용" 캡션.

### PageHeader

erp-base `DemoPageHeader` 그대로. 좌측 title + description, 우측 stats grid + action 버튼. 모두 borderLeft로 구분.

## Pages

### Dashboard `/`
- PageHeader: stats = [수집 공고, 관심 공고, 진행 지원, 이력서] — 액션 없음
- Body는 세로 스택, 섹션은 `borderBottom`으로만 구분:
  1. 등록된 수집원: 좌측 메타 / 우측 동기화 버튼, row마다 borderBottom
  2. Two-column split (`grid-cols-[1.4fr_1fr]` + middle borderRight):
     - 최근 공고 (테이블 row)
     - 우측 위: 최근 지원 (라인 리스트)
     - 우측 아래: 동기화 이력 (라인 리스트)

### Postings `/postings`
- PageHeader: stats = [전체, new, interesting, ignored] + 액션 = "필터 초기화"
- 필터 바 (borderBottom): 검색 input + curation select + source select + 적용 버튼
- 본문: 테이블 — 회사, 제목, 상태, 태그, 등록일, 액션
- 행 클릭 시 우측에서 drawer/inline expand로 메모/지원생성 폼 (라인 분리). MVP는 inline expand로.

### Resumes `/resumes`
- PageHeader: stats = [템플릿 수, 마지막 수정] + 액션 = "새 템플릿"
- Body split (`grid-cols-[260px_1fr]` borderRight):
  - 좌: 템플릿 리스트 (선택 시 active)
  - 우: 편집 폼 (title, summary, markdown textarea, 저장)
- 새 템플릿 액션 클릭 시 우측에 빈 폼 표시.

### Applications `/applications`
- PageHeader: stats = [전체, planned, in-progress, offer, rejected] + 액션 없음
- Body split (`grid-cols-[320px_1fr]` borderRight):
  - 좌: 지원 리스트 (회사 · 직무 · status badge)
  - 우: 편집 폼 — status select, applied_at, note, markdown snapshot

## Components

새 컴포넌트 (`apps/web/components/ui/`):
- `Sidebar.tsx` (client)
- `PageHeader.tsx` — title, description, stats[], action
- `StatusBadge.tsx` — status tone 매핑 유지 (neutral/info/success/warning/danger)
- `LineList.tsx` — borderBottom row container
- `EmptyState.tsx` — 라인 기반 리뉴얼
- `ApiUnavailable.tsx` — flat 리뉴얼

기존 `section-card.tsx`, `status-pill.tsx`, `site-nav.tsx`는 제거.

## Migration

- `app/globals.css` 전체 교체 (tokens, body height/overflow, Pretendard)
- `app/layout.tsx` — gradient/glass header 제거, Sidebar layout으로
- 4개 page.tsx 전면 재작성. 서버 컴포넌트 + server actions 흐름 유지.

## Out of Scope

- 새 인터랙션 (drawer/modal/chatbot) 도입 안 함
- 데이터 모델/액션 변경 없음
- 모바일 별도 디자인 — desktop 우선
