from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.routes.postings import load_postings_overview, load_postings_page
from app.database import Base
from app.models import JobPosting, Source


def make_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    return testing_session()


def seed_postings(session: Session) -> None:
    kofia = Source(key="kofia", name="KOFIA", base_url="https://kofia.example.com")
    jobkorea = Source(key="jobkorea", name="JobKorea", base_url="https://jobkorea.example.com")
    session.add_all([kofia, jobkorea])
    session.commit()
    session.refresh(kofia)
    session.refresh(jobkorea)

    session.add_all(
        [
            JobPosting(
                source_id=kofia.id,
                external_id="1",
                company_name="알파증권",
                title="플랫폼 백엔드 엔지니어",
                detail_url="https://example.com/1",
                external_apply_url=None,
                posted_at=date(2026, 5, 18),
                apply_period_raw=None,
                apply_start_date=None,
                apply_end_date=None,
                raw_content="원문 1",
                normalized_content="플랫폼 백엔드 운영",
                tags=["Backend"],
                curation_status="new",
                is_bookmarked=False,
                is_todo=False,
            ),
            JobPosting(
                source_id=kofia.id,
                external_id="2",
                company_name="베타자산운용",
                title="플랫폼 데이터 엔지니어",
                detail_url="https://example.com/2",
                external_apply_url=None,
                posted_at=date(2026, 5, 17),
                apply_period_raw=None,
                apply_start_date=None,
                apply_end_date=None,
                raw_content="원문 2",
                normalized_content="플랫폼 데이터 자동화",
                tags=["Data"],
                curation_status="interesting",
                is_bookmarked=True,
                is_todo=True,
            ),
            JobPosting(
                source_id=kofia.id,
                external_id="3",
                company_name="감마캐피탈",
                title="리서치 분석가",
                detail_url="https://example.com/3",
                external_apply_url=None,
                posted_at=date(2026, 5, 16),
                apply_period_raw=None,
                apply_start_date=None,
                apply_end_date=None,
                raw_content="원문 3",
                normalized_content="시장 리서치",
                tags=["Research"],
                curation_status="ignored",
                is_bookmarked=False,
                is_todo=False,
            ),
            JobPosting(
                source_id=jobkorea.id,
                external_id="4",
                company_name="델타테크",
                title="백엔드 개발자",
                detail_url="https://example.com/4",
                external_apply_url=None,
                posted_at=date(2026, 5, 15),
                apply_period_raw=None,
                apply_start_date=None,
                apply_end_date=None,
                raw_content="원문 4",
                normalized_content="외부 소스 데이터",
                tags=["Backend"],
                curation_status="new",
                is_bookmarked=True,
                is_todo=False,
            ),
        ]
    )
    session.commit()


def test_load_postings_overview_counts_by_tab_with_source_filter() -> None:
    with make_session() as session:
        seed_postings(session)

        overview = load_postings_overview(session, q=None, source_key="kofia")

        assert overview.all == 3
        assert overview.new == 1
        assert overview.interesting == 1
        assert overview.ignored == 1
        assert overview.bookmarked == 1
        assert overview.todo == 1


def test_load_postings_page_applies_tab_filters_and_pagination() -> None:
    with make_session() as session:
        seed_postings(session)

        page = load_postings_page(
            session,
            tab="all",
            q="플랫폼",
            source_key="kofia",
            page=2,
            page_size=1,
        )

        assert page.total_count == 2
        assert page.page == 2
        assert page.total_pages == 2
        assert page.has_prev is True
        assert page.has_next is False
        assert [item.title for item in page.items] == ["플랫폼 데이터 엔지니어"]

        todo_page = load_postings_page(
            session,
            tab="todo",
            q=None,
            source_key=None,
            page=1,
            page_size=10,
        )

        assert todo_page.total_count == 1
        assert [item.company_name for item in todo_page.items] == ["베타자산운용"]
