"""Re-parse jobkorea deadlines stored in the DB.

Earlier crawls used a too-aggressive year-shift rule that pulled long-term
deadlines into the previous year (e.g. ~06/30 stored as 2025-06-30 when the
actual deadline is 2026-06-30). This script reads each posting's
``apply_period_raw`` (and each application's ``apply_period_raw_snapshot``),
runs the current jobkorea parser against it, and writes back any corrected
``apply_end_date`` / ``apply_end_date_snapshot``.
"""

from __future__ import annotations

import argparse
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crawlers.jobkorea import JobKoreaCrawler
from app.database import SessionLocal
from app.models import Application, JobPosting, Source


JOBKOREA_SOURCE_KEY = "jobkorea"


@dataclass(slots=True)
class Change:
    kind: str  # "posting" | "application"
    record_id: int
    label: str
    raw: str
    before: date | None
    after: date | None


def _extract_deadline_segment(period_raw: str) -> str:
    """jobkorea raw 포맷은 "<등록일> / <마감일>" 또는 "<마감일>" 단독이다.

    분리자는 정확히 " / " 이므로 단일 슬래시(예: ~05/28) 와 충돌하지 않도록
    이 형태로만 잘라낸다.
    """
    if " / " in period_raw:
        return period_raw.split(" / ", 1)[1]
    return period_raw


def _is_relative_only(deadline_segment: str) -> bool:
    """raw에 절대 날짜가 없는 표현은 백필 시점 기준이 달라져 신뢰할 수 없다."""
    compact = deadline_segment.replace(" ", "")
    if "오늘마감" in compact or "내일마감" in compact:
        return True
    if compact.startswith("D-"):
        return True
    return False


def _reparse_deadline(
    crawler: JobKoreaCrawler, period_raw: str | None
) -> tuple[date | None, bool]:
    """재파싱 결과와 함께 '이 raw가 백필 대상인지' 플래그를 반환한다."""
    if not period_raw:
        return None, False
    segment = _extract_deadline_segment(period_raw)
    if _is_relative_only(segment):
        return None, False
    return crawler._parse_deadline(segment), True


def _jobkorea_source_id(session: Session) -> int | None:
    return session.scalar(select(Source.id).where(Source.key == JOBKOREA_SOURCE_KEY))


def collect_changes(session: Session, crawler: JobKoreaCrawler) -> list[Change]:
    source_id = _jobkorea_source_id(session)
    if source_id is None:
        return []

    changes: list[Change] = []

    postings: Iterable[JobPosting] = session.scalars(
        select(JobPosting).where(JobPosting.source_id == source_id)
    )
    for posting in postings:
        recomputed, eligible = _reparse_deadline(crawler, posting.apply_period_raw)
        if not eligible:
            continue
        if recomputed != posting.apply_end_date:
            changes.append(
                Change(
                    kind="posting",
                    record_id=posting.id,
                    label=f"{posting.company_name} · {posting.title[:40]}",
                    raw=posting.apply_period_raw or "",
                    before=posting.apply_end_date,
                    after=recomputed,
                )
            )

    applications: Iterable[Application] = session.scalars(
        select(Application).join(JobPosting).where(JobPosting.source_id == source_id)
    )
    for application in applications:
        recomputed, eligible = _reparse_deadline(
            crawler, application.apply_period_raw_snapshot
        )
        if not eligible:
            continue
        if recomputed != application.apply_end_date_snapshot:
            posting = application.job_posting
            changes.append(
                Change(
                    kind="application",
                    record_id=application.id,
                    label=f"{posting.company_name} · {posting.title[:40]}",
                    raw=application.apply_period_raw_snapshot or "",
                    before=application.apply_end_date_snapshot,
                    after=recomputed,
                )
            )

    return changes


def apply_changes(session: Session, changes: list[Change]) -> None:
    for change in changes:
        if change.kind == "posting":
            posting = session.get(JobPosting, change.record_id)
            if posting is not None:
                posting.apply_end_date = change.after
        else:
            application = session.get(Application, change.record_id)
            if application is not None:
                application.apply_end_date_snapshot = change.after
    session.commit()


def _format_date(value: date | None) -> str:
    return value.isoformat() if value else "—"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Re-parse jobkorea deadlines from stored apply_period_raw."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print changes without writing to the database.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional cap on rows to print in the diff (does not affect writes).",
    )
    args = parser.parse_args()

    crawler = JobKoreaCrawler(today_provider=date.today)

    with SessionLocal() as session:
        changes = collect_changes(session, crawler)

        if not changes:
            print("No deadline corrections needed.")
            return

        posting_count = sum(1 for change in changes if change.kind == "posting")
        application_count = len(changes) - posting_count

        print(
            f"Would update {posting_count} job_postings and "
            f"{application_count} applications."
        )
        preview = changes if args.limit is None else changes[: args.limit]
        for change in preview:
            print(
                f"  [{change.kind:11}] id={change.record_id:>5} "
                f"{_format_date(change.before)} → {_format_date(change.after)}  "
                f"raw={change.raw!r}  ({change.label})"
            )
        if args.limit is not None and len(changes) > args.limit:
            print(f"  ... and {len(changes) - args.limit} more")

        if args.dry_run:
            print("Dry run — no changes written.")
            return

        apply_changes(session, changes)
        print("Applied.")


if __name__ == "__main__":
    main()
