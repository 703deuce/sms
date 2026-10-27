"""Source cache: hit, miss, eviction, concurrent same-key."""
from __future__ import annotations

import threading
from pathlib import Path

import pytest

from clips_worker.source_cache import SourceCache, _entry_id


@pytest.fixture
def cache(tmp_path, monkeypatch):
    monkeypatch.setenv("CLIPS_SOURCE_CACHE_MAX_GB", "0.001")  # ~1 MB
    monkeypatch.setenv("CLIPS_SOURCE_CACHE_DISK_MAX_PCT", "99")
    root = tmp_path / "cache"
    return SourceCache(root)


def test_cache_hit_after_seed(cache, tmp_path):
    src = tmp_path / "src.bin"
    src.write_bytes(b"x" * 100)
    dest = tmp_path / "out.bin"
    key, etag, size = "ws/a/video.mp4", "abc", 100
    cache.seed(key, etag, size, src)

    def boom(_p: Path) -> None:
        raise RuntimeError("should not download")

    res = cache.fetch(key, etag, size, dest, boom)
    assert res.cache_hit is True
    assert res.egress_bytes == 0
    assert dest.read_bytes() == b"x" * 100


def test_cache_miss_downloads_once(cache, tmp_path):
    dest = tmp_path / "out.bin"
    key, etag, size = "ws/b/preview.mp4", "v1", 50
    calls = {"n": 0}

    def dl(p: Path) -> None:
        calls["n"] += 1
        p.write_bytes(b"y" * size)

    res = cache.fetch(key, etag, size, dest, dl)
    assert res.cache_hit is False
    assert res.egress_bytes == 50
    assert calls["n"] == 1

    dest2 = tmp_path / "out2.bin"
    res2 = cache.fetch(key, etag, size, dest2, dl)
    assert res2.cache_hit is True
    assert calls["n"] == 1


def test_eviction_drops_lru(cache, tmp_path):
    for i in range(3):
        p = tmp_path / f"f{i}.bin"
        p.write_bytes(bytes([i]) * 400_000)
        cache.seed(f"k{i}", f"e{i}", 400_000, p)
    assert len(cache._index) <= 2


def test_concurrent_same_key_single_download(cache, tmp_path):
    key, etag, size = "ws/c/big.mp4", "e", 80
    calls = {"n": 0}
    lock = threading.Lock()
    started = threading.Event()

    def dl(p: Path) -> None:
        with lock:
            calls["n"] += 1
            started.set()
        import time

        time.sleep(0.15)
        p.write_bytes(b"z" * size)

    def worker(dest: Path) -> None:
        cache.fetch(key, etag, size, dest, dl)

    d1, d2 = tmp_path / "a.bin", tmp_path / "b.bin"
    t1 = threading.Thread(target=worker, args=(d1,))
    t2 = threading.Thread(target=worker, args=(d2,))
    t1.start()
    started.wait(timeout=2)
    t2.start()
    t1.join(timeout=5)
    t2.join(timeout=5)
    assert calls["n"] == 1
    assert d1.read_bytes() == d2.read_bytes()


def test_entry_id_changes_with_etag():
    a = _entry_id("k", "e1", 10)
    b = _entry_id("k", "e2", 10)
    assert a != b
