from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import math
import re
from typing import Any, Mapping
from urllib.parse import parse_qs, urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, Tag

from app.crawlers.base import CrawlInfo, CrawledJobPosting
from app.utils.dates import parse_date, parse_date_range
from app.utils.text import derive_tags, normalize_whitespace


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0 Safari/537.36"
)
TOTAL_ITEMS_PATTERN = re.compile(r"총\s*([\d,]+)\s*건의 게시물이 검색되었습니다")


@dataclass(slots=True)
class KofiaDetail:
    company_name: str
    title: str
    external_apply_url: str | None
    apply_period_raw: str | None
    apply_start_date: date | None
    apply_end_date: date | None
    raw_content: str
    normalized_content: str
    tags: list[str]


class KofiaCrawler:
    source_key = "kofia"
    display_name = "KOFIA 채용안내"
    base_url = "https://www.kofia.or.kr/brd/m_96/list.do"

    def __init__(
        self,
        client: httpx.Client | None = None,
        filters: Mapping[str, Any] | None = None,
    ) -> None:
        self.client = client or httpx.Client(
            follow_redirects=True,
            timeout=20.0,
            headers={"User-Agent": USER_AGENT},
        )
        self._owns_client = client is None
        self._is_closed = False
        _ = filters

    def get_crawl_info(self, page: int = 1) -> CrawlInfo:
        if page < 1:
            raise ValueError("조회 페이지는 1 이상이어야 합니다.")

        soup = self._fetch_list_page(page)
        total_items = self._extract_total_items(soup)
        total_pages = self._extract_total_pages(soup, total_items)
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
        rows = soup.select("table.common2 tbody tr") or soup.select("table.common1 tbody tr")

        postings: list[CrawledJobPosting] = []
        for row in rows:
            cells = row.find_all("td")
            link = row.select_one("td.left a[href*='view.do']")
            if len(cells) < 4 or link is None:
                continue

            detail_url = urljoin(self.base_url, link["href"])
            external_id = parse_qs(urlparse(detail_url).query).get("seq", [""])[0]
            if not external_id:
                continue

            listed_company_name = cells[1].get_text(" ", strip=True)
            listed_title = link.get_text(" ", strip=True)
            posted_at = parse_date(cells[-1].get_text(" ", strip=True))

            detail = self._fetch_detail(detail_url)
            postings.append(
                CrawledJobPosting(
                    external_id=external_id,
                    company_name=detail.company_name or listed_company_name,
                    title=detail.title or listed_title,
                    detail_url=detail_url,
                    external_apply_url=detail.external_apply_url,
                    posted_at=posted_at,
                    apply_period_raw=detail.apply_period_raw,
                    apply_start_date=detail.apply_start_date,
                    apply_end_date=detail.apply_end_date,
                    raw_content=detail.raw_content,
                    normalized_content=detail.normalized_content,
                    tags=detail.tags,
                )
            )

        return postings

    def _fetch_list_page(self, page: int) -> BeautifulSoup:
        response = self.client.get(self.base_url, params={"page": page})
        response.raise_for_status()
        return BeautifulSoup(response.text, "html.parser")

    def _fetch_detail(self, detail_url: str) -> KofiaDetail:
        response = self.client.get(detail_url)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        title = self._get_cell_text(soup, "제목")
        company_name = self._get_cell_text(soup, "회원사명")
        apply_period_raw = self._get_cell_text(soup, "접수기간")
        apply_start_date, apply_end_date = parse_date_range(apply_period_raw)

        external_apply_url = None
        site_row = self._get_cell(soup, "사이트바로가기")
        if site_row is not None:
            site_link = site_row.find("a", href=True)
            if site_link:
                external_apply_url = site_link["href"]

        content_container = soup.select_one("#write")
        raw_content = content_container.get_text("\n", strip=True) if content_container else ""
        normalized_content = normalize_whitespace(raw_content)

        return KofiaDetail(
            company_name=company_name,
            title=title,
            external_apply_url=external_apply_url,
            apply_period_raw=apply_period_raw,
            apply_start_date=apply_start_date,
            apply_end_date=apply_end_date,
            raw_content=raw_content,
            normalized_content=normalized_content,
            tags=derive_tags(title, normalized_content),
        )

    def _get_cell_text(self, soup: BeautifulSoup, label: str) -> str:
        cell = self._get_cell(soup, label)
        return cell.get_text(" ", strip=True) if cell is not None else ""

    def _get_cell(self, soup: BeautifulSoup, label: str) -> Tag | None:
        for row in soup.select("table.common1 tbody tr"):
            header = row.find("th")
            if header is None:
                continue
            if header.get_text(" ", strip=True) != label:
                continue
            return row.find("td")
        return None

    def _extract_total_items(self, soup: BeautifulSoup) -> int:
        count_node = soup.select_one("span.mgr10 em.brown")
        if count_node is not None:
            count_text = count_node.get_text("", strip=True).replace(",", "")
            if count_text.isdigit():
                return int(count_text)

        match = TOTAL_ITEMS_PATTERN.search(soup.get_text(" ", strip=True))
        if match:
            return int(match.group(1).replace(",", ""))

        raise ValueError("총 게시물 수를 찾을 수 없습니다.")

    def _extract_total_pages(self, soup: BeautifulSoup, total_items: int) -> int:
        last_page_image = soup.find("img", alt="마지막 페이지로 가기")
        if last_page_image is not None and last_page_image.parent is not None:
            last_href = last_page_image.parent.get("href", "")
            last_page = parse_qs(urlparse(last_href).query).get("page", [""])[0]
            if last_page.isdigit():
                return max(1, int(last_page))

        visible_pages: list[int] = []
        for node in soup.select("#currentPage #number a, #currentPage #number em"):
            text = node.get_text(" ", strip=True)
            if text.isdigit():
                visible_pages.append(int(text))
        if visible_pages:
            return max(visible_pages)

        rows = soup.select("table.common2 tbody tr") or soup.select("table.common1 tbody tr")
        page_size = max(len(rows), 1)
        return max(1, math.ceil(total_items / page_size))
