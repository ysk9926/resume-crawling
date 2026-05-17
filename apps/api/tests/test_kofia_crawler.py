import httpx

from app.crawlers.kofia import KofiaCrawler


LIST_HTML = """
<html>
  <body>
    <span class="mgr10">총 <em class="brown">31,816</em> 건의 게시물이 검색되었습니다.</span>
    <table class="common2">
      <tbody>
        <tr><td class="first num">31816</td></tr>
      </tbody>
    </table>
    <div id="currentPage">
      <div id="rbutton">
        <a href="?page=3182"><img alt="마지막 페이지로 가기" /></a>
      </div>
    </div>
  </body>
</html>
"""


class StubClient:
    def get(self, url: str, params: dict[str, int] | None = None) -> httpx.Response:
        request = httpx.Request("GET", url, params=params)
        return httpx.Response(200, text=LIST_HTML, request=request)

    def close(self) -> None:
        return None


def test_get_crawl_info_parses_total_pages_and_items() -> None:
    crawler = KofiaCrawler(client=StubClient())

    crawl_info = crawler.get_crawl_info()

    assert crawl_info.current_page == 1
    assert crawl_info.total_pages == 3182
    assert crawl_info.total_items == 31816
