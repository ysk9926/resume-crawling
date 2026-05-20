from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Application, JobPosting, UserPostingState


DEFAULT_CURATION_STATUS = "new"


def resolve_posting_flags(
    current_bookmarked: bool,
    current_todo: bool,
    next_bookmarked: bool | None,
    next_todo: bool | None,
) -> tuple[bool, bool]:
    bookmarked = current_bookmarked if next_bookmarked is None else next_bookmarked
    todo = current_todo if next_todo is None else next_todo

    if next_bookmarked is False and next_todo is None:
        todo = False
    if todo:
        bookmarked = True
    if not bookmarked:
        todo = False

    return bookmarked, todo


def get_or_create_posting_state(
    session: Session,
    user_id: int,
    posting_id: int,
) -> UserPostingState:
    state = session.scalar(
        select(UserPostingState).where(
            UserPostingState.user_id == user_id,
            UserPostingState.job_posting_id == posting_id,
        )
    )
    if state is not None:
        return state

    state = UserPostingState(
        user_id=user_id,
        job_posting_id=posting_id,
        curation_status=DEFAULT_CURATION_STATUS,
    )
    session.add(state)
    session.flush()
    return state


def load_posting_state_map(
    session: Session,
    user_id: int,
    posting_ids: list[int],
) -> dict[int, UserPostingState]:
    if not posting_ids:
        return {}

    states = session.scalars(
        select(UserPostingState).where(
            UserPostingState.user_id == user_id,
            UserPostingState.job_posting_id.in_(posting_ids),
        )
    ).all()
    return {state.job_posting_id: state for state in states}


def load_application_map(
    session: Session,
    user_id: int,
    posting_ids: list[int],
) -> dict[int, Application]:
    if not posting_ids:
        return {}

    applications = session.scalars(
        select(Application).where(
            Application.user_id == user_id,
            Application.job_posting_id.in_(posting_ids),
        )
    ).all()
    return {application.job_posting_id: application for application in applications}


def posting_has_legacy_personal_data(posting: JobPosting) -> bool:
    return any(
        [
            posting.curation_status != DEFAULT_CURATION_STATUS,
            bool(posting.curation_note),
            bool(posting.is_bookmarked),
            bool(posting.is_todo),
        ]
    )
