from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
import math
from typing import Any, Mapping
from urllib.parse import urljoin

import httpx

from app.crawlers.base import CrawlInfo, CrawledJobPosting
from app.utils.text import derive_tags, normalize_label, normalize_whitespace


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0 Safari/537.36"
)
API_ROOT_URL = "https://career-api.rememberapp.co.kr"
LIST_API_URL = f"{API_ROOT_URL}/job_postings/search"
DETAIL_API_URL = f"{API_ROOT_URL}/job_postings"
DEFAULT_SEED = 70093759
PAGE_SIZE = 30


@dataclass(slots=True)
class RememberAddress:
    level1: str
    level2: str | None = None


@dataclass(slots=True)
class RememberIndustryPath:
    level1: str
    level2: str | None = None
    level3: str | None = None


@dataclass(slots=True)
class RememberFilters:
    keywords: list[str] = field(default_factory=list)
    min_salary: int | None = None
    max_salary: int | None = None
    addresses: list[RememberAddress] = field(default_factory=list)
    career_year: int | None = None
    company_sizes: list[str] = field(default_factory=list)
    industry_v2_names: list[RememberIndustryPath] = field(default_factory=list)
    leader_position: bool = False
    organization_type: str | None = None
    application_type: str | None = None
    include_applied_job_posting: bool = False

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any] | None) -> RememberFilters:
        if not payload:
            return cls()

        keywords = _normalize_string_list(payload.get("keywords"))
        company_sizes = _normalize_string_list(payload.get("company_sizes"))
        addresses = _normalize_addresses(payload.get("addresses"))
        industry_v2_names = _normalize_industries(payload.get("industry_v2_names"))

        min_salary = _normalize_optional_int(payload.get("min_salary"))
        max_salary = _normalize_optional_int(payload.get("max_salary"))
        career_year = _normalize_optional_int(payload.get("career_year"))
        organization_type = normalize_label(str(payload.get("organization_type") or "")) or None
        application_type = normalize_label(str(payload.get("application_type") or "")) or None

        return cls(
            keywords=keywords,
            min_salary=min_salary,
            max_salary=max_salary,
            addresses=addresses,
            career_year=career_year,
            company_sizes=company_sizes,
            industry_v2_names=industry_v2_names,
            leader_position=bool(payload.get("leader_position")),
            organization_type=organization_type,
            application_type=application_type,
            include_applied_job_posting=bool(payload.get("include_applied_job_posting")),
        )

    def to_search_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "include_applied_job_posting": self.include_applied_job_posting,
        }
        if self.keywords:
            payload["keywords"] = self.keywords
        if self.min_salary is not None:
            payload["min_salary"] = self.min_salary
        if self.max_salary is not None:
            payload["max_salary"] = self.max_salary
        if self.addresses:
            payload["addresses"] = [
                [item.level1, item.level2] if item.level2 else [item.level1]
                for item in self.addresses
            ]
        if self.career_year is not None:
            payload["career_year"] = self.career_year
        if self.company_sizes:
            payload["company_sizes"] = self.company_sizes
        if self.industry_v2_names:
            payload["industry_v2_names"] = [
                {
                    key: value
                    for key, value in {
                        "level1": item.level1,
                        "level2": item.level2,
                        "level3": item.level3,
                    }.items()
                    if value
                }
                for item in self.industry_v2_names
            ]
        if self.leader_position:
            payload["leader_position"] = True
        if self.organization_type:
            payload["organization_type"] = self.organization_type
        if self.application_type:
            payload["application_type"] = self.application_type
        return payload


