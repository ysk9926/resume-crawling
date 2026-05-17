from app.api.routes.postings import resolve_posting_flags


def test_resolve_posting_flags_promotes_todo_to_bookmark() -> None:
    bookmarked, todo = resolve_posting_flags(
        current_bookmarked=False,
        current_todo=False,
        next_bookmarked=None,
        next_todo=True,
    )

    assert bookmarked is True
    assert todo is True


def test_resolve_posting_flags_clears_todo_when_bookmark_removed() -> None:
    bookmarked, todo = resolve_posting_flags(
        current_bookmarked=True,
        current_todo=True,
        next_bookmarked=False,
        next_todo=None,
    )

    assert bookmarked is False
    assert todo is False
