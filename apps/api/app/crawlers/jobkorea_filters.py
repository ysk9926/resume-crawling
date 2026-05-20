from __future__ import annotations

from dataclasses import dataclass, field
import json
from time import monotonic
from typing import Any, Mapping

import httpx
from bs4 import BeautifulSoup, Tag

from app.utils.text import normalize_label


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0 Safari/537.36"
)
ROOT_URL = "https://www.jobkorea.co.kr"
LIST_API_URL = f"{ROOT_URL}/Recruit/Home/_GI_List/"
SEARCH_PAGE_URL = f"{ROOT_URL}/recruit/joblist?menucode=search"
PAGE_SIZE = 40
FILTER_OPTIONS_CACHE_TTL_SECONDS = 60 * 10

DEFAULT_FORM_PAYLOAD = {
    "direct": "0",
    "order": "20",
    "pagesize": str(PAGE_SIZE),
    "tabindex": "0",
    "onePick": "0",
    "confirm": "0",
    "profile": "0",
}
DEFAULT_CONDITION_PRESET = {
    "duty": "1000230,1000231,1000229",
    "local": "I000,B000",
    "cotype": "1,2,3,4,5,6,10,11,12,13",
    "menucode": "",
}


@dataclass(slots=True)
class JobKoreaFilterOption:
    code: str
    label: str
    children: list["JobKoreaFilterOption"] = field(default_factory=list)


@dataclass(slots=True)
class JobKoreaFilterOptions:
    duties: list[JobKoreaFilterOption] = field(default_factory=list)
    locals: list[JobKoreaFilterOption] = field(default_factory=list)
    careers: list[JobKoreaFilterOption] = field(default_factory=list)
    educations: list[JobKoreaFilterOption] = field(default_factory=list)
    company_types: list[JobKoreaFilterOption] = field(default_factory=list)
    job_types: list[JobKoreaFilterOption] = field(default_factory=list)
    industries: list[JobKoreaFilterOption] = field(default_factory=list)
    positions: list[JobKoreaFilterOption] = field(default_factory=list)
    salary_ranges: list[JobKoreaFilterOption] = field(default_factory=list)
    salary_types: list[JobKoreaFilterOption] = field(default_factory=list)
    majors: list[JobKoreaFilterOption] = field(default_factory=list)
    licenses: list[JobKoreaFilterOption] = field(default_factory=list)
    preferences: list[JobKoreaFilterOption] = field(default_factory=list)
    welfare: list[JobKoreaFilterOption] = field(default_factory=list)


