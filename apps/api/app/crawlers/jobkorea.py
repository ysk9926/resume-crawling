from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import math
import re
from typing import Any, Callable, Mapping
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup, Tag

from app.crawlers.base import CrawlInfo, CrawledJobPosting
from app.crawlers.jobkorea_filters import (
    LIST_API_URL,
    PAGE_SIZE,
    ROOT_URL,
    SEARCH_PAGE_URL,
    USER_AGENT,
    build_jobkorea_list_request_payload,
)
from app.utils.text import derive_tags, normalize_whitespace
POSTED_DAYS_AGO_PATTERN = re.compile(r"(\d+)\s*일\s*전")
DEADLINE_D_DAY_PATTERN = re.compile(r"D-(\d+)")
MONTH_DAY_PATTERN = re.compile(r"(\d{2})/(\d{2})")


@dataclass(slots=True)
class JobKoreaRow:
    external_id: str
    company_name: str
    title: str
    detail_url: str
    external_apply_url: str | None
    posted_at: date | None
    apply_start_date: date | None
    apply_end_date: date | None
    apply_period_raw: str | None
    raw_content: str
    normalized_content: str
    tags: list[str]


class JobKoreaCrawler:
    source_key = "jobkorea"
    display_name = "잡코리아 상세검색"
    base_url = SEARCH_PAGE_URL

    def __init__(
        self,
        client: httpx.Client | None = None,
        today_provider: Callable[[], date] | None = None,
        filters: Mapping[str, Any] | None = None,
    ) -> None:
        self.client = client or httpx.Client(
            follow_redirects=True,
            timeout=20.0,
            headers={
                "User-Agent": USER_AGENT,
                "Referer": SEARCH_PAGE_URL,
                "X-Requested-With": "XMLHttpRequest",
            },
        )
        self._owns_client = client is None
        self._is_closed = False
        self._today_provider = today_provider or date.today
        self._filters = filters

    def get_crawl_info(self, page: int = 1) -> CrawlInfo:
        if page < 1:
            raise ValueError("조회 페이지는 1 이상이어야 합니다.")

        soup = self._fetch_list_page(page)
        total_items = self._extract_total_items(soup)
        total_pages = max(1, math.ceil(total_items / PAGE_SIZE))
        return CrawlInfo(current_page=page, total_pages=total_pages, total_items=total_items)

    def crawl(self, start_page: int = 1, end_page: int = 1) -> list[CrawledJobPosting]:
        if start_page < 1:
            raise ValueError("시작 페이지는 1 이상이어야 합니다.")
        if end_page < start_page:
            raise ValueError("종료 페이지는 시작 페이지보다 크거나 같아야 합니다.")

        postings: list[CrawledJobPosting] = []
        try:
            for page in range(start_page, end_page + 1):
                postings.extend(self._crawl_page(page))
            return postings
        finally:
            self.close()

    def close(self) -> None:
        if self._owns_client and not self._is_closed:
            self.client.close()
            self._is_closed = True

    def _crawl_page(self, page: int) -> list[CrawledJobPosting]:
        soup = self._fetch_list_page(page)
        rows = soup.select("tr.devloopArea[data-gno]")
        postings: list[CrawledJobPosting] = []

        for row in rows:
            parsed = self._parse_row(row)
            if parsed is None:
                continue

            postings.append(
                CrawledJobPosting(
                    external_id=parsed.external_id,
                    company_name=parsed.company_name,
                    title=parsed.title,
                    detail_url=parsed.detail_url,
                    external_apply_url=parsed.external_apply_url,
                    posted_at=parsed.posted_at,
                    apply_period_raw=parsed.apply_period_raw,
                    apply_start_date=parsed.apply_start_date,
                    apply_end_date=parsed.apply_end_date,
                    raw_content=parsed.raw_content,
                    normalized_content=parsed.normalized_content,
                    tags=parsed.tags,
                )
            )

        return postings

    def _fetch_list_page(self, page: int) -> BeautifulSoup:
        payload = build_jobkorea_list_request_payload(self._filters, page=page)
        response = self.client.post(LIST_API_URL, data=payload)
        response.raise_for_status()
        return BeautifulSoup(response.text, "html.parser")

    def _parse_row(self, row: Tag) -> JobKoreaRow | None:
        external_id = (row.get("data-gno") or "").strip()
        company_link = row.select_one("td.tplCo a.link[href]")
        title_link = row.select_one("td.tplTit a.link[href]")
        if not external_id or company_link is None or title_link is None:
            return None

        company_name = normalize_whitespace(company_link.get_text(" ", strip=True))
        title = normalize_whitespace(
            title_link.get("title") or title_link.get_text(" ", strip=True)
        )
        detail_url = urljoin(ROOT_URL, title_link["href"])
        external_apply_url = self._extract_apply_url(row, detail_url)

        posted_label = self._extract_text(row.select_one("td.odd span.time"))
        deadline_label = self._extract_text(row.select_one("td.odd span.date"))
        apply_method = self._extract_text(row.select_one("td.odd button span"))
        summary_cells = [
            value
            for value in (
                self._extract_text(cell)
                for cell in row.select("td.tplTit p.etc span.cell")
            )
            if value
        ]
        company_traits = self._extract_company_traits(row)
        description = self._extract_text(row.select_one("td.tplTit p.dsc"))

        posted_at = self._parse_posted_at(posted_label)
        apply_end_date = self._parse_deadline(deadline_label)
        apply_start_date = posted_at
        apply_period_raw = " / ".join(value for value in [posted_label, deadline_label] if value) or None

        raw_lines = [f"회사명: {company_name}", f"공고제목: {title}"]
        if company_traits:
            raw_lines.append(f"기업특성: {', '.join(company_traits)}")
        if summary_cells:
            raw_lines.append(f"공고요약: {', '.join(summary_cells)}")
        if apply_method:
            raw_lines.append(f"지원방식: {apply_method}")
        if description:
            raw_lines.append(f"상세키워드: {description}")
        if posted_label:
            raw_lines.append(f"등록일표기: {posted_label}")
        if deadline_label:
            raw_lines.append(f"마감일표기: {deadline_label}")

        raw_content = "\n".join(raw_lines)
        normalized_content = normalize_whitespace(raw_content)
        tag_content = "\n".join(
            value
            for value in [
                title,
                ", ".join(company_traits),
                ", ".join(summary_cells),
                description,
            ]
            if value
        )

        return JobKoreaRow(
            external_id=external_id,
            company_name=company_name,
            title=title,
            detail_url=detail_url,
            external_apply_url=external_apply_url,
            posted_at=posted_at,
            apply_start_date=apply_start_date,
            apply_end_date=apply_end_date,
            apply_period_raw=apply_period_raw,
            raw_content=raw_content,
            normalized_content=normalized_content,
            tags=derive_tags(title, tag_content),
        )

    def _extract_apply_url(self, row: Tag, detail_url: str) -> str | None:
        homepage_button = row.select_one("button.devApplyEtc[data-info]")
        if homepage_button is not None:
            data_info = (homepage_button.get("data-info") or "").strip()
            if data_info:
                return urljoin(ROOT_URL, data_info)

        direct_apply_button = row.select_one("button.dev-btn-apply")
        if direct_apply_button is not None:
            return detail_url

        return None

    def _extract_company_traits(self, row: Tag) -> list[str]:
        traits: list[str] = []
        selectors = [
            "td.tplCo p.info span",
            "td.tplCo .typ a span.blind",
            "td.tplCo .typ span.moreLayer",
        ]
        for selector in selectors:
            for node in row.select(selector):
                label = self._extract_text(node)
                if selector.endswith("span.moreLayer"):
                    label = label or (node.get("title") or "").strip()
                if label and label not in traits:
                    traits.append(label)
        return traits

    def _parse_posted_at(self, label: str | None) -> date | None:
        if not label:
            return None

        today = self._today_provider()
        if "오늘" in label:
            return today
        if "어제" in label:
            return today - timedelta(days=1)

        days_ago_match = POSTED_DAYS_AGO_PATTERN.search(label)
        if days_ago_match:
            return today - timedelta(days=int(days_ago_match.group(1)))

        month_day = self._parse_month_day(label)
        if month_day is not None:
            month, day = month_day
            return self._resolve_month_day(month, day)

        return None

    def _parse_deadline(self, label: str | None) -> date | None:
        if not label:
            return None

        today = self._today_provider()
        compact = label.replace(" ", "")
        if "오늘마감" in compact:
            return today
        if "내일마감" in compact:
            return today + timedelta(days=1)

        d_day_match = DEADLINE_D_DAY_PATTERN.search(compact)
        if d_day_match:
            return today + timedelta(days=int(d_day_match.group(1)))

        month_day = self._parse_month_day(label)
        if month_day is not None:
            month, day = month_day
            return self._resolve_month_day(month, day, prefer_future=True)

        return None

    def _parse_month_day(self, value: str) -> tuple[int, int] | None:
        match = MONTH_DAY_PATTERN.search(value)
        if match is None:
            return None
        return (int(match.group(1)), int(match.group(2)))

    def _resolve_month_day(
        self, month: int, day: int, prefer_future: bool = False
    ) -> date | None:
        today = self._today_provider()
        try:
            candidate = date(today.year, month, day)
        except ValueError:
            return None

        if prefer_future:
            # 잡코리아 마감일 표기 ~MM/DD에는 연도가 없지만, 등록된 공고의 마감은
            # 반드시 today 이후다. 같은 해 후보가 이미 지났다면 내년으로 옮긴다.
            if candidate < today:
                try:
                    return date(today.year + 1, month, day)
                except ValueError:
                    return None
            return candidate

        if candidate > today + timedelta(days=35):
            try:
                return date(today.year - 1, month, day)
            except ValueError:
                return None
        if candidate < today - timedelta(days=330):
            try:
                return date(today.year + 1, month, day)
            except ValueError:
                return None
        return candidate

    def _extract_total_items(self, soup: BeautifulSoup) -> int:
        count_input = soup.select_one("#hdnGICnt")
        if count_input is None:
            raise ValueError("잡코리아 총 공고 수를 찾을 수 없습니다.")

        raw_value = (count_input.get("value") or "").replace(",", "").strip()
        if not raw_value.isdigit():
            raise ValueError("잡코리아 총 공고 수 형식이 올바르지 않습니다.")
        return int(raw_value)

    def _extract_text(self, node: Tag | None) -> str:
        if node is None:
            return ""
        return normalize_whitespace(node.get_text(" ", strip=True))
