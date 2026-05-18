from __future__ import annotations

import os
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = Path(os.getenv("APP_DATA_DIR", str(REPO_ROOT / "data"))).resolve()
DB_PATH = Path(os.getenv("APP_DB_PATH", str(DATA_DIR / "resume-tracker.db"))).resolve()
API_TITLE = "Resume Workbench API"
DEFAULT_PAGE_LIMIT = int(os.getenv("APP_DEFAULT_PAGE_LIMIT", "1"))
DASHBOARD_CACHE_TTL_SECONDS = int(os.getenv("APP_DASHBOARD_CACHE_TTL_SECONDS", "15"))
LIST_CACHE_TTL_SECONDS = int(os.getenv("APP_LIST_CACHE_TTL_SECONDS", "30"))
LOOKUP_CACHE_TTL_SECONDS = int(os.getenv("APP_LOOKUP_CACHE_TTL_SECONDS", "60"))
CRAWL_INFO_CACHE_TTL_SECONDS = int(os.getenv("APP_CRAWL_INFO_CACHE_TTL_SECONDS", "15"))


def ensure_data_dir() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
