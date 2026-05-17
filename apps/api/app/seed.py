from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .crawlers.registry import list_source_definitions
from .models import Source


def seed_sources(session: Session) -> None:
    existing_sources = {
        source.key: source for source in session.scalars(select(Source)).all()
    }

    for definition in list_source_definitions():
        source = existing_sources.get(definition.key)
        if source is None:
            session.add(
                Source(
                    key=definition.key,
                    name=definition.name,
                    base_url=definition.base_url,
                )
            )
            continue

        source.name = definition.name
        source.base_url = definition.base_url

    session.commit()
