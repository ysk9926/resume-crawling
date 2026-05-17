from __future__ import annotations

import argparse

from app.database import Base, SessionLocal, engine
from app.seed import seed_sources
from app.services.sync import run_source_sync


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync one registered crawler source.")
    parser.add_argument("source_key", help="Registered source key. Example: kofia")
    parser.add_argument("--start-page", type=int, default=1, help="Start page to crawl")
    parser.add_argument("--end-page", type=int, default=1, help="End page to crawl")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_sources(session)
        sync_run = run_source_sync(
            session,
            source_key=args.source_key,
            start_page=args.start_page,
            end_page=args.end_page,
        )
        print(
            f"[{sync_run.status}] source={args.source_key} total={sync_run.total_count} "
            f"inserted={sync_run.inserted_count} updated={sync_run.updated_count}"
        )


if __name__ == "__main__":
    main()
