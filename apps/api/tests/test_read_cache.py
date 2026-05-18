from app.services.cache import TTLMemoryCache, invalidate_read_caches, make_cache_key, read_cache


def test_ttl_cache_reuses_value_until_invalidation() -> None:
    cache = TTLMemoryCache()
    calls = {"count": 0}

    def load() -> int:
        calls["count"] += 1
        return calls["count"]

    first = cache.get_or_set("dashboard:summary", 60, load)
    second = cache.get_or_set("dashboard:summary", 60, load)
    cache.invalidate_prefixes("dashboard:")
    third = cache.get_or_set("dashboard:summary", 60, load)

    assert first == 1
    assert second == 1
    assert third == 2


def test_make_cache_key_sorts_parameters() -> None:
    cache_key = make_cache_key("postings:list:", todo=True, q="python", bookmarked=False)
    assert cache_key == "postings:list:bookmarked=False&q='python'&todo=True"


def test_invalidate_read_caches_clears_matching_prefixes() -> None:
    read_cache.get_or_set("dashboard:summary", 60, lambda: 1)
    read_cache.get_or_set("resumes:list", 60, lambda: 2)

    invalidate_read_caches("dashboard:")

    refreshed_dashboard = read_cache.get_or_set("dashboard:summary", 60, lambda: 3)
    preserved_resumes = read_cache.get_or_set("resumes:list", 60, lambda: 4)

    assert refreshed_dashboard == 3
    assert preserved_resumes == 2
