from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol


@dataclass(slots=True)
class CrawledJobPosting:
    external_id: str
    company_name: str
    title: str
    detail_url: str
    external_apply_url: str | None
    posted_at: date | None
    apply_period_raw: str | None
    apply_start_date: date | None
    apply_end_date: date | None
    raw_content: str
    normalized_content: str
    tags: list[str]


class Crawler(Protocol):
    source_key: str
    display_name: str
    base_url: str

    def crawl(self, page_limit: int = 1) -> list[CrawledJobPosting]:
        ...
