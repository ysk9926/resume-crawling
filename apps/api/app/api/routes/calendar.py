from __future__ import annotations

from calendar import monthrange
from datetime import date
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, joinedload

from app.config import LIST_CACHE_TTL_SECONDS
from app.database import get_db
from app.models import Application, JobPosting, Source
from app.schemas import CalendarEventOut, CalendarMonthOut
from app.services.cache import get_read_cache_value, make_cache_key


router = APIRouter(prefix="/calendar", tags=["calendar"])


POSTING_DEADLINE_LAYER = "posting_deadline"
POSTING_BOOKMARK_LAYER = "posting_bookmark"
POSTING_TODO_LAYER = "posting_todo"
APPLICATION_PLANNED_LAYER = "application_planned"
APPLICATION_APPLIED_LAYER = "application_applied"


def normalize_month(month: str) -> tuple[str, date, date]:
    try:
        year_label, month_label = month.split("-", 1)
        year = int(year_label)
        month_number = int(month_label)
    except ValueError as exc:
        raise ValueError("Month must be formatted as YYYY-MM.") from exc

    if month_number < 1 or month_number > 12:
        raise ValueError("Month must be between 01 and 12.")

    month_start = date(year, month_number, 1)
    month_end = date(year, month_number, monthrange(year, month_number)[1])
    return month_start.strftime("%Y-%m"), month_start, month_end


@router.get("", response_model=CalendarMonthOut)
def get_calendar_month(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
) -> CalendarMonthOut:
    try:
        normalized, month_start, month_end = normalize_month(month)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    cache_key = make_cache_key("calendar:", month=normalized)
    return get_read_cache_value(
        cache_key,
        LIST_CACHE_TTL_SECONDS,
        lambda: load_calendar_month(db, normalized, month_start, month_end),
    )


def load_calendar_month(
    db: Session,
    month: str,
    month_start: date | None = None,
    month_end: date | None = None,
) -> CalendarMonthOut:
    normalized, resolved_start, resolved_end = normalize_month(month)
    month_start = month_start or resolved_start
    month_end = month_end or resolved_end

    events = [
        *load_posting_events(db, month_start, month_end),
        *load_application_events(db, month_start, month_end),
    ]
    events.sort(
        key=lambda item: (
            item.date,
            0 if item.kind == "application" else 1,
            item.company_name,
            item.title,
        )
    )
    return CalendarMonthOut(
        month=normalized,
        month_start=month_start,
        month_end=month_end,
        events=events,
    )


def load_posting_events(
    db: Session,
    month_start: date,
    month_end: date,
) -> list[CalendarEventOut]:
    postings = db.scalars(
        select(JobPosting)
        .options(joinedload(JobPosting.source), joinedload(JobPosting.application))
        .join(JobPosting.source)
        .where(
            JobPosting.apply_end_date.is_not(None),
            JobPosting.apply_end_date >= month_start,
            JobPosting.apply_end_date <= month_end,
        )
        .order_by(JobPosting.apply_end_date, JobPosting.company_name, JobPosting.title)
    ).all()

    return [serialize_posting_event(posting) for posting in postings]


def load_application_events(
    db: Session,
    month_start: date,
    month_end: date,
) -> list[CalendarEventOut]:
    applications = db.scalars(
        select(Application)
        .options(joinedload(Application.job_posting).joinedload(JobPosting.source))
        .where(
            or_(
                and_(
                    Application.status == "planned",
                    Application.apply_end_date_snapshot.is_not(None),
                    Application.apply_end_date_snapshot >= month_start,
                    Application.apply_end_date_snapshot <= month_end,
                ),
                and_(
                    Application.status == "applied",
                    Application.applied_at.is_not(None),
                    Application.applied_at >= month_start,
                    Application.applied_at <= month_end,
                ),
            )
        )
        .order_by(Application.updated_at.desc(), Application.id.desc())
    ).all()

    return [serialize_application_event(application) for application in applications]


def build_postings_href(source: Source, company_name: str, title: str) -> str:
    query = urlencode(
        {
            "source": source.key,
            "q": f"{company_name} {title}",
        }
    )
    return f"/postings?{query}"


def serialize_posting_event(posting: JobPosting) -> CalendarEventOut:
    if posting.apply_end_date is None:
        raise ValueError("Posting event requires apply_end_date.")

    layer_keys = [POSTING_DEADLINE_LAYER]
    badges: list[str] = []
    if posting.is_bookmarked:
        layer_keys.append(POSTING_BOOKMARK_LAYER)
        badges.append("찜")
    if posting.is_todo:
        layer_keys.append(POSTING_TODO_LAYER)
        badges.append("작성 예정")
    if posting.ingest_kind == "manual":
        badges.append("수동")

    return CalendarEventOut(
        id=f"posting:{posting.id}",
        kind="posting",
        layer_keys=layer_keys,
        date=posting.apply_end_date,
        title=posting.title,
        company_name=posting.company_name,
        source_label=posting.source.name,
        status_label="공고 마감일",
        href=build_postings_href(posting.source, posting.company_name, posting.title),
        detail_url=posting.detail_url,
        external_apply_url=posting.external_apply_url,
        badges=badges,
    )


def serialize_application_event(application: Application) -> CalendarEventOut:
    posting = application.job_posting
    if application.status == "planned":
        event_date = application.apply_end_date_snapshot
        layer_keys = [APPLICATION_PLANNED_LAYER]
        status_label = "지원 예정"
    elif application.status == "applied":
        event_date = application.applied_at
        layer_keys = [APPLICATION_APPLIED_LAYER]
        status_label = "지원 완료"
    else:
        raise ValueError("Application status is not supported in calendar events.")

    if event_date is None:
        raise ValueError("Application calendar event requires a date.")

    badges = ["자소서 작성" if application.application_method == "cover_letter" else "간편지원"]

    return CalendarEventOut(
        id=f"application:{application.id}:{application.status}",
        kind="application",
        layer_keys=layer_keys,
        date=event_date,
        title=posting.title,
        company_name=posting.company_name,
        source_label=posting.source.name,
        status_label=status_label,
        href=f"/applications/{application.id}",
        detail_url=posting.detail_url,
        external_apply_url=posting.external_apply_url,
        badges=badges,
    )
