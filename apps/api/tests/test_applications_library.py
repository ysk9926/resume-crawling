from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.routes.applications import load_cover_letter_library_page
from app.database import Base
from app.models import JobPosting, ResumeTemplate, Source
from app.services.sync import create_cover_letter_item, create_or_replace_application


def make_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    return testing_session()


def seed_cover_letter_items(session: Session) -> None:
    source = Source(key="jobkorea", name="JobKorea", base_url="https://example.com")
    resume = ResumeTemplate(
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
            external_apply_url=None,
            posted_at=date(2026, 5, 18),
            apply_period_raw="~05/31",
            apply_start_date=None,
            apply_end_date=date(2026, 5, 31),
            raw_content="원문 1",
            normalized_content="정제문 1",
            tags=["Backend"],
        ),
        JobPosting(
            source_id=source.id,
            external_id="2",
            company_name="베타",
            title="데이터 엔지니어",
            detail_url="https://example.com/2",
            external_apply_url=None,
            posted_at=date(2026, 5, 17),
            apply_period_raw="~06/02",
            apply_start_date=None,
            apply_end_date=date(2026, 6, 2),
            raw_content="원문 2",
            normalized_content="정제문 2",
            tags=["Data"],
        ),
    ]
    session.add_all(postings)
    session.commit()
    session.refresh(postings[0])
    session.refresh(postings[1])

    first = create_or_replace_application(
        session,
        job_posting_id=postings[0].id,
        resume_template_id=resume.id,
        application_method="cover_letter",
        status="planned",
        note="alpha",
    )
    second = create_or_replace_application(
        session,
        job_posting_id=postings[1].id,
        resume_template_id=resume.id,
        application_method="cover_letter",
        status="planned",
        note="beta",
    )

    create_cover_letter_item(
        session,
        application_id=first.id,
        question="첫 질문",
        answer_markdown="첫 답변",
        tags=["Backend", "동기"],
    )
    create_cover_letter_item(
        session,
        application_id=second.id,
        question="둘째 질문",
        answer_markdown="둘째 답변",
        tags=["data"],
    )


def test_cover_letter_library_lists_all_items_without_tag() -> None:
    with make_session() as session:
        seed_cover_letter_items(session)

        page = load_cover_letter_library_page(session, normalized_tag=None, page=1, page_size=1)

        assert page.total_count == 2
        assert page.total_pages == 2
        assert page.has_next is True
        assert len(page.items) == 1


def test_cover_letter_library_filters_by_exact_normalized_tag() -> None:
    with make_session() as session:
        seed_cover_letter_items(session)

        page = load_cover_letter_library_page(session, normalized_tag="backend", page=1, page_size=10)

        assert page.total_count == 1
        assert [item.question for item in page.items] == ["첫 질문"]
        assert page.items[0].tags == ["Backend", "동기"]
