from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import applications, dashboard, postings, resumes, sources
from app.config import API_TITLE
from app.database import Base, SessionLocal, engine
from app.seed import seed_resume_templates, seed_sources


def _ensure_sqlite_columns() -> None:
    with engine.begin() as connection:
        source_existing = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(sources)").fetchall()
        }
        if "supports_sync" not in source_existing:
            connection.exec_driver_sql(
                "ALTER TABLE sources ADD COLUMN supports_sync BOOLEAN NOT NULL DEFAULT 1"
            )

        existing = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(job_postings)").fetchall()
        }
        if "is_bookmarked" not in existing:
            connection.exec_driver_sql(
                "ALTER TABLE job_postings ADD COLUMN is_bookmarked BOOLEAN NOT NULL DEFAULT 0"
            )
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_job_postings_is_bookmarked ON job_postings (is_bookmarked)"
            )
        if "is_todo" not in existing:
            connection.exec_driver_sql(
                "ALTER TABLE job_postings ADD COLUMN is_todo BOOLEAN NOT NULL DEFAULT 0"
            )
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_job_postings_is_todo ON job_postings (is_todo)"
            )
        if "ingest_kind" not in existing:
            connection.exec_driver_sql(
                "ALTER TABLE job_postings ADD COLUMN ingest_kind VARCHAR(20) NOT NULL DEFAULT 'crawl'"
            )
        application_existing = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(applications)").fetchall()
        }
        if "application_method" not in application_existing:
            connection.exec_driver_sql(
                "ALTER TABLE applications ADD COLUMN application_method VARCHAR(30) NOT NULL DEFAULT 'simple'"
            )
        if "apply_end_date_snapshot" not in application_existing:
            connection.exec_driver_sql(
                "ALTER TABLE applications ADD COLUMN apply_end_date_snapshot DATE"
            )
        if "apply_period_raw_snapshot" not in application_existing:
            connection.exec_driver_sql(
                "ALTER TABLE applications ADD COLUMN apply_period_raw_snapshot VARCHAR(80)"
            )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_job_postings_posted_created "
            "ON job_postings (posted_at, created_at)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_job_postings_ingest_kind "
            "ON job_postings (ingest_kind)"
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
            "CREATE INDEX IF NOT EXISTS ix_resume_templates_updated_at "
            "ON resume_templates (updated_at)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_job_sync_runs_started_at "
            "ON job_sync_runs (started_at)"
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_columns()
    with SessionLocal() as session:
        seed_sources(session)
        seed_resume_templates(session)
    yield


app = FastAPI(title=API_TITLE, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3334", "http://localhost:3334"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(sources.router, prefix="/api")
app.include_router(postings.router, prefix="/api")
app.include_router(resumes.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
