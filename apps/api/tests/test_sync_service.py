import pytest
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.crawlers.base import CrawlInfo, CrawledJobPosting
from app.database import Base
from app.models import JobPosting, JobSyncRun, ResumeTemplate, Source
from app.services import sync as sync_service
from app.services.sync import create_or_replace_application, upsert_postings


def make_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    return testing_session()


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
            job_posting_id=posting.id,
            resume_template_id=resume.id,
            status="planned",
            note="초기 메모",
        )

        assert application.resume_snapshot_title == "데이터용 이력서 · 한빛자산운용"
        assert application.resume_snapshot_markdown == "# 경력\n- 수집 파이프라인 구축"
        assert application.status == "planned"


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

        monkeypatch.setattr(sync_service, "get_crawler", lambda source_key: crawler)

        with pytest.raises(ValueError, match="총 페이지 수"):
            sync_service.run_source_sync(session, source_key="kofia", start_page=2, end_page=4)

        sync_run = session.query(JobSyncRun).one()
        assert sync_run.status == "failed"
        assert "총 페이지 수" in (sync_run.message or "")
        assert crawler.closed is True
