from app.utils.text import derive_tags, normalize_whitespace


def test_normalize_whitespace_preserves_paragraphs() -> None:
    raw = "첫 줄\n\n\n   둘째    줄  \n\n셋째 줄"
    assert normalize_whitespace(raw) == "첫 줄\n\n둘째 줄\n\n셋째 줄"


def test_derive_tags_matches_korean_and_english_keywords() -> None:
    tags = derive_tags("파이썬 백엔드 개발자", "React와 data pipeline 경험 우대")
    assert tags == ["Python", "React", "Backend", "Data"]
