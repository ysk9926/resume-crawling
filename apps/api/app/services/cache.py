from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from time import monotonic
from typing import Callable, TypeVar, cast


T = TypeVar("T")

READ_CACHE_PREFIXES = (
    "dashboard:",
    "sources:",
    "postings:",
    "resumes:",
    "applications:",
    "cover-letter:",
    "source-crawl-info:",
)


@dataclass(slots=True)
class CacheEntry:
    value: object
    expires_at: float


class TTLMemoryCache:
    def __init__(self) -> None:
        self._entries: dict[str, CacheEntry] = {}
        self._lock = Lock()

    def get_or_set(self, key: str, ttl_seconds: int, loader: Callable[[], T]) -> T:
        now = monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry is not None and entry.expires_at > now:
                return cast(T, entry.value)

        value = loader()

        with self._lock:
            self._entries[key] = CacheEntry(
                value=value,
                expires_at=monotonic() + ttl_seconds,
            )

        return value

    def invalidate_prefixes(self, *prefixes: str) -> None:
        with self._lock:
            keys_to_delete = [
                key
                for key in self._entries
                if any(key.startswith(prefix) for prefix in prefixes)
            ]
            for key in keys_to_delete:
                self._entries.pop(key, None)


read_cache = TTLMemoryCache()


def make_cache_key(namespace: str, **parts: object) -> str:
    if not parts:
        return namespace

    suffix = "&".join(f"{key}={parts[key]!r}" for key in sorted(parts))
    return f"{namespace}{suffix}"


def get_read_cache_value(key: str, ttl_seconds: int, loader: Callable[[], T]) -> T:
    return read_cache.get_or_set(key, ttl_seconds, loader)


def invalidate_read_caches(*prefixes: str) -> None:
    read_cache.invalidate_prefixes(*(prefixes or READ_CACHE_PREFIXES))
