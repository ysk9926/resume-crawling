from datetime import date

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models import (
    Application,
    CoverLetterTag,
    JobPosting,
    ResumeTemplate,
    Source,
    UserPostingState,
)
from app.security import (
    authenticate_user,
    create_user_account,
    create_user_session,
    resolve_current_user,
    revoke_session,
)


def make_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    return testing_session()


def seed_legacy_data(session: Session) -> None:
    source = Source(key="jobkorea", name="JobKorea", base_url="https://example.com")
    posting = JobPosting(
        source=source,
        external_id="legacy-1",
        company_name="알파",
        title="백엔드 개발자",
        detail_url="https://example.com/jobs/1",
        external_apply_url=None,
        posted_at=date(2026, 5, 20),
        apply_period_raw="~05/31",
        apply_start_date=None,
        apply_end_date=date(2026, 5, 31),
        raw_content="원문",
        normalized_content="정제문",
        tags=["Backend"],
        curation_status="interesting",
        curation_note="legacy note",
        is_bookmarked=True,
        is_todo=True,
    )
    resume = ResumeTemplate(
        title="기존 이력서",
        summary="legacy",
        markdown_content="# legacy",
    )
    application = Application(
        job_posting=posting,
        resume_template=resume,
        application_method="simple",
        status="planned",
        note="legacy app",
        apply_end_date_snapshot=date(2026, 5, 31),
        apply_period_raw_snapshot="~05/31",
        resume_snapshot_title="기존 이력서 · 알파",
        resume_snapshot_markdown="# legacy",
    )
    tag = CoverLetterTag(name="backend", label="Backend")
    session.add_all([source, posting, resume, application, tag])
    session.commit()


def test_first_user_becomes_admin_and_adopts_legacy_data() -> None:
    with make_session() as session:
        seed_legacy_data(session)

        user = create_user_account(session, "Tester", "supersecure")

        adopted_resume = session.scalar(select(ResumeTemplate))
        adopted_application = session.scalar(select(Application))
        adopted_tag = session.scalar(select(CoverLetterTag))
        posting_state = session.scalar(select(UserPostingState))

        assert user.role == "admin"
        assert adopted_resume is not None and adopted_resume.user_id == user.id
        assert adopted_application is not None and adopted_application.user_id == user.id
        assert adopted_tag is not None and adopted_tag.user_id == user.id
        assert posting_state is not None
        assert posting_state.user_id == user.id
        assert posting_state.curation_status == "interesting"
        assert posting_state.is_bookmarked is True
        assert posting_state.is_todo is True


def test_authenticate_and_revoke_session_round_trip() -> None:
    with make_session() as session:
        user = create_user_account(session, "tester", "supersecure")
        authenticated = authenticate_user(session, "tester", "supersecure")
        _, token = create_user_session(session, authenticated)

        assert authenticated.id == user.id
        assert resolve_current_user(session, token) is not None

        revoke_session(session, token)

        assert resolve_current_user(session, token) is None
