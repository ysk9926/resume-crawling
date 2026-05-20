import pytest
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.crawlers.base import CrawlInfo, CrawledJobPosting
from app.database import Base
from app.models import CoverLetterItem, JobPosting, JobSyncRun, ResumeTemplate, Source, User
from app.services import sync as sync_service
from app.services.sync import (
    create_cover_letter_item,
    create_or_replace_application,
    update_cover_letter_item,
    upsert_postings,
)


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


def test_upsert_postings_inserts_and_updates() -> None:
    with make_session() as session:
        source = Source(key="kofia", name="KOFIA", base_url="https://example.com")
        session.add(source)
        session.commit()
        session.refresh(source)

        first = CrawledJobPosting(
            external_id="100",
            company_name="테스트증권",
            title="백엔드 채용",
            detail_url="https://example.com/jobs/100",
            external_apply_url="https://apply.example.com/100",
            posted_at=date(2026, 5, 16),
            apply_period_raw="20260516~20260530",
            apply_start_date=date(2026, 5, 16),
            apply_end_date=date(2026, 5, 30),
            raw_content="원문",
            normalized_content="정제문",
            tags=["Backend"],
        )
        inserted, updated = upsert_postings(session, source, [first])
        session.commit()

        assert inserted == 1
        assert updated == 0

        changed = CrawledJobPosting(
            external_id="100",
            company_name="테스트증권",
            title="백엔드 채용 수정",
            detail_url="https://example.com/jobs/100",
            external_apply_url="https://apply.example.com/100",
            posted_at=date(2026, 5, 16),
            apply_period_raw="20260516~20260530",
            apply_start_date=date(2026, 5, 16),
            apply_end_date=date(2026, 5, 30),
            raw_content="원문",
            normalized_content="정제문 갱신",
            tags=["Backend", "Python"],
        )
        inserted, updated = upsert_postings(session, source, [changed])
        session.commit()

        posting = session.query(JobPosting).one()
        assert inserted == 0
        assert updated == 1
        assert posting.title == "백엔드 채용 수정"
        assert posting.tags == ["Backend", "Python"]


def test_create_or_replace_application_uses_resume_snapshot() -> None:
    with make_session() as session:
        user = seed_user(session)
        source = Source(key="kofia", name="KOFIA", base_url="https://example.com")
        posting = JobPosting(
            source=source,
            external_id="101",
            company_name="한빛자산운용",
            title="데이터 엔지니어 채용",
            detail_url="https://example.com/jobs/101",
            external_apply_url=None,
            posted_at=date(2026, 5, 16),
            apply_period_raw=None,
            apply_start_date=None,
            apply_end_date=None,
            raw_content="원문",
            normalized_content="정제문",
            tags=["Data"],
        )
        resume = ResumeTemplate(
            user_id=user.id,
            title="데이터용 이력서",
            summary="데이터 직무 템플릿",
            markdown_content="# 경력\n- 수집 파이프라인 구축",
        )
        session.add_all([source, posting, resume])
        session.commit()
        session.refresh(posting)
        session.refresh(resume)

        application = create_or_replace_application(
            session,
            user_id=user.id,
            job_posting_id=posting.id,
            resume_template_id=resume.id,
            application_method="simple",
            status="planned",
            note="초기 메모",
        )

        assert application.resume_snapshot_title == "데이터용 이력서 · 한빛자산운용"
        assert application.resume_snapshot_markdown == "# 경력\n- 수집 파이프라인 구축"
        assert application.application_method == "simple"
        assert application.apply_end_date_snapshot is None
        assert application.status == "planned"


