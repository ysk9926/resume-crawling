from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models import ResumeTemplate
from app.seed import seed_resume_templates


def make_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    return testing_session()


def test_seed_resume_templates_inserts_master_template_once() -> None:
    with make_session() as session:
        seed_resume_templates(session)
        first = session.scalars(select(ResumeTemplate)).all()

        assert len(first) == 1
        assert first[0].title == "샘플 - 풀스택 마스터 이력서"
        assert "본인 정보로 교체" in first[0].summary
        assert "이름: [이름]" in first[0].markdown_content

        seed_resume_templates(session)
        second = session.scalars(select(ResumeTemplate)).all()

        assert len(second) == 1


def test_seed_resume_templates_sanitizes_legacy_private_master_template() -> None:
    with make_session() as session:
        session.add(
            ResumeTemplate(
                title="윤승규 - 풀스택 마스터 이력서",
                summary="legacy",
                markdown_content="이메일: tmdrb9926@gmail.com",
            )
        )
        session.commit()

        seed_resume_templates(session)
        stored = session.scalars(select(ResumeTemplate)).all()

        assert len(stored) == 1
        assert stored[0].title == "샘플 - 풀스택 마스터 이력서"
        assert stored[0].summary.startswith("직무 맞춤형으로 복사해 쓰는 범용 이력서 초안")
        assert "tmdrb9926@gmail.com" not in stored[0].markdown_content
