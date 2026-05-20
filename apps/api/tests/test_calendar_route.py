from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.routes.calendar import (
    APPLICATION_APPLIED_LAYER,
    APPLICATION_PLANNED_LAYER,
    POSTING_BOOKMARK_LAYER,
    POSTING_DEADLINE_LAYER,
    POSTING_TODO_LAYER,
    load_calendar_month,
)
from app.database import Base
from app.models import Application, JobPosting, ResumeTemplate, Source, User, UserPostingState
from app.services.sync import create_or_replace_application


def make_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    return testing_session()


def seed_user(session: Session) -> User:
    user = User(username="tester", password_hash="hashed", role="member")
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def seed_calendar_data(session: Session) -> User:
    user = seed_user(session)
    source = Source(key="jobkorea", name="JobKorea", base_url="https://example.com")
    resume = ResumeTemplate(
        user_id=user.id,
        title="공통 이력서",
        summary="기본 템플릿",
        markdown_content="# 이력서",
    )
    session.add_all([source, resume])
    session.commit()
    session.refresh(source)
    session.refresh(resume)

    postings = [
        JobPosting(
            source_id=source.id,
            external_id="1",
            company_name="알파",
            title="백엔드 개발자",
            detail_url="https://example.com/1",
            external_apply_url="https://apply.example.com/1",
            posted_at=date(2026, 5, 10),
            apply_period_raw="~05/21",
            apply_start_date=None,
            apply_end_date=date(2026, 5, 21),
            raw_content="원문 1",
            normalized_content="정제문 1",
            tags=["Backend"],
            is_bookmarked=True,
            is_todo=True,
        ),
        JobPosting(
            source_id=source.id,
            external_id="2",
            company_name="베타",
            title="데이터 엔지니어",
            detail_url="https://example.com/2",
            external_apply_url=None,
            posted_at=date(2026, 5, 8),
            apply_period_raw="~05/27",
            apply_start_date=None,
            apply_end_date=date(2026, 5, 27),
            raw_content="원문 2",
            normalized_content="정제문 2",
            tags=["Data"],
        ),
        JobPosting(
            source_id=source.id,
            external_id="3",
            company_name="감마",
            title="플랫폼 엔지니어",
            detail_url="https://example.com/3",
            external_apply_url=None,
            posted_at=date(2026, 5, 1),
            apply_period_raw="~06/02",
            apply_start_date=None,
            apply_end_date=date(2026, 6, 2),
            raw_content="원문 3",
            normalized_content="정제문 3",
            tags=["Platform"],
        ),
    ]
    session.add_all(postings)
    session.commit()
    for posting in postings:
        session.refresh(posting)

    session.add(
        UserPostingState(
            user_id=user.id,
            job_posting_id=postings[0].id,
            is_bookmarked=True,
            is_todo=True,
        )
    )
    session.commit()

    create_or_replace_application(
        session,
        user_id=user.id,
        job_posting_id=postings[0].id,
        resume_template_id=resume.id,
        application_method="cover_letter",
        status="planned",
        note="draft",
    )
    applied = create_or_replace_application(
        session,
        user_id=user.id,
        job_posting_id=postings[1].id,
        resume_template_id=resume.id,
        application_method="simple",
        status="applied",
        note="done",
        applied_at=date(2026, 5, 19),
    )

    interview = Application(
        user_id=user.id,
        job_posting_id=postings[2].id,
        resume_template_id=resume.id,
        application_method="simple",
        status="interview",
        note="in progress",
        applied_at=date(2026, 5, 11),
        apply_end_date_snapshot=date(2026, 6, 2),
        apply_period_raw_snapshot="~06/02",
        resume_snapshot_title="공통 이력서 · 감마",
        resume_snapshot_markdown="# 이력서",
    )
    session.add(interview)
    session.commit()
    session.refresh(applied)
    return user


def test_load_calendar_month_returns_month_scoped_events() -> None:
    with make_session() as session:
        user = seed_calendar_data(session)

        month = load_calendar_month(session, user, "2026-05")

        assert month.month == "2026-05"
        assert month.month_start == date(2026, 5, 1)
        assert month.month_end == date(2026, 5, 31)
        assert len(month.events) == 4
        assert {item.kind for item in month.events} == {"posting", "application"}

        assert all(item.date.month == 5 for item in month.events)
        assert not any(item.company_name == "감마" for item in month.events)


def test_load_calendar_month_combines_posting_layers_without_duplicate_events() -> None:
    with make_session() as session:
        user = seed_calendar_data(session)

        month = load_calendar_month(session, user, "2026-05")
        alpha_events = [item for item in month.events if item.company_name == "알파"]

        assert len(alpha_events) == 2

        posting_event = next(item for item in alpha_events if item.kind == "posting")
        assert posting_event.layer_keys == [
            POSTING_DEADLINE_LAYER,
            POSTING_BOOKMARK_LAYER,
            POSTING_TODO_LAYER,
        ]
        assert posting_event.badges == ["찜", "작성 예정"]

        planned_event = next(item for item in alpha_events if item.kind == "application")
        assert planned_event.layer_keys == [APPLICATION_PLANNED_LAYER]
        assert planned_event.badges == ["자소서 작성"]


def test_load_calendar_month_maps_applied_events_to_applied_date() -> None:
    with make_session() as session:
        user = seed_calendar_data(session)

        month = load_calendar_month(session, user, "2026-05")
        applied_event = next(
            item
            for item in month.events
            if item.kind == "application" and APPLICATION_APPLIED_LAYER in item.layer_keys
        )

        assert applied_event.company_name == "베타"
        assert applied_event.date == date(2026, 5, 19)
        assert applied_event.status_label == "지원 완료"
