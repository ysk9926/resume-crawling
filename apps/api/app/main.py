from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import applications, dashboard, postings, resumes, sources
from app.config import API_TITLE
from app.database import Base, SessionLocal, engine
from app.seed import seed_sources


def _ensure_sqlite_columns() -> None:
    with engine.begin() as connection:
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


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_columns()
    with SessionLocal() as session:
        seed_sources(session)
    yield


app = FastAPI(title=API_TITLE, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
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
