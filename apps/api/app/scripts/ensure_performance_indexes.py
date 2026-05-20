from __future__ import annotations

from sqlalchemy import text

from app.database import engine


INDEX_STATEMENTS = [
    (
        "ix_applications_user_updated_desc",
        """
        create index if not exists ix_applications_user_updated_desc
        on applications (user_id, updated_at desc, id desc)
        """,
    ),
    (
        "ix_applications_user_status_deadline",
        """
        create index if not exists ix_applications_user_status_deadline
        on applications (user_id, status, apply_end_date_snapshot)
        """,
    ),
    (
        "ix_applications_user_status_applied_at",
        """
        create index if not exists ix_applications_user_status_applied_at
        on applications (user_id, status, applied_at)
        """,
    ),
    (
        "ix_resume_templates_user_updated_desc",
        """
        create index if not exists ix_resume_templates_user_updated_desc
        on resume_templates (user_id, updated_at desc, id desc)
        """,
    ),
    (
        "ix_user_posting_states_user_curation_status",
        """
        create index if not exists ix_user_posting_states_user_curation_status
        on user_posting_states (user_id, curation_status)
        """,
    ),
    (
        "ix_user_posting_states_user_bookmarked",
        """
        create index if not exists ix_user_posting_states_user_bookmarked
        on user_posting_states (user_id, is_bookmarked)
        """,
    ),
    (
        "ix_user_posting_states_user_todo",
        """
        create index if not exists ix_user_posting_states_user_todo
        on user_posting_states (user_id, is_todo)
        """,
    ),
    (
        "ix_job_postings_apply_end_company_title",
        """
        create index if not exists ix_job_postings_apply_end_company_title
        on job_postings (apply_end_date, company_name, title)
        """,
    ),
    (
        "ix_job_sync_runs_source_started_desc",
        """
        create index if not exists ix_job_sync_runs_source_started_desc
        on job_sync_runs (source_id, started_at desc)
        """,
    ),
]


def main() -> None:
    with engine.begin() as connection:
        for name, statement in INDEX_STATEMENTS:
            connection.execute(text(statement))
            print(f"ensured {name}")


if __name__ == "__main__":
    main()
