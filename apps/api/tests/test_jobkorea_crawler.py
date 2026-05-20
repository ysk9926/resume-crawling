from datetime import date

import httpx

from app.crawlers.jobkorea import JobKoreaCrawler
from app.crawlers.jobkorea_filters import (
    build_jobkorea_list_request_payload,
    parse_jobkorea_filter_options,
)


LIST_HTML = """
<div class="tplJobListWrap devTplTabBx">
  <input type="hidden" id="hdnGICnt" value="545" />
  <div class="tplList tplJobList">
    <table>
      <tbody>
        <tr class="devloopArea" data-gno="49173539">
          <td class="tplCo">
            <a class="link" href="/Recruit/Co_Read/C/27493">갤럭시아머니트리㈜</a>
            <div class="typ">
              <a class="lstBtnTy lstBtnKosdaq"><span class="blind">코스닥</span></a>
            </div>
          </td>
          <td class="tplTit">
            <div class="titBx">
              <strong>
                <a
                  class="link"
                  href="/Recruit/GI_Read/49173539?rPageCode=SL"
                  title="[효성 계열사] 백엔드 서비스 기획 및 운영 담당자 모집"
                >
                  [효성 계열사] 백엔드 서비스 기획 및 운영 담당자 모집
                </a>
              </strong>
              <p class="etc">
                <span class="cell">경력3년↑</span>
                <span class="cell">학력무관</span>
                <span class="cell">서울 강남구</span>
                <span class="cell">정규직</span>
              </p>
              <p class="dsc">모바일앱개발, 반응형웹, UI ·UX기획</p>
            </div>
          </td>
          <td class="odd">
            <button type="button" class="tplBtn tplBtn_1 tplBtnOrg dev-btn-apply">
              <span>즉시지원</span>
            </button>
            <span class="time dotum"><span class="tahoma">3</span>일 전 등록</span>
            <span class="date dotum"><span class="tahoma">~05/28</span>(목)</span>
          </td>
        </tr>
        <tr class="devloopArea" data-gno="49173000">
          <td class="tplCo">
            <a class="link" href="/Recruit/Co_Read/C/68326">GS건설㈜</a>
            <p class="info dotum"><span>GS그룹 계열사</span></p>
          </td>
          <td class="tplTit">
            <div class="titBx">
              <strong>
                <a
                  class="link"
                  href="/Recruit/GI_Read/49173000?rPageCode=SL"
                  title="GS건설 2026년 정규직 경력사원 채용"
                >
                  GS건설 2026년 정규직 경력사원 채용
                </a>
              </strong>
              <p class="etc">
                <span class="cell">경력3년↑</span>
                <span class="cell">초대졸↑</span>
                <span class="cell">서울 종로구</span>
                <span class="cell">정규직</span>
              </p>
              <p class="dsc">서버구축, 시스템운영, 데이터분석</p>
            </div>
          </td>
          <td class="odd">
            <button
              type="button"
              class="tplBtn tplBtn_1 tplBtnBlue devApplyEtc"
              data-info="/List_GI/GIB_Read_homepage_Link.asp?sc=614&GI_NO=50893054|49173000|C04|0|6|0"
            >
              <span>홈페이지 지원</span>
            </button>
            <span class="time dotum"><span class="tahoma">05/09</span>(토) 등록</span>
            <span class="date dotum"><span class="end">오늘마감</span></span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
"""


class StubClient:
    def __init__(self) -> None:
        self.posts: list[dict[str, object]] = []

    def post(self, url: str, data: dict[str, str] | None = None) -> httpx.Response:
        self.posts.append({"url": url, "data": data})
        request = httpx.Request("POST", url, data=data)
        return httpx.Response(200, text=LIST_HTML, request=request)

    def close(self) -> None:
        return None


