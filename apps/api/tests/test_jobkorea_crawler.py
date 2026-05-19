from datetime import date

import httpx

from app.crawlers.jobkorea import JobKoreaCrawler


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
    def post(self, url: str, data: dict[str, str] | None = None) -> httpx.Response:
        request = httpx.Request("POST", url, data=data)
        return httpx.Response(200, text=LIST_HTML, request=request)

    def close(self) -> None:
        return None


def test_get_crawl_info_parses_total_pages_and_items() -> None:
    crawler = JobKoreaCrawler(
        client=StubClient(),
        today_provider=lambda: date(2026, 5, 17),
    )

    crawl_info = crawler.get_crawl_info()

    assert crawl_info.current_page == 1
    assert crawl_info.total_pages == 14
    assert crawl_info.total_items == 545


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
