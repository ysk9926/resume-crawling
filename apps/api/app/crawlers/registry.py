from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from .base import Crawler
from .jobkorea import JobKoreaCrawler
from .kofia import KofiaCrawler
from .remember import RememberCrawler


@dataclass(frozen=True, slots=True)
class SourceDefinition:
    key: str
    name: str
    base_url: str


CRAWLER_REGISTRY: dict[str, type[Crawler]] = {
    JobKoreaCrawler.source_key: JobKoreaCrawler,
    KofiaCrawler.source_key: KofiaCrawler,
    RememberCrawler.source_key: RememberCrawler,
}


def get_crawler(source_key: str, filters: Mapping[str, Any] | None = None) -> Crawler:
    crawler_class = CRAWLER_REGISTRY.get(source_key)
    if crawler_class is None:
        raise KeyError(f"Unknown crawler source: {source_key}")
    return crawler_class(filters=filters)


def list_source_definitions() -> list[SourceDefinition]:
    return [
        SourceDefinition(key=crawler_class.source_key, name=crawler_class.display_name, base_url=crawler_class.base_url)
        for crawler_class in CRAWLER_REGISTRY.values()
    ]