FILTER_OPTIONS_HTML = """
<div>
  <dl class="job circleType dev-tab dev-duty" data-category="duty">
    <dd class="ly_sub">
      <ul data-category="duty">
        <li class="item" data-value-json='{"groupCode":10031,"groupName":"AI·개발·데이터","subList":[{"subCode":1000254,"subName":"백엔드 개발자"}]}'></li>
      </ul>
    </dd>
  </dl>
  <dl class="loc circleType dev-tab dev-local" data-category="local">
    <dd class="ly_sub">
      <ul data-category="local">
        <li class="item" data-value-json='{"groupCode":"I000","groupName":"서울","subList":[{"subCode":"I010","subName":"강남구"}]}'></li>
      </ul>
    </dd>
  </dl>
  <dl class="exp circleType dev-tab dev-career">
    <input type="checkbox" name="career" value="2" data-name="1~3년" />
  </dl>
  <dl class="edu circleType dev-tab dev-edu">
    <input type="checkbox" name="edu" value="5" data-name="대학교졸업(4년)" />
  </dl>
  <dl class="cty circleType dev-tab dev-cotype">
    <input type="checkbox" name="cotype" value="1" data-name="대기업" />
  </dl>
  <dl class="hty circleType dev-tab dev-jobtype">
    <input type="checkbox" name="jobtype" value="1" data-name="정규직" />
  </dl>
  <dl class="ids dev-industry dev-tab" data-category="industry">
    <dd class="ly_sub">
      <ul data-category="industry">
        <li class="item" data-value-json='{"groupCode":10007,"groupName":"IT·정보통신업","subList":[{"subCode":1000067,"subName":"솔루션·SI·CRM·ERP"}]}'></li>
      </ul>
    </dd>
  </dl>
  <dl class="ppp dev-tab dev-position">
    <dl class="detail_sec circleType">
      <dt><p class="tit">직급</p></dt>
      <dd><input type="checkbox" name="position1" value="1" data-name="사원급" /></dd>
    </dl>
    <dl class="detail_sec circleType">
      <dt><p class="tit">직책</p></dt>
      <dd><input type="checkbox" name="position2" value="8" data-name="팀장/매니저/실장" /></dd>
    </dl>
    <input type="checkbox" name="pay" value="3" data-name="3000 ~ 3500만원" />
    <select name="paytype">
      <option value="1">연봉</option>
      <option value="2">월급</option>
    </select>
  </dl>
  <dl class="mjr dev-tab dev-major" data-category="major">
    <dd class="ly_sub">
      <div class="detail_sec circleType">
        <dd class="certify">
          <input type="checkbox" name="major" value="21400" data-name="비즈니스애널리틱스학과" />
        </dd>
      </div>
    </dd>
  </dl>
  <dl class="lic dev-tab dev-license">
    <dd class="ly_sub">
      <div class="detail_sec circleType">
        <dt><p class="tit">건설·건축·토목</p></dt>
        <dd class="certify">
          <input type="checkbox" name="license" value="1205020" data-name="건축기사" />
        </dd>
      </div>
    </dd>
  </dl>
  <dl class="prf dev-tab dev-pref">
    <dd class="ly_sub">
      <div class="detail_sec circleType">
        <dt><p class="tit">지원자격</p></dt>
        <dd class="certify">
          <input type="checkbox" name="pref" value="21" data-name="운전가능자" />
        </dd>
      </div>
    </dd>
  </dl>
  <dl class="bnf dev-tab dev-wel">
    <dd class="ly_sub">
      <div class="detail_sec circleType">
        <dt><p class="tit">기본우대</p></dt>
        <dd class="certify">
          <input type="checkbox" name="wel" value="10" data-name="인센티브" />
        </dd>
      </div>
    </dd>
  </dl>
</div>
"""


def test_build_jobkorea_list_request_payload_uses_default_preset_for_empty_filters() -> None:
    payload = build_jobkorea_list_request_payload(page=3)

    assert payload["page"] == "3"
    assert payload["isDefault"] == "true"
    assert payload["condition[duty]"] == "1000230,1000231,1000229"
    assert payload["condition[local]"] == "I000,B000"
    assert payload["condition[cotype]"] == "1,2,3,4,5,6,10,11,12,13"
    assert payload["direct"] == "0"
    assert payload["confirm"] == "0"


def test_build_jobkorea_list_request_payload_maps_filter_fields() -> None:
    payload = build_jobkorea_list_request_payload(
        {
            "duties": ["10031"],
            "locals": ["I000", "B000"],
            "career_codes": ["2"],
            "career_start": 3,
            "career_end": 5,
            "education_codes": ["5"],
            "company_type_codes": ["1", "4"],
            "job_type_codes": ["1"],
            "industry_codes": ["10007"],
            "position_codes": ["1", "8"],
            "salary_codes": ["5"],
            "salary_type": "2",
            "salary_input": 350,
            "major_codes": ["21400"],
            "license_codes": ["1205020"],
            "preference_codes": ["21"],
            "welfare_codes": ["10"],
            "include_keywords": ["파이썬", "백엔드"],
            "exclude_keywords": ["SI"],
            "direct_apply_only": True,
            "exclude_confirmed_postings": True,
        },
        page=2,
    )

    assert payload["page"] == "2"
    assert payload["isDefault"] == "false"
    assert payload["direct"] == "1"
    assert payload["confirm"] == "1"
    assert payload["condition[duty]"] == "10031"
    assert payload["condition[local]"] == "I000,B000"
    assert payload["condition[career]"] == "2"
    assert payload["condition[careerStart]"] == "3"
    assert payload["condition[careerEnd]"] == "5"
    assert payload["condition[edu]"] == "5"
    assert payload["condition[cotype]"] == "1,4"
    assert payload["condition[jobtype]"] == "1"
    assert payload["condition[industry]"] == "10007"
    assert payload["condition[position]"] == "1,8"
    assert payload["condition[pay]"] == "5"
    assert payload["condition[paytype]"] == "2"
    assert payload["condition[payinput]"] == "350"
    assert payload["condition[major]"] == "21400"
    assert payload["condition[license]"] == "1205020"
    assert payload["condition[pref]"] == "21"
    assert payload["condition[wel]"] == "10"
    assert payload["condition[textinclude]"] == "파이썬,백엔드"
    assert payload["condition[textexclude]"] == "SI"


