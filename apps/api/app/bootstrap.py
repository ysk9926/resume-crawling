from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session

from app.database import engine
from app.models import Application, CoverLetterTag, JobPosting, ResumeTemplate, User, UserPostingState
from app.services.user_scope import posting_has_legacy_personal_data


def _column_names(connection: Connection, table_name: str) -> set[str]:
    return {
        row[1]
        for row in connection.exec_driver_sql(f"PRAGMA table_info({table_name})").fetchall()
    }


def _rebuild_applications_table(connection: Connection) -> None:
    connection.exec_driver_sql(
        """
        CREATE TABLE applications_new (
            id INTEGER NOT NULL PRIMARY KEY,
            user_id INTEGER,
            job_posting_id INTEGER NOT NULL,
            resume_template_id INTEGER,
            application_method VARCHAR(30) NOT NULL DEFAULT 'simple',
            status VARCHAR(30) NOT NULL DEFAULT 'planned',
            note TEXT NOT NULL DEFAULT '',
            applied_at DATE,
            apply_end_date_snapshot DATE,
            apply_period_raw_snapshot VARCHAR(80),
            resume_snapshot_title VARCHAR(200) NOT NULL,
            resume_snapshot_markdown TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users (id),
            FOREIGN KEY(job_posting_id) REFERENCES job_postings (id),
            FOREIGN KEY(resume_template_id) REFERENCES resume_templates (id)
        )
        """
    )
    connection.exec_driver_sql(
        """
        INSERT INTO applications_new (
            id,
            user_id,
            job_posting_id,
            resume_template_id,
            application_method,
            status,
            note,
            applied_at,
            apply_end_date_snapshot,
            apply_period_raw_snapshot,
            resume_snapshot_title,
            resume_snapshot_markdown,
            created_at,
            updated_at
        )
        SELECT
            id,
            NULL,
            job_posting_id,
            resume_template_id,
            application_method,
            status,
            note,
            applied_at,
            apply_end_date_snapshot,
            apply_period_raw_snapshot,
            resume_snapshot_title,
            resume_snapshot_markdown,
            created_at,
            updated_at
        FROM applications
        """
    )
    connection.exec_driver_sql("DROP TABLE applications")
    connection.exec_driver_sql("ALTER TABLE applications_new RENAME TO applications")


def _rebuild_cover_letter_tags_table(connection: Connection) -> None:
    connection.exec_driver_sql(
        """
        CREATE TABLE cover_letter_tags_new (
            id INTEGER NOT NULL PRIMARY KEY,
            user_id INTEGER,
            name VARCHAR(80) NOT NULL,
            label VARCHAR(80) NOT NULL,
            created_at DATETIME NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users (id)
        )
        """
    )
    connection.exec_driver_sql(
        """
        INSERT INTO cover_letter_tags_new (id, user_id, name, label, created_at)
        SELECT id, NULL, name, label, created_at
        FROM cover_letter_tags
        """
    )
    connection.exec_driver_sql("DROP TABLE cover_letter_tags")
    connection.exec_driver_sql("ALTER TABLE cover_letter_tags_new RENAME TO cover_letter_tags")


def ensure_sqlite_schema() -> None:
    with engine.begin() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")

        source_existing = _column_names(connection, "sources")
        if "supports_sync" not in source_existing:
            connection.exec_driver_sql(
                "ALTER TABLE sources ADD COLUMN supports_sync BOOLEAN NOT NULL DEFAULT 1"
            )

        posting_existing = _column_names(connection, "job_postings")
        if "is_bookmarked" not in posting_existing:
            connection.exec_driver_sql(
                "ALTER TABLE job_postings ADD COLUMN is_bookmarked BOOLEAN NOT NULL DEFAULT 0"
            )
        if "is_todo" not in posting_existing:
            connection.exec_driver_sql(
                "ALTER TABLE job_postings ADD COLUMN is_todo BOOLEAN NOT NULL DEFAULT 0"
            )
        if "ingest_kind" not in posting_existing:
            connection.exec_driver_sql(
                "ALTER TABLE job_postings ADD COLUMN ingest_kind VARCHAR(20) NOT NULL DEFAULT 'crawl'"
            )

        resume_existing = _column_names(connection, "resume_templates")
        if "user_id" not in resume_existing:
            connection.exec_driver_sql("ALTER TABLE resume_templates ADD COLUMN user_id INTEGER")

        application_existing = _column_names(connection, "applications")
        if "user_id" not in application_existing:
            _rebuild_applications_table(connection)

        cover_letter_tag_existing = _column_names(connection, "cover_letter_tags")
        if "user_id" not in cover_letter_tag_existing:
            _rebuild_cover_letter_tags_table(connection)

        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_job_postings_posted_created "
            "ON job_postings (posted_at, created_at)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_job_postings_ingest_kind "
            "ON job_postings (ingest_kind)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_job_postings_is_bookmarked "
            "ON job_postings (is_bookmarked)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_job_postings_is_todo "
            "ON job_postings (is_todo)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_resume_templates_updated_at "
            "ON resume_templates (updated_at)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_resume_templates_user_id "
            "ON resume_templates (user_id)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_applications_updated_at "
            "ON applications (updated_at)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_applications_application_method "
            "ON applications (application_method)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_applications_user_id "
            "ON applications (user_id)"
        )
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_user_posting "
            "ON applications (user_id, job_posting_id)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_cover_letter_tags_user_name "
            "ON cover_letter_tags (user_id, name)"
        )
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_cover_letter_tags_user_name "
            "ON cover_letter_tags (user_id, name)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_cover_letter_items_application_order "
            "ON cover_letter_items (application_id, order_index)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_cover_letter_items_updated_at "
            "ON cover_letter_items (updated_at)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_job_sync_runs_started_at "
            "ON job_sync_runs (started_at)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_user_sessions_expires_at "
            "ON user_sessions (expires_at)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_user_posting_states_curation_status "
            "ON user_posting_states (curation_status)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_user_posting_states_bookmarked "
            "ON user_posting_states (is_bookmarked)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_user_posting_states_todo "
            "ON user_posting_states (is_todo)"
        )
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_posting_state_user_posting "
            "ON user_posting_states (user_id, job_posting_id)"
        )
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")


def adopt_legacy_personal_data(session: Session, user: User) -> None:
    resumes = session.scalars(
        select(ResumeTemplate).where(ResumeTemplate.user_id.is_(None))
    ).all()
    for resume in resumes:
        resume.user_id = user.id

    applications = session.scalars(
        select(Application).where(Application.user_id.is_(None))
    ).all()
    for application in applications:
        application.user_id = user.id

    tags = session.scalars(
        select(CoverLetterTag).where(CoverLetterTag.user_id.is_(None))
    ).all()
    for tag in tags:
        tag.user_id = user.id

    existing_posting_ids = set(
        session.scalars(
            select(UserPostingState.job_posting_id).where(UserPostingState.user_id == user.id)
        ).all()
    )
    postings = session.scalars(select(JobPosting)).all()
    for posting in postings:
        if posting.id in existing_posting_ids or not posting_has_legacy_personal_data(posting):
            continue
        session.add(
            UserPostingState(
                user_id=user.id,
                job_posting_id=posting.id,
                curation_status=posting.curation_status,
                curation_note=posting.curation_note,
                is_bookmarked=posting.is_bookmarked,
                is_todo=posting.is_todo,
            )
        )
