from datetime import date

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models import Application, JobPosting, ResumeTemplate, Source
from app.services.sync import (
    create_manual_application,
    create_manual_posting,
    run_source_sync,
)


def make_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    return testing_session()


def seed_resume(session: Session) -> ResumeTemplate:
    resume = ResumeTemplate(
        title="공통 이력서",
        summary="기본 템플릿",
        markdown_content="# 이력서",
    )
    session.add(resume)
    session.commit()
    session.refresh(resume)
    return resume


def test_create_manual_posting_registers_source_once_and_marks_manual_origin() -> None:
    with make_session() as session:
        first = create_manual_posting(
            session,
            platform_name="리멤버",
            company_name="알파",
            title="백엔드 엔지니어",
            detail_url="https://remember.co.kr/jobs/1",
            external_apply_url=None,
            posted_at=date(2026, 5, 19),
            apply_start_date=None,
            apply_end_date=None,
            apply_period_raw="상시채용",
            normalized_content="Python FastAPI 백엔드 포지션",
            tags=[],
            curation_status="interesting",
            curation_note="우선 검토",
            is_bookmarked=False,
            is_todo=True,
        )
        second = create_manual_posting(
            session,
            platform_name="리멤버",
            company_name="베타",
            title="데이터 엔지니어",
            detail_url="https://remember.co.kr/jobs/2",
            external_apply_url=None,
            posted_at=date(2026, 5, 20),
            apply_start_date=None,
            apply_end_date=None,
            apply_period_raw=None,
            normalized_content="Data pipeline 운영",
            tags=["Data"],
            curation_status="new",
            curation_note=None,
            is_bookmarked=False,
            is_todo=False,
        )

        sources = session.scalars(select(Source)).all()

        assert len(sources) == 1
        assert sources[0].name == "리멤버"
        assert sources[0].supports_sync is False
        assert sources[0].base_url == "https://remember.co.kr"
        assert first.source_id == second.source_id
        assert first.ingest_kind == "manual"
        assert first.is_bookmarked is True
        assert first.is_todo is True
        assert "Backend" in first.tags


def test_create_manual_application_creates_manual_posting_and_snapshot() -> None:
    with make_session() as session:
        resume = seed_resume(session)

        application = create_manual_application(
            session,
            platform_name="원티드",
            company_name="감마",
            job_title="플랫폼 백엔드 개발자",
            detail_url="https://www.wanted.co.kr/wd/1",
            external_apply_url="https://www.wanted.co.kr/apply/1",
            posted_at=date(2026, 5, 18),
            apply_start_date=None,
            apply_end_date=date(2026, 5, 31),
            apply_period_raw="~05.31",
            normalized_content="FastAPI, PostgreSQL 경험 우대",
            tags=[],
            curation_status="interesting",
            curation_note="지원 완료 추적",
            is_bookmarked=True,
            is_todo=False,
            resume_template_id=resume.id,
            application_method="simple",
            status="applied",
            note="리멤버 미수집 공고 대체 테스트",
            applied_at=date(2026, 5, 19),
        )

        stored_application = session.get(Application, application.id)
        posting = session.get(JobPosting, application.job_posting_id)
        source = session.get(Source, posting.source_id) if posting else None

        assert stored_application is not None
        assert posting is not None
        assert source is not None
        assert posting.ingest_kind == "manual"
        assert source.name == "원티드"
        assert stored_application.apply_end_date_snapshot == date(2026, 5, 31)
        assert stored_application.apply_period_raw_snapshot == "~05.31"
        assert stored_application.applied_at == date(2026, 5, 19)
        assert stored_application.resume_snapshot_title == "공통 이력서 · 감마"


def test_manual_source_cannot_run_sync() -> None:
    with make_session() as session:
        create_manual_posting(
            session,
            platform_name="리멤버",
            company_name="알파",
            title="백엔드 엔지니어",
            detail_url="https://remember.co.kr/jobs/1",
            external_apply_url=None,
            posted_at=None,
            apply_start_date=None,
            apply_end_date=None,
            apply_period_raw=None,
            normalized_content="내용",
            tags=[],
            curation_status="new",
            curation_note=None,
            is_bookmarked=False,
            is_todo=False,
        )

        with pytest.raises(ValueError, match="Source does not support sync"):
            run_source_sync(session, "리멤버", start_page=1, end_page=1)
