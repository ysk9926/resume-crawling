---
title: Postings Tabbed Query Design
date: 2026-05-18
status: approved
---

# Postings Tabbed Query Design

공고 페이지를 단일 전체목록 조회에서 탭별 전용 조회 API + 서버 페이지네이션 구조로 전환한다.

## Goals

- 탭별로 독립된 조회 API를 둔다.
- 탭별 필터 규칙을 서버에 고정한다.
- 페이지 단위 조회로 응답 크기와 렌더 비용을 낮춘다.

## API

- `GET /api/postings/overview`
- `GET /api/postings/all`
- `GET /api/postings/new`
- `GET /api/postings/interesting`
- `GET /api/postings/ignored`
- `GET /api/postings/bookmarked`
- `GET /api/postings/todo`

공통 파라미터는 `q`, `source_key`, `page`, `page_size`.

## Filter Rules

- `all`: 검색어/수집원만 적용
- `new`: `curation_status = "new"`
- `interesting`: `curation_status = "interesting"`
- `ignored`: `curation_status = "ignored"`
- `bookmarked`: `is_bookmarked = true`
- `todo`: `is_todo = true`

## UI

- 상단 탭 스트립은 overview count를 표시한다.
- 필터 바는 `q`, `source`만 유지한다.
- 목록은 서버 페이지네이션으로 `page` 쿼리스트링을 사용한다.
