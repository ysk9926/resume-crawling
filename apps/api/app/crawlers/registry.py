from __future__ import annotations

from dataclasses import dataclass

from .base import Crawler
from .jobkorea import JobKoreaCrawler
from .kofia import KofiaCrawler


@dataclass(frozen=True, slots=True)
class SourceDefinition:
    key: str
    name: str
    base_url: str


CRAWLER_REGISTRY: dict[str, type[Crawler]] = {
    JobKoreaCrawler.source_key: JobKoreaCrawler,
    KofiaCrawler.source_key: KofiaCrawler,
}


def get_crawler(source_key: str) -> Crawler:
    crawler_class = CRAWLER_REGISTRY.get(source_key)
    if crawler_class is None:
        raise KeyError(f"Unknown crawler source: {source_key}")
    return crawler_class()


def list_source_definitions() -> list[SourceDefinition]:
    return [
        SourceDefinition(key=crawler_class.source_key, name=crawler_class.display_name, base_url=crawler_class.base_url)
        for crawler_class in CRAWLER_REGISTRY.values()
    ]