def test_create_or_replace_application_snapshots_deadline_and_cover_letter_items() -> None:
    with make_session() as session:
        user = seed_user(session)
        source = Source(key="jobkorea", name="JobKorea", base_url="https://example.com")
        posting = JobPosting(
            source=source,
            external_id="102",
            company_name="코몬티",
            title="대한항공 홈페이지 백엔드",
            detail_url="https://example.com/jobs/102",
            external_apply_url="https://example.com/apply/102",
            posted_at=date(2026, 5, 15),
            apply_period_raw="~06/14",
            apply_start_date=None,
            apply_end_date=date(2026, 6, 14),
            raw_content="원문",
            normalized_content="정제문",
            tags=["Backend"],
        )
        resume = ResumeTemplate(
            user_id=user.id,
            title="백엔드 이력서",
            summary="백엔드 템플릿",
            markdown_content="# 경력\n- 서비스 운영",
        )
        session.add_all([source, posting, resume])
        session.commit()
        session.refresh(posting)
        session.refresh(resume)

        application = create_or_replace_application(
            session,
            user_id=user.id,
            job_posting_id=posting.id,
            resume_template_id=resume.id,
            application_method="cover_letter",
            status="planned",
            note="자소서 작성 예정",
        )

        assert application.application_method == "cover_letter"
        assert application.apply_end_date_snapshot == date(2026, 6, 14)
        assert application.apply_period_raw_snapshot == "~06/14"

        item = create_cover_letter_item(
            session,
            user_id=user.id,
            application_id=application.id,
            question="지원 동기를 작성해주세요.",
            answer_markdown="서비스 운영 경험을 기반으로 기여하겠습니다.",
            tags=["동기", "Backend", "backend"],
        )

        assert item.order_index == 0
        assert sorted(tag.label for tag in item.tags) == ["Backend", "동기"]

        updated = update_cover_letter_item(
            session,
            user_id=user.id,
            item_id=item.id,
            question="지원 동기와 관련 경험을 작성해주세요.",
            answer_markdown="운영 경험과 협업 경험을 정리했습니다.",
            tags=["경험", "Backend"],
            order_index=3,
        )

        assert updated.order_index == 3
        assert sorted(tag.label for tag in updated.tags) == ["Backend", "경험"]
        assert session.query(CoverLetterItem).count() == 1


def test_run_source_sync_rejects_range_outside_total_pages(monkeypatch: pytest.MonkeyPatch) -> None:
    class StubCrawler:
        def __init__(self) -> None:
            self.closed = False

        def get_crawl_info(self, page: int = 1) -> CrawlInfo:
            return CrawlInfo(current_page=page, total_pages=3, total_items=30)

        def crawl(self, start_page: int = 1, end_page: int = 1) -> list[CrawledJobPosting]:
            raise AssertionError("crawl should not run when the page range is invalid")

        def close(self) -> None:
            self.closed = True

    crawler = StubCrawler()

    with make_session() as session:
        source = Source(key="kofia", name="KOFIA", base_url="https://example.com")
        session.add(source)
        session.commit()

        monkeypatch.setattr(sync_service, "get_crawler", lambda source_key, filters=None: crawler)

        with pytest.raises(ValueError, match="총 페이지 수"):
            sync_service.run_source_sync(session, source_key="kofia", start_page=2, end_page=4)

        sync_run = session.query(JobSyncRun).one()
        assert sync_run.status == "failed"
        assert "총 페이지 수" in (sync_run.message or "")
        assert crawler.closed is True


def test_run_source_sync_with_filters_passes_filters_to_crawler(monkeypatch: pytest.MonkeyPatch) -> None:
    class StubCrawler:
        def __init__(self) -> None:
            self.closed = False

        def get_crawl_info(self, page: int = 1) -> CrawlInfo:
            return CrawlInfo(current_page=page, total_pages=1, total_items=1)

        def crawl(self, start_page: int = 1, end_page: int = 1) -> list[CrawledJobPosting]:
            return []

        def close(self) -> None:
            self.closed = True

    crawler = StubCrawler()
    captured: dict[str, object] = {}

    def fake_get_crawler(source_key: str, filters: dict[str, object] | None = None) -> StubCrawler:
        captured["source_key"] = source_key
        captured["filters"] = filters
        return crawler

    with make_session() as session:
        source = Source(key="remember", name="Remember", base_url="https://example.com")
        session.add(source)
        session.commit()

        monkeypatch.setattr(sync_service, "get_crawler", fake_get_crawler)

        sync_run = sync_service.run_source_sync_with_filters(
            session,
            source_key="remember",
            start_page=1,
            end_page=1,
            filters={"keywords": ["백엔드"], "leader_position": True},
        )

        assert sync_run.status == "success"
        assert captured == {
            "source_key": "remember",
            "filters": {"keywords": ["백엔드"], "leader_position": True},
        }
        assert crawler.closed is True
