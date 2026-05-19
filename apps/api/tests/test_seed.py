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
        assert first[0].title == "윤승규 - 풀스택 마스터 이력서"
        assert "ERP 팀 리더" in first[0].summary
        assert "VEMONTES - 스킨케어 구독 커머스 플랫폼" in first[0].markdown_content

        seed_resume_templates(session)
        second = session.scalars(select(ResumeTemplate)).all()

        assert len(second) == 1
