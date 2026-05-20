from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, is_dataclass
from datetime import date, datetime
from typing import Any

from app.crawlers.registry import get_crawler
from app.crawlers.jobkorea_filters import get_cached_jobkorea_filter_options
from app.database import Base, SessionLocal, engine
from app.schemas import JobSyncRunOut, SourceCrawlInfoOut
from app.seed import seed_sources
from app.services.sync import run_source_sync_with_filters


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Local admin helpers for source crawl-info and sync commands.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    crawl_info = subparsers.add_parser("crawl-info", help="Fetch crawl metadata for a source.")
    crawl_info.add_argument("source_key", help="Registered source key. Example: remember")
    crawl_info.add_argument("--page", type=int, default=1, help="Page number to inspect")
    crawl_info.add_argument(
        "--filters-json",
        default=None,
        help="JSON string for source-specific filters.",
    )

    filter_options = subparsers.add_parser(
        "filter-options",
        help="Fetch source-specific filter option metadata.",
    )
    filter_options.add_argument("source_key", help="Registered source key. Example: jobkorea")

    sync = subparsers.add_parser("sync", help="Run source synchronization.")
    sync.add_argument("source_key", help="Registered source key. Example: jobkorea")
    sync.add_argument("--start-page", type=int, default=1, help="Start page to crawl")
    sync.add_argument("--end-page", type=int, default=1, help="End page to crawl")
    sync.add_argument(
        "--filters-json",
        default=None,
        help="JSON string for source-specific filters.",
    )

    return parser.parse_args()


def parse_filters(raw_value: str | None) -> dict[str, Any] | None:
    if raw_value is None or not raw_value.strip():
        return None

    try:
        payload = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid filters JSON: {exc.msg}") from exc

    if payload is None:
        return None
    if not isinstance(payload, dict):
        raise ValueError("Filters JSON must decode to an object.")
    return payload


def to_json_ready(value: Any) -> Any:
    if is_dataclass(value):
        return {key: to_json_ready(item) for key, item in asdict(value).items()}
    if isinstance(value, dict):
        return {str(key): to_json_ready(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_json_ready(item) for item in value]
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def print_json(payload: Any) -> None:
    sys.stdout.write(
        json.dumps(to_json_ready(payload), ensure_ascii=False, indent=2, sort_keys=True)
    )
    sys.stdout.write("\n")


def run_crawl_info(source_key: str, page: int, filters: dict[str, Any] | None) -> None:
    crawler = get_crawler(source_key, filters=filters)
    try:
        crawl_info = crawler.get_crawl_info(page=page)
    finally:
        crawler.close()

    output = SourceCrawlInfoOut(
        source_key=source_key,
        current_page=crawl_info.current_page,
        total_pages=crawl_info.total_pages,
        total_items=crawl_info.total_items,
    )
    print_json(output.model_dump(mode="json"))


def run_sync(
    source_key: str,
    start_page: int,
    end_page: int,
    filters: dict[str, Any] | None,
) -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_sources(session)
        sync_run = run_source_sync_with_filters(
            session,
            source_key=source_key,
            start_page=start_page,
            end_page=end_page,
            filters=filters,
        )

    print_json(JobSyncRunOut.model_validate(sync_run).model_dump(mode="json"))


def run_filter_options(source_key: str) -> None:
    if source_key == "jobkorea":
        print_json(get_cached_jobkorea_filter_options())
        return

    raise ValueError(f"Source does not expose filter options: {source_key}")


def main() -> int:
    args = parse_args()

    try:
        filters = parse_filters(getattr(args, "filters_json", None))

        if args.command == "crawl-info":
            run_crawl_info(args.source_key, args.page, filters)
            return 0

        if args.command == "filter-options":
            run_filter_options(args.source_key)
            return 0

        if args.command == "sync":
            run_sync(
                args.source_key,
                args.start_page,
                args.end_page,
                filters,
            )
            return 0
    except Exception as exc:
        sys.stderr.write(f"{exc}\n")
        return 1

    sys.stderr.write("Unknown command.\n")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