def test_parse_jobkorea_filter_options_extracts_nested_and_grouped_values() -> None:
    options = parse_jobkorea_filter_options(FILTER_OPTIONS_HTML)

    assert options.duties[0].label == "AI·개발·데이터"
    assert options.duties[0].children[0].code == "1000254"
    assert options.locals[0].children[0].label == "강남구"
    assert options.careers[0].label == "1~3년"
    assert options.company_types[0].label == "대기업"
    assert options.industries[0].children[0].label == "솔루션·SI·CRM·ERP"
    assert options.positions[0].label == "직급"
    assert options.positions[0].children[0].label == "사원급"
    assert options.salary_ranges[0].label == "3000 ~ 3500만원"
    assert options.salary_types[1].label == "월급"
    assert options.majors[0].label == "비즈니스애널리틱스학과"
    assert options.licenses[0].children[0].label == "건축기사"
    assert options.preferences[0].children[0].code == "21"
    assert options.welfare[0].children[0].label == "인센티브"


def test_get_crawl_info_parses_total_pages_and_items() -> None:
    client = StubClient()
    crawler = JobKoreaCrawler(client=client, today_provider=lambda: date(2026, 5, 17))

    crawl_info = crawler.get_crawl_info()

    assert crawl_info.current_page == 1
    assert crawl_info.total_pages == 14
    assert crawl_info.total_items == 545
    assert client.posts[0]["data"] == build_jobkorea_list_request_payload(page=1)


def test_crawl_parses_rows_with_relative_and_absolute_dates() -> None:
    crawler = JobKoreaCrawler(
        client=StubClient(),
        today_provider=lambda: date(2026, 5, 17),
    )

    postings = crawler.crawl(start_page=1, end_page=1)

    assert len(postings) == 2

    first = postings[0]
    assert first.external_id == "49173539"
    assert first.company_name == "갤럭시아머니트리㈜"
    assert first.posted_at == date(2026, 5, 14)
    assert first.apply_start_date == date(2026, 5, 14)
    assert first.apply_end_date == date(2026, 5, 28)
    assert first.external_apply_url == first.detail_url
    assert "회사명: 갤럭시아머니트리㈜" in first.normalized_content
    assert "Backend" in first.tags

    second = postings[1]
    assert second.external_id == "49173000"
    assert second.posted_at == date(2026, 5, 9)
    assert second.apply_end_date == date(2026, 5, 17)
    assert second.external_apply_url == (
        "https://www.jobkorea.co.kr/"
        "List_GI/GIB_Read_homepage_Link.asp?sc=614&GI_NO=50893054|49173000|C04|0|6|0"
    )
    assert "GS그룹 계열사" in second.normalized_content


def test_get_crawl_info_and_crawl_share_the_same_filter_payload() -> None:
    client = StubClient()
    filters = {
        "duties": ["10031"],
        "locals": ["I000"],
        "career_start": 3,
        "career_end": 7,
        "direct_apply_only": True,
        "exclude_confirmed_postings": True,
    }
    crawler = JobKoreaCrawler(
        client=client,
        today_provider=lambda: date(2026, 5, 17),
        filters=filters,
    )

    crawl_info = crawler.get_crawl_info(page=2)
    postings = crawler.crawl(start_page=2, end_page=2)

    assert crawl_info.current_page == 2
    assert len(postings) == 2
    assert client.posts[0]["data"] == client.posts[1]["data"]
    assert client.posts[0]["data"] == build_jobkorea_list_request_payload(filters, page=2)


def test_parse_deadline_keeps_future_month_day_in_current_year() -> None:
    crawler = JobKoreaCrawler(
        client=StubClient(),
        today_provider=lambda: date(2026, 5, 19),
    )

    # ~06/30 은 today 기준 +42일 — 35일 컷오프로 작년에 빠지면 안 됨.
    assert crawler._parse_deadline("~06/30 (화)") == date(2026, 6, 30)


def test_parse_deadline_keeps_long_term_deadline_in_current_year() -> None:
    crawler = JobKoreaCrawler(
        client=StubClient(),
        today_provider=lambda: date(2026, 4, 28),
    )

    # 상시채용/장기 모집: ~12/31 은 8개월 뒤 — 같은 해로 인식해야 함.
    assert crawler._parse_deadline("~12/31 (목)") == date(2026, 12, 31)


def test_parse_deadline_rolls_over_to_next_year_when_past() -> None:
    crawler = JobKoreaCrawler(
        client=StubClient(),
        today_provider=lambda: date(2026, 12, 20),
    )

    # 12월 말 시점에 ~01/15 표기는 내년 1월이어야 함.
    assert crawler._parse_deadline("~01/15 (수)") == date(2027, 1, 15)


def test_parse_posted_at_still_resolves_recent_month_day_in_current_year() -> None:
    crawler = JobKoreaCrawler(
        client=StubClient(),
        today_provider=lambda: date(2026, 5, 19),
    )

    # 등록일은 과거 지향: 04/30 은 올해 4월 30일로 해석돼야 함.
    assert crawler._parse_posted_at("04/30 (목) 등록") == date(2026, 4, 30)
