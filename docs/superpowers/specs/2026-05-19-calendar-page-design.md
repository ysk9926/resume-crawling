---
title: Calendar Page Design
date: 2026-05-19
status: approved
---

# Calendar Page Design

`/calendar`에 월간 캘린더 페이지를 추가해 공고 마감일과 지원 일정을 한 화면에서 본다.

## Goals

- 공고와 지원 현황을 월간 캘린더에서 함께 본다.
- 사용자가 체크박스로 보고 싶은 일정 종류만 켜고 끈다.
- 항목 클릭 시 작은 팝오버에서 요약을 보고 원본 화면으로 이동한다.

## Scope

- 첫 버전은 월간 뷰만 제공한다.
- 새 페이지 경로는 `/calendar`다.
- 기존 `공고`, `지원 현황` 상세 흐름은 유지하고 캘린더는 진입점 역할만 한다.

## Event Model

- 백엔드는 월간 전용 응답을 내려준다.
- 이벤트 공통 필드:
  - `id`
  - `kind`
  - `layer_keys`
  - `date`
  - `title`
  - `company_name`
  - `source_label`
  - `status_label`
  - `href`
  - `badges`
- `kind` 값:
  - `posting`
  - `application`
- `layer_keys` 값:
  - `posting_deadline`
  - `posting_bookmark`
  - `posting_todo`
  - `application_planned`
  - `application_applied`

## Data Rules

- 공고 이벤트는 `apply_end_date`가 있는 공고만 포함한다.
- 지원 이벤트는 `planned` 상태면 `apply_end_date_snapshot` 기준, `applied` 상태면 `applied_at` 기준으로 포함한다.
- `document_passed`, `interview`, `offer`, `rejected`, `withdrawn`는 첫 버전 캘린더 기본 레이어에서 제외한다.
- 같은 공고가 `찜`과 `작성 예정`을 동시에 가지면 이벤트를 중복 생성하지 않고 `layer_keys`와 배지로 함께 표현한다.
- 날짜가 없는 항목은 캘린더에 올리지 않는다.

## API

- `GET /api/calendar?month=YYYY-MM`
- 응답 필드:
  - `month`
  - `month_start`
  - `month_end`
  - `events`
- API는 전달받은 월의 시작일과 마지막일 범위 안의 이벤트만 반환한다.

## UI

- 상단에 현재 월, 이전/다음 월 이동, 체크박스 필터를 둔다.
- 체크박스 항목:
  - `공고 마감일`
  - `찜한 공고`
  - `작성 예정`
  - `지원 예정`
  - `지원 완료`
- 날짜 셀 안에는 공고 계열과 지원 계열을 서로 다른 색상군으로 표시한다.
- 셀당 노출 개수는 제한하고 초과분은 `+N개 더보기`로 표시한다.
- 이벤트 클릭 시 작은 팝오버에서 회사명, 제목, 일정 종류, 날짜, 배지, 이동 링크를 보여준다.

## Navigation

- 사이드바에 `캘린더` 메뉴를 추가한다.
- 팝오버 링크는 이벤트 종류에 따라 `/postings` 또는 `/applications` 원본 화면으로 이동한다.

## Error Handling

- API 실패 시 기존 공용 `ApiUnavailable` 화면을 재사용한다.
- 월에 해당 일정이 없으면 빈 캘린더와 함께 안내 문구를 보여준다.

## Testing

- API 테스트:
  - 월 범위 필터링
  - 이벤트 종류 매핑
  - `찜`/`작성 예정` 배지 결합
- 웹 테스트:
  - 월간 캘린더 렌더링
  - 체크박스 필터 반영
  - 팝오버 링크 노출
  - 빈 상태 렌더링