@dataclass(slots=True)
class JobKoreaFilters:
    duties: list[str] = field(default_factory=list)
    duty_keywords: list[str] = field(default_factory=list)
    locals: list[str] = field(default_factory=list)
    career_codes: list[str] = field(default_factory=list)
    career_start: int | None = None
    career_end: int | None = None
    education_codes: list[str] = field(default_factory=list)
    company_type_codes: list[str] = field(default_factory=list)
    job_type_codes: list[str] = field(default_factory=list)
    industry_codes: list[str] = field(default_factory=list)
    industry_keywords: list[str] = field(default_factory=list)
    position_codes: list[str] = field(default_factory=list)
    salary_codes: list[str] = field(default_factory=list)
    salary_type: str | None = None
    salary_input: int | None = None
    major_codes: list[str] = field(default_factory=list)
    license_codes: list[str] = field(default_factory=list)
    preference_codes: list[str] = field(default_factory=list)
    welfare_codes: list[str] = field(default_factory=list)
    include_keywords: list[str] = field(default_factory=list)
    exclude_keywords: list[str] = field(default_factory=list)
    direct_apply_only: bool = False
    exclude_confirmed_postings: bool = False

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any] | None) -> "JobKoreaFilters":
        if not payload:
            return cls()

        return cls(
            duties=_normalize_string_list(payload.get("duties")),
            duty_keywords=_normalize_string_list(payload.get("duty_keywords")),
            locals=_normalize_string_list(payload.get("locals")),
            career_codes=_normalize_string_list(payload.get("career_codes")),
            career_start=_normalize_optional_int(payload.get("career_start")),
            career_end=_normalize_optional_int(payload.get("career_end")),
            education_codes=_normalize_string_list(payload.get("education_codes")),
            company_type_codes=_normalize_string_list(payload.get("company_type_codes")),
            job_type_codes=_normalize_string_list(payload.get("job_type_codes")),
            industry_codes=_normalize_string_list(payload.get("industry_codes")),
            industry_keywords=_normalize_string_list(payload.get("industry_keywords")),
            position_codes=_normalize_string_list(payload.get("position_codes")),
            salary_codes=_normalize_string_list(payload.get("salary_codes")),
            salary_type=_normalize_optional_text(payload.get("salary_type")),
            salary_input=_normalize_optional_int(payload.get("salary_input")),
            major_codes=_normalize_string_list(payload.get("major_codes")),
            license_codes=_normalize_string_list(payload.get("license_codes")),
            preference_codes=_normalize_string_list(payload.get("preference_codes")),
            welfare_codes=_normalize_string_list(payload.get("welfare_codes")),
            include_keywords=_normalize_string_list(payload.get("include_keywords")),
            exclude_keywords=_normalize_string_list(payload.get("exclude_keywords")),
            direct_apply_only=_normalize_bool(payload.get("direct_apply_only")),
            exclude_confirmed_postings=_normalize_bool(
                payload.get("exclude_confirmed_postings")
            ),
        )

    def has_user_filters(self) -> bool:
        return any(
            [
                self.duties,
                self.duty_keywords,
                self.locals,
                self.career_codes,
                self.career_start is not None,
                self.career_end is not None,
                self.education_codes,
                self.company_type_codes,
                self.job_type_codes,
                self.industry_codes,
                self.industry_keywords,
                self.position_codes,
                self.salary_codes,
                self.salary_type,
                self.salary_input is not None,
                self.major_codes,
                self.license_codes,
                self.preference_codes,
                self.welfare_codes,
                self.include_keywords,
                self.exclude_keywords,
                self.direct_apply_only,
                self.exclude_confirmed_postings,
            ]
        )

    def to_condition(self) -> dict[str, str]:
        salary_type = self.salary_type or ("1" if self.salary_input is not None else None)
        condition = {
            "duty": _join_csv(self.duties),
            "dkwrd": _join_csv(self.duty_keywords),
            "local": _join_csv(self.locals),
            "career": _join_csv(self.career_codes),
            "careerStart": _stringify_optional_int(self.career_start),
            "careerEnd": _stringify_optional_int(self.career_end),
            "edu": _join_csv(self.education_codes),
            "cotype": _join_csv(self.company_type_codes),
            "jobtype": _join_csv(self.job_type_codes),
            "industry": _join_csv(self.industry_codes),
            "ikwrd": _join_csv(self.industry_keywords),
            "position": _join_csv(self.position_codes),
            "pay": _join_csv(self.salary_codes),
            "paytype": salary_type,
            "payinput": _stringify_optional_int(self.salary_input),
            "major": _join_csv(self.major_codes),
            "license": _join_csv(self.license_codes),
            "pref": _join_csv(self.preference_codes),
            "wel": _join_csv(self.welfare_codes),
            "textinclude": _join_csv(self.include_keywords),
            "textexclude": _join_csv(self.exclude_keywords),
            "menucode": DEFAULT_CONDITION_PRESET["menucode"],
        }
        return {key: value for key, value in condition.items() if value}


_cached_filter_options: tuple[float, JobKoreaFilterOptions] | None = None


def build_jobkorea_list_request_payload(
    filters: Mapping[str, Any] | None = None,
    *,
    page: int,
) -> dict[str, str]:
    normalized = JobKoreaFilters.from_payload(filters)
    condition = (
        normalized.to_condition() if normalized.has_user_filters() else DEFAULT_CONDITION_PRESET
    )

    payload = {
        **DEFAULT_FORM_PAYLOAD,
        "page": str(page),
        "isDefault": "false" if normalized.has_user_filters() else "true",
    }
    if normalized.direct_apply_only:
        payload["direct"] = "1"
    if normalized.exclude_confirmed_postings:
        payload["confirm"] = "1"

    for key, value in condition.items():
        payload[f"condition[{key}]"] = value
    return payload


def fetch_jobkorea_filter_options(
    client: httpx.Client | None = None,
) -> JobKoreaFilterOptions:
    owns_client = client is None
    request_client = client or httpx.Client(
        follow_redirects=True,
        timeout=20.0,
        headers={"User-Agent": USER_AGENT},
    )
    try:
        response = request_client.get(SEARCH_PAGE_URL)
        response.raise_for_status()
        return parse_jobkorea_filter_options(response.text)
    finally:
        if owns_client:
            request_client.close()


