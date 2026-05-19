from datetime import date

import httpx

from app.crawlers.remember import RememberCrawler


SEARCH_PAYLOAD = {
    "data": [{"id": 294726}],
    "meta": {
        "total_count": 61,
        "total_pages": 3,
        "page": 1,
        "per": 30,
    },
}

DETAIL_PAYLOAD = {
    "data": {
        "id": 294726,
        "title": "프로젝트 매니저 백엔드",
        "organization": {"name": "(주)글로우서울"},
        "job_categories": [{"level1": "개발", "level2": "백엔드"}],
        "industries": [{"level1": "IT·통신", "level2": "AI/데이터", "level3": "데이터 분석"}],
        "addresses": [{"address_level1": "서울특별시", "address_level2": "용산구"}],
        "min_experience": 3,
        "max_experience": 7,
        "min_salary": 6000,
        "max_salary": 8000,
        "starts_at": "2026-05-18T00:00:00.000+09:00",
        "ends_at": "2026-05-31T23:59:59.000+09:00",
        "job_description": "백엔드 API 개발",
        "qualifications": "Python 경험",
        "preferred_qualifications": "데이터 분석 경험",
        "recruiting_process": "서류 > 면접",
        "additional_information": "정규직",
        "introduction": "팀 소개",
        "leader_position": True,
        "chips": [{"label": "리더급"}, {"label": "Python"}],
        "link": "",
    }
}


class StubClient:
    def __init__(self) -> None:
        self.post_payloads: list[dict] = []
        self.requested_urls: list[str] = []

    def post(self, url: str, json: dict | None = None) -> httpx.Response:
        self.post_payloads.append(json or {})
        request = httpx.Request("POST", url, json=json)
        return httpx.Response(200, json=SEARCH_PAYLOAD, request=request)

    def get(self, url: str) -> httpx.Response:
        self.requested_urls.append(url)
        request = httpx.Request("GET", url)
        return httpx.Response(200, json=DETAIL_PAYLOAD, request=request)

    def close(self) -> None:
        return None


def test_get_crawl_info_parses_meta_totals() -> None:
    crawler = RememberCrawler(client=StubClient())

    crawl_info = crawler.get_crawl_info()

    assert crawl_info.current_page == 1
    assert crawl_info.total_pages == 3
    assert crawl_info.total_items == 61


def test_crawl_uses_filters_and_builds_posting_from_detail() -> None:
    client = StubClient()
    crawler = RememberCrawler(
        client=client,
        filters={
            "keywords": ["백엔드"],
            "leader_position": True,
            "organization_type": "without_headhunter",
        },
    )

    postings = crawler.crawl(start_page=1, end_page=1)

    assert len(postings) == 1
    assert client.post_payloads[0]["search"] == {
        "include_applied_job_posting": False,
        "keywords": ["백엔드"],
        "leader_position": True,
        "organization_type": "without_headhunter",
    }
    assert client.requested_urls == ["https://career-api.rememberapp.co.kr/job_postings/294726"]

    posting = postings[0]
    assert posting.external_id == "294726"
    assert posting.company_name == "(주)글로우서울"
    assert posting.title == "프로젝트 매니저 백엔드"
    assert posting.posted_at == date(2026, 5, 18)
    assert posting.apply_start_date == date(2026, 5, 18)
    assert posting.apply_end_date == date(2026, 5, 31)
    assert posting.external_apply_url == posting.detail_url
    assert "직무분류: 개발 · 백엔드" in posting.normalized_content
    assert "연봉: 6,000만 원~8,000만 원" in posting.normalized_content
    assert "Python" in posting.tags
    assert "Backend" in posting.tags
