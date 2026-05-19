---
title: Remember Sync Filters Design
date: 2026-05-19
status: approved
---

# Remember Sync Filters Design

리멤버 채용공고를 HTTP API로 수집하고, 대시보드에서 리멤버 웹 필터와 유사한 조건을 지정해 원하는 공고만 동기화할 수 있게 만든다.

## Goals

- 리멤버를 신규 크롤링 소스로 추가한다.
- 동기화 전 필터 기준 총 공고 수와 총 페이지 수를 조회할 수 있게 한다.
- 대시보드에서 지정한 필터와 동일한 조건으로 리멤버 원본 페이지를 열 수 있게 한다.

## API Contract

- `POST /api/sources/{source_key}/crawl-info`
- `POST /api/sources/{source_key}/sync`

공통으로 리멤버 전용 필터 payload를 받을 수 있다.

- `keywords`
- `min_salary`
- `max_salary`
- `addresses`
- `career_year`
- `company_sizes`
- `industry_v2_names`
- `leader_position`
- `organization_type`
- `application_type`
- `include_applied_job_posting`

기존 `GET /api/sources/{source_key}/crawl-info` 는 그대로 유지한다.

## Crawler

- 목록 조회는 `POST https://career-api.rememberapp.co.kr/job_postings/search`
- 상세 조회는 `GET https://career-api.rememberapp.co.kr/job_postings/{id}`
- 목록 응답의 `meta.total_count`, `meta.total_pages` 를 페이지 정보로 사용한다.
- 실제 저장 데이터는 상세 응답 기준으로 만든다.

## UI

- 기존 소스는 페이지 범위 동기화 UI를 그대로 사용한다.
- `remember` 소스일 때만 필터 패널을 추가로 보여준다.
- 사용자는 페이지 범위와 필터를 함께 지정할 수 있다.
- 같은 필터를 Remember 웹 `search` 쿼리스트링으로 변환해 원본 페이지 링크를 제공한다.

## Scope

- 이번 범위에는 `직무` 필터와 경력 슬라이더 범위값은 포함하지 않는다.
- 이번 범위에는 확인된 필터만 넣는다.
  - 키워드
  - 연봉 범위
  - 지역
  - 경력 무관
  - 기업 유형
  - 산업/업종
  - 리더급
  - 헤드헌팅 포함 여부
  - 간편 지원만
  - 지원한 공고 포함