class RememberCrawler:
    source_key = "remember"
    display_name = "리멤버 채용공고"
    base_url = "https://career.rememberapp.co.kr/job/postings"

    def __init__(
        self,
        client: httpx.Client | None = None,
        filters: Mapping[str, Any] | None = None,
    ) -> None:
        self.client = client or httpx.Client(
            follow_redirects=True,
            timeout=20.0,
            headers={"User-Agent": USER_AGENT},
        )
        self._owns_client = client is None
        self._is_closed = False
        self._filters = RememberFilters.from_payload(filters)

    def get_crawl_info(self, page: int = 1) -> CrawlInfo:
        if page < 1:
            raise ValueError("조회 페이지는 1 이상이어야 합니다.")

        payload = self._search(page=page, per=PAGE_SIZE)
        meta = payload.get("meta") or {}
        total_items = int(meta.get("total_count") or 0)
        total_pages = int(meta.get("total_pages") or 0) or max(1, math.ceil(total_items / PAGE_SIZE))
        current_page = int(meta.get("page") or page)
        return CrawlInfo(
            current_page=current_page,
            total_pages=max(total_pages, 1),
            total_items=total_items,
        )

    def crawl(self, start_page: int = 1, end_page: int = 1) -> list[CrawledJobPosting]:
        if start_page < 1:
            raise ValueError("시작 페이지는 1 이상이어야 합니다.")
        if end_page < start_page:
            raise ValueError("종료 페이지는 시작 페이지보다 크거나 같아야 합니다.")

        postings: list[CrawledJobPosting] = []
        seen_ids: set[int] = set()
        try:
            for page in range(start_page, end_page + 1):
                payload = self._search(page=page, per=PAGE_SIZE)
                for item in payload.get("data") or []:
                    external_id = item.get("id")
                    if not isinstance(external_id, int) or external_id in seen_ids:
                        continue
                    seen_ids.add(external_id)
                    postings.append(self._fetch_detail(external_id))
            return postings
        finally:
            self.close()

    def close(self) -> None:
        if self._owns_client and not self._is_closed:
            self.client.close()
            self._is_closed = True

    def _search(self, page: int, per: int) -> dict[str, Any]:
        response = self.client.post(
            LIST_API_URL,
            json={
                "search": self._filters.to_search_payload(),
                "sort": "starts_at_desc",
                "page": page,
                "per": per,
                "seed": DEFAULT_SEED,
            },
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("리멤버 검색 응답 형식이 올바르지 않습니다.")
        return payload

    def _fetch_detail(self, external_id: int) -> CrawledJobPosting:
        response = self.client.get(f"{DETAIL_API_URL}/{external_id}")
        response.raise_for_status()

        payload = response.json()
        detail = payload.get("data") or {}
        if not isinstance(detail, dict):
            raise ValueError("리멤버 상세 응답 형식이 올바르지 않습니다.")

        organization = detail.get("organization")
        organization_name = ""
        if isinstance(organization, dict):
            organization_name = str(organization.get("name") or "")
        company_name = normalize_whitespace(organization_name)
        title = normalize_whitespace(str(detail.get("title") or ""))
        detail_url = urljoin(self.base_url, f"/job/posting/{external_id}")

        starts_at = _parse_iso_date(detail.get("starts_at"))
        ends_at = _parse_iso_date(detail.get("ends_at"))
        raw_content = _build_raw_content(company_name=company_name, title=title, detail=detail)
        normalized_content = normalize_whitespace(raw_content)
        tag_source = "\n".join(
            value
            for value in [
                normalized_content,
                ", ".join(_format_job_categories(detail.get("job_categories"))),
                ", ".join(_format_industries(detail.get("industries"))),
                ", ".join(_format_chip_labels(detail.get("chips"))),
            ]
            if value
        )

        external_apply_url = normalize_label(str(detail.get("link") or "")) or detail_url

        return CrawledJobPosting(
            external_id=str(external_id),
            company_name=company_name,
            title=title,
            detail_url=detail_url,
            external_apply_url=external_apply_url,
            posted_at=starts_at,
            apply_period_raw=_format_apply_period(starts_at, ends_at),
            apply_start_date=starts_at,
            apply_end_date=ends_at,
            raw_content=raw_content,
            normalized_content=normalized_content,
            tags=derive_tags(title, tag_source),
        )


def _normalize_optional_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def _normalize_string_list(value: Any) -> list[str]:
    if isinstance(value, str):
        normalized = normalize_label(value)
        return [normalized] if normalized else []
    if not isinstance(value, list):
        return []
    return [
        normalized
        for item in value
        if (normalized := normalize_label(str(item or "")))
    ]


def _normalize_addresses(value: Any) -> list[RememberAddress]:
    if not isinstance(value, list):
        return []

    addresses: list[RememberAddress] = []
    for item in value:
        if isinstance(item, dict):
            level1 = normalize_label(str(item.get("level1") or ""))
            level2 = normalize_label(str(item.get("level2") or "")) or None
        elif isinstance(item, list) and item:
            level1 = normalize_label(str(item[0] or ""))
            level2 = (
                normalize_label(str(item[1] or "")) or None
                if len(item) > 1
                else None
            )
        else:
            continue

        if level1:
            addresses.append(RememberAddress(level1=level1, level2=level2))
    return addresses


def _normalize_industries(value: Any) -> list[RememberIndustryPath]:
    if not isinstance(value, list):
        return []

    industries: list[RememberIndustryPath] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        level1 = normalize_label(str(item.get("level1") or ""))
        level2 = normalize_label(str(item.get("level2") or "")) or None
        level3 = normalize_label(str(item.get("level3") or "")) or None
        if level1:
            industries.append(
                RememberIndustryPath(level1=level1, level2=level2, level3=level3)
            )
    return industries


def _parse_iso_date(value: Any) -> date | None:
    if not value:
        return None
    if not isinstance(value, str):
        return None
    return datetime.fromisoformat(value).date()


def _format_apply_period(starts_at: date | None, ends_at: date | None) -> str | None:
    if starts_at and ends_at:
        return f"{starts_at.isoformat()} ~ {ends_at.isoformat()}"
    if starts_at:
        return starts_at.isoformat()
    if ends_at:
        return f"~ {ends_at.isoformat()}"
    return None


def _build_raw_content(company_name: str, title: str, detail: Mapping[str, Any]) -> str:
    lines = [f"회사명: {company_name}", f"공고제목: {title}"]

    categories = _format_job_categories(detail.get("job_categories"))
    if categories:
        lines.append(f"직무분류: {', '.join(categories)}")

    industries = _format_industries(detail.get("industries"))
    if industries:
        lines.append(f"산업/업종: {', '.join(industries)}")

    addresses = _format_addresses(detail.get("addresses"))
    if addresses:
        lines.append(f"근무지: {', '.join(addresses)}")

    experience_label = _format_experience(detail)
    if experience_label:
        lines.append(f"경력: {experience_label}")

    education_requirement = normalize_label(str(detail.get("education_requirement") or ""))
    if education_requirement:
        lines.append(f"학력: {education_requirement}")

    salary_label = _format_salary(detail)
    if salary_label:
        lines.append(f"연봉: {salary_label}")

    if detail.get("leader_position"):
        lines.append("리더급 포지션: 예")

    chip_labels = _format_chip_labels(detail.get("chips"))
    if chip_labels:
        lines.append(f"칩: {', '.join(chip_labels)}")

    section_pairs = [
        ("회사 소개", detail.get("company_description")),
        ("소개", detail.get("introduction")),
        ("주요 업무", detail.get("job_description")),
        ("자격 요건", detail.get("qualifications")),
        ("우대 사항", detail.get("preferred_qualifications")),
        ("채용 절차", detail.get("recruiting_process")),
        ("추가 정보", detail.get("additional_information")),
        ("원하는 인재상", _format_desired_profile(detail.get("desired_profile_condition"))),
    ]
    for label, value in section_pairs:
        content = normalize_whitespace(str(value or ""))
        if content:
            lines.append(f"{label}:\n{content}")

    return "\n".join(lines)


def _format_job_categories(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    categories: list[str] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        category = " · ".join(
            part
            for part in [
                normalize_label(str(item.get("level1") or "")),
                normalize_label(str(item.get("level2") or "")),
            ]
            if part
        )
        if category:
            categories.append(category)
    return categories


def _format_industries(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    industries: list[str] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        label = " > ".join(
            part
            for part in [
                normalize_label(str(item.get("level1") or "")),
                normalize_label(str(item.get("level2") or "")),
                normalize_label(str(item.get("level3") or "")),
                normalize_label(str(item.get("name") or "")),
            ]
            if part
        )
        if label:
            industries.append(label)
    return industries


def _format_addresses(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    addresses: list[str] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        label = " ".join(
            part
            for part in [
                normalize_label(str(item.get("address_level1") or "")),
                normalize_label(str(item.get("address_level2") or "")),
            ]
            if part
        )
        if label:
            addresses.append(label)
    return addresses


def _format_experience(detail: Mapping[str, Any]) -> str | None:
    min_experience = detail.get("min_experience")
    max_experience = detail.get("max_experience")

    if min_experience is None and max_experience is None:
        return None
    if min_experience is None:
        return f"{max_experience}년 이하"
    if max_experience is None:
        return f"{min_experience}년 이상"
    if min_experience == max_experience:
        return f"{min_experience}년"
    return f"{min_experience}년~{max_experience}년"


def _format_salary(detail: Mapping[str, Any]) -> str | None:
    min_salary = detail.get("min_salary")
    max_salary = detail.get("max_salary")
    total_compensation = detail.get("total_compensation")

    if min_salary and max_salary:
        return f"{min_salary:,}만 원~{max_salary:,}만 원"
    if min_salary:
        return f"{min_salary:,}만 원 이상"
    if max_salary:
        return f"{max_salary:,}만 원 이하"
    if total_compensation:
        return f"{int(total_compensation):,}만 원"
    return None


def _format_chip_labels(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    labels: list[str] = []
    for item in value:
        if isinstance(item, str):
            label = normalize_label(item)
        elif isinstance(item, dict):
            label = normalize_label(
                str(item.get("label") or item.get("name") or item.get("text") or "")
            )
        else:
            label = ""
        if label:
            labels.append(label)
    return labels


def _format_desired_profile(value: Any) -> str:
    if not isinstance(value, dict):
        return ""
    return ", ".join(
        label
        for label in [
            normalize_label(str(item))
            for item in value.values()
        ]
        if label
    )
