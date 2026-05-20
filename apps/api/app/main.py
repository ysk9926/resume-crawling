from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import applications, auth, calendar, dashboard, postings, resumes, sources
from app.bootstrap import ensure_sqlite_schema
from app.config import API_TITLE, IS_SQLITE
from app.database import Base, SessionLocal, engine
from app.seed import seed_resume_templates, seed_sources


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    if IS_SQLITE:
        ensure_sqlite_schema()
    with SessionLocal() as session:
        seed_sources(session)
        if IS_SQLITE:
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


app.include_router(auth.router, prefix="/api")
app.include_router(sources.router, prefix="/api")
app.include_router(postings.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(resumes.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
