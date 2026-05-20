import json
from argparse import Namespace

from app.crawlers.jobkorea_filters import JobKoreaFilterOption, JobKoreaFilterOptions
from app.scripts import source_admin


def test_main_filter_options_prints_jobkorea_metadata(
    monkeypatch,
    capsys,
) -> None:
    monkeypatch.setattr(
        source_admin,
        "parse_args",
        lambda: Namespace(command="filter-options", source_key="jobkorea"),
    )
    monkeypatch.setattr(
        source_admin,
        "get_cached_jobkorea_filter_options",
        lambda: JobKoreaFilterOptions(
            duties=[
                JobKoreaFilterOption(
                    code="10031",
                    label="AI·개발·데이터",
                    children=[JobKoreaFilterOption(code="1000254", label="백엔드 개발자")],
                )
            ]
        ),
    )

    exit_code = source_admin.main()
    captured = capsys.readouterr()
    payload = json.loads(captured.out)

    assert exit_code == 0
    assert payload["duties"][0]["code"] == "10031"
    assert payload["duties"][0]["children"][0]["label"] == "백엔드 개발자"


def test_main_reports_invalid_filters_json(monkeypatch, capsys) -> None:
    monkeypatch.setattr(
        source_admin,
        "parse_args",
        lambda: Namespace(
            command="crawl-info",
            source_key="remember",
            page=1,
            filters_json="{invalid",
        ),
    )

    exit_code = source_admin.main()
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Invalid filters JSON" in captured.err


def test_main_rejects_filter_options_for_unsupported_source(monkeypatch, capsys) -> None:
    monkeypatch.setattr(
        source_admin,
        "parse_args",
        lambda: Namespace(command="filter-options", source_key="remember"),
    )

    exit_code = source_admin.main()
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Source does not expose filter options: remember" in captured.err
