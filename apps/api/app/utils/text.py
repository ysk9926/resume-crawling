from __future__ import annotations

import re


TAG_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("Python", ("python", "파이썬")),
    ("Next.js", ("next.js", "nextjs")),
    ("React", ("react", "frontend", "프론트")),
    ("Backend", ("backend", "백엔드", "server")),
    ("Data", ("data", "데이터", "분석")),
    ("Quant", ("quant", "퀀트")),
    ("투자", ("투자", "운용", "자산")),
    ("리서치", ("리서치", "research")),
    ("마케팅", ("마케팅", "marketing")),
    ("신입", ("신입",)),
    ("경력", ("경력",)),
    ("인턴", ("인턴", "intern")),
]


def normalize_label(value: str) -> str:
    return " ".join(value.replace("\xa0", " ").split())


def build_source_key(value: str) -> str:
    normalized = normalize_label(value).lower()
    slug = re.sub(r"[^0-9a-zA-Z가-힣]+", "-", normalized).strip("-")
    return slug[:50] or "platform"


def normalize_whitespace(value: str) -> str:
    lines = value.replace("\xa0", " ").splitlines()
    normalized: list[str] = []
    previous_blank = False

    for raw_line in lines:
        line = re.sub(r"\s+", " ", raw_line).strip()
        if line:
            normalized.append(line)
            previous_blank = False
            continue

        if normalized and not previous_blank:
            normalized.append("")
        previous_blank = True

    return "\n".join(normalized).strip()


def derive_tags(title: str, content: str) -> list[str]:
    haystack = f"{title}\n{content}".lower()
    tags: list[str] = []

    for label, keywords in TAG_RULES:
        if any(keyword.lower() in haystack for keyword in keywords):
            tags.append(label)

    return tags