def get_cached_jobkorea_filter_options(
    client: httpx.Client | None = None,
) -> JobKoreaFilterOptions:
    global _cached_filter_options

    if _cached_filter_options is not None:
        cached_at, cached_value = _cached_filter_options
        if monotonic() - cached_at < FILTER_OPTIONS_CACHE_TTL_SECONDS:
            return cached_value

    parsed = fetch_jobkorea_filter_options(client=client)
    _cached_filter_options = (monotonic(), parsed)
    return parsed


def parse_jobkorea_filter_options(html: str) -> JobKoreaFilterOptions:
    soup = BeautifulSoup(html, "html.parser")
    return JobKoreaFilterOptions(
        duties=_parse_nested_category_options(soup, "duty", "dl.dev-duty"),
        locals=_parse_nested_category_options(soup, "local", "dl.dev-local"),
        careers=_parse_input_options(soup, "career"),
        educations=_parse_input_options(soup, "edu"),
        company_types=_parse_input_options(soup, "cotype"),
        job_types=_parse_input_options(soup, "jobtype"),
        industries=_parse_nested_category_options(soup, "industry", "dl.dev-industry"),
        positions=_parse_position_options(soup),
        salary_ranges=_parse_input_options(soup, "pay"),
        salary_types=_parse_select_options(soup, "paytype"),
        majors=_parse_grouped_detail_options(soup, "dl.dev-major", "major"),
        licenses=_parse_grouped_detail_options(soup, "dl.dev-license", "license"),
        preferences=_parse_grouped_detail_options(soup, "dl.dev-pref", "pref"),
        welfare=_parse_grouped_detail_options(soup, "dl.dev-wel", "wel"),
    )


def _normalize_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        raw_items = value.split(",")
    elif isinstance(value, (list, tuple, set)):
        raw_items = [str(item) for item in value]
    else:
        raw_items = [str(value)]

    items: list[str] = []
    seen: set[str] = set()
    for raw_item in raw_items:
        item = normalize_label(str(raw_item)).strip(",")
        if not item or item in seen:
            continue
        seen.add(item)
        items.append(item)
    return items


def _normalize_optional_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        normalized = value.strip()
        if normalized.isdigit():
            return int(normalized)
    return None


def _normalize_optional_text(value: Any) -> str | None:
    if value is None:
        return None
    normalized = normalize_label(str(value))
    return normalized or None


def _normalize_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "y", "on"}:
            return True
        if normalized in {"0", "false", "no", "n", "off", ""}:
            return False
    return bool(value)


def _stringify_optional_int(value: int | None) -> str | None:
    if value is None:
        return None
    return str(value)


def _join_csv(values: list[str]) -> str | None:
    if not values:
        return None
    return ",".join(values)


def _parse_nested_category_options(
    soup: BeautifulSoup,
    category: str,
    section_selector: str,
) -> list[JobKoreaFilterOption]:
    section = soup.select_one(section_selector)
    if section is None:
        return []

    options: list[JobKoreaFilterOption] = []
    seen_codes: set[str] = set()

    selector = f'dd.ly_sub ul[data-category="{category}"] > li.item[data-value-json]'
    for item in section.select(selector):
        payload = _decode_value_json(item.get("data-value-json"))
        if payload is None:
            continue

        group_code = normalize_label(str(payload.get("groupCode") or ""))
        group_name = normalize_label(str(payload.get("groupName") or ""))
        if not group_code or not group_name or group_code in seen_codes:
            continue

        children = _parse_sub_list(payload.get("subList"))
        options.append(
            JobKoreaFilterOption(code=group_code, label=group_name, children=children)
        )
        seen_codes.add(group_code)

    if options:
        return options

    return _parse_input_options(section, category)


def _parse_position_options(soup: BeautifulSoup) -> list[JobKoreaFilterOption]:
    section = soup.select_one("dl.dev-position")
    if section is None:
        return []

    groups = [
        ("position1", "직급"),
        ("position2", "직책"),
    ]
    options: list[JobKoreaFilterOption] = []
    for field_name, fallback_label in groups:
        items = _parse_input_options(section, field_name)
        if not items:
            continue
        title_node = section.select_one(
            f'input[name="{field_name}"]'
        )
        group_label = fallback_label
        if title_node is not None:
            detail_section = title_node.find_parent("dl")
            if detail_section is not None:
                title_tag = detail_section.select_one("dt .tit")
                if title_tag is not None:
                    group_label = _node_label(title_tag) or fallback_label

        options.append(
            JobKoreaFilterOption(
                code=f"group:{field_name}",
                label=group_label,
                children=items,
            )
        )
    return options


