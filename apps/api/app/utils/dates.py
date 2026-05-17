from __future__ import annotations

from datetime import date


def parse_date(value: str | None) -> date | None:
    if not value:
        return None

    candidate = value.strip()
    if not candidate:
        return None

    cleaned = candidate.replace(".", "-").replace("/", "-")
    parts = cleaned.split("-")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        return None

    year, month, day = map(int, parts)
    return date(year, month, day)


def parse_date_range(value: str | None) -> tuple[date | None, date | None]:
    if not value or "~" not in value:
        return (None, None)

    left, right = value.split("~", 1)
    if len(left) == 8 and left.isdigit():
        left = f"{left[:4]}-{left[4:6]}-{left[6:]}"
    if len(right) == 8 and right.isdigit():
        right = f"{right[:4]}-{right[4:6]}-{right[6:]}"

    return (parse_date(left), parse_date(right))
