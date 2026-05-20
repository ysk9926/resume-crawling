from __future__ import annotations

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import REPO_ROOT
from .crawlers.registry import list_source_definitions
from .models import ResumeTemplate, Source

LEGACY_PRIVATE_MASTER_TEMPLATE_TITLE = "윤승규 - 풀스택 마스터 이력서"
LEGACY_PRIVATE_MASTER_TEMPLATE_MARKERS = (
    "tmdrb9926@gmail.com",
    "portfolio-pink-two-vymvu56oaw.vercel.app",
)


def seed_sources(session: Session) -> None:
    existing_list = session.scalars(select(Source)).all()
    existing_sources = {source.key: source for source in existing_list}
    existing_sources_by_name = {
        source.name.casefold(): source for source in existing_list
    }

    for definition in list_source_definitions():
        source = existing_sources.get(definition.key) or existing_sources_by_name.get(
            definition.name.casefold()
        )
        if source is None:
            session.add(
                Source(
                    key=definition.key,
                    name=definition.name,
                    base_url=definition.base_url,
                    supports_sync=True,
                )
            )
            continue

        source.key = definition.key
        source.name = definition.name
        source.base_url = definition.base_url
        source.supports_sync = True

    session.commit()


def _load_master_resume_template() -> tuple[str, str, str]:
    template_path = REPO_ROOT / "apps/web/lib/master-resume-template.md"
    raw = Path(template_path).read_text(encoding="utf-8")
    if not raw.startswith("---\n"):
        raise ValueError("Master resume template frontmatter is missing")

    _, frontmatter, markdown = raw.split("---\n", 2)
    metadata: dict[str, str] = {}
    for line in frontmatter.strip().splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip()

    title = metadata.get("title")
    summary = metadata.get("summary")
    if not title or not summary:
        raise ValueError("Master resume template requires title and summary")

    return title, summary, markdown.strip()


def _is_legacy_private_master_template(resume: ResumeTemplate) -> bool:
    return (
        resume.title == LEGACY_PRIVATE_MASTER_TEMPLATE_TITLE
        or any(
            marker in resume.markdown_content
            for marker in LEGACY_PRIVATE_MASTER_TEMPLATE_MARKERS
        )
    )


def seed_resume_templates(session: Session) -> None:
    title, summary, markdown = _load_master_resume_template()
    existing = session.scalars(select(ResumeTemplate)).all()
    if not existing:
        session.add(
            ResumeTemplate(
                title=title,
                summary=summary,
                markdown_content=markdown,
            )
        )
        session.commit()
        return

    mutated = False
    for resume in existing:
        if resume.user_id is not None:
            continue
        if not _is_legacy_private_master_template(resume):
            continue
        resume.title = title
        resume.summary = summary
        resume.markdown_content = markdown
        mutated = True

    if mutated:
        session.commit()
        return

    session.commit()