def _parse_grouped_detail_options(
    soup: BeautifulSoup,
    section_selector: str,
    field_name: str,
) -> list[JobKoreaFilterOption]:
    section = soup.select_one(section_selector)
    if section is None:
        return []

    detail_sections = section.select("dd.ly_sub .detail_sec")
    if not detail_sections:
        return _parse_input_options(section, field_name)

    grouped_options: list[JobKoreaFilterOption] = []
    seen_codes: set[str] = set()

    for index, detail_section in enumerate(detail_sections, start=1):
        title_tag = detail_section.select_one("dt .tit")
        group_label = _node_label(title_tag)
        children: list[JobKoreaFilterOption] = []

        for input_tag in detail_section.select(f'input[name="{field_name}"]'):
            option = _option_from_input(input_tag)
            if option is None or option.code in seen_codes:
                continue
            children.append(option)
            seen_codes.add(option.code)

        if not children:
            continue

        if group_label:
            grouped_options.append(
                JobKoreaFilterOption(
                    code=f"group:{field_name}:{index}",
                    label=group_label,
                    children=children,
                )
            )
        else:
            grouped_options.extend(children)

    if grouped_options:
        return grouped_options
    return _parse_input_options(section, field_name)


def _parse_input_options(node: BeautifulSoup | Tag, field_name: str) -> list[JobKoreaFilterOption]:
    options: list[JobKoreaFilterOption] = []
    seen_codes: set[str] = set()
    for input_tag in node.select(f'input[name="{field_name}"]'):
        option = _option_from_input(input_tag)
        if option is None or option.code in seen_codes:
            continue
        seen_codes.add(option.code)
        options.append(option)
    return options


def _parse_select_options(node: BeautifulSoup | Tag, field_name: str) -> list[JobKoreaFilterOption]:
    select_tag = node.select_one(f'select[name="{field_name}"]')
    if select_tag is None:
        return []

    options: list[JobKoreaFilterOption] = []
    seen_codes: set[str] = set()
    for option_tag in select_tag.select("option"):
        code = normalize_label(str(option_tag.get("value") or ""))
        label = _node_label(option_tag)
        if not code or not label or code in seen_codes:
            continue
        seen_codes.add(code)
        options.append(JobKoreaFilterOption(code=code, label=label))
    return options


def _option_from_input(input_tag: Tag) -> JobKoreaFilterOption | None:
    code = normalize_label(str(input_tag.get("value") or ""))
    if not code:
        return None

    label = normalize_label(str(input_tag.get("data-name") or ""))
    if not label:
        label = _label_from_for(input_tag)
    if not label:
        return None
    return JobKoreaFilterOption(code=code, label=label)


def _label_from_for(input_tag: Tag) -> str:
    input_id = str(input_tag.get("id") or "")
    if not input_id:
        return ""
    label_tag = input_tag.find_parent().select_one(f'label[for="{input_id}"]')
    if label_tag is None:
        parent = input_tag.parent
        if parent is not None:
            label_tag = parent.find("label", attrs={"for": input_id})
    return _node_label(label_tag)


def _node_label(node: Tag | None) -> str:
    if node is None:
        return ""
    return normalize_label(node.get_text(" ", strip=True))


def _decode_value_json(raw_value: str | None) -> dict[str, Any] | None:
    if raw_value is None:
        return None
    try:
        payload = json.loads(raw_value)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def _parse_sub_list(raw_value: Any) -> list[JobKoreaFilterOption]:
    if not isinstance(raw_value, list):
        return []

    children: list[JobKoreaFilterOption] = []
    seen_codes: set[str] = set()
    for item in raw_value:
        if not isinstance(item, dict):
            continue
        code = normalize_label(
            str(item.get("subCode") or item.get("code") or item.get("value") or "")
        )
        label = normalize_label(
            str(item.get("subName") or item.get("name") or item.get("label") or "")
        )
        if not code or not label or code in seen_codes:
            continue
        seen_codes.add(code)
        children.append(JobKoreaFilterOption(code=code, label=label))
    return children
