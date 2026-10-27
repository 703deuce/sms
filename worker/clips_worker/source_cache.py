"""Persistent on-disk cache for S3/B2 objects — cuts egress on repeat downloads."""
from __future__ import annotations

import fcntl
import hashlib
import json
import logging
import os
import shutil
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

log = logging.getLogger(__name__)

_INDEX_NAME = "index.json"
_LOCK_NAME = ".lock"


def _cache_root() -> Path:
    return Path(os.environ.get("CLIPS_SOURCE_CACHE_DIR", "/opt/clips-worker/cache"))


def _max_bytes() -> int:
    gb = float(os.environ.get("CLIPS_SOURCE_CACHE_MAX_GB", "40"))
    if gb <= 0:
        return 0
    return int(gb * (1024**3))


def _disk_max_pct() -> int:
    return int(os.environ.get("CLIPS_SOURCE_CACHE_DISK_MAX_PCT", "80"))


def _enabled() -> bool:
    return _max_bytes() > 0


def _entry_id(object_key: str, etag: str, size: int) -> str:
    raw = f"{object_key}\0{etag}\0{size}".encode("utf-8", errors="replace")
    return hashlib.sha256(raw).hexdigest()[:32]


@dataclass
class CacheFetchResult:
    cache_hit: bool
    egress_bytes: int


class SourceCache:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.objects_dir = root / "objects"
        self.objects_dir.mkdir(parents=True, exist_ok=True)
        self._index_path = root / _INDEX_NAME
        self._index: dict[str, dict] = {}
        self._index_lock = threading.Lock()
        self._key_locks: dict[str, threading.Lock] = {}
        self._key_locks_guard = threading.Lock()
        self._load_index()

    def _load_index(self) -> None:
        if not self._index_path.exists():
            self._index = {}
            return
        try:
            self._index = json.loads(self._index_path.read_text())
        except Exception:
            self._index = {}

    def _save_index(self) -> None:
        tmp = self._index_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._index, separators=(",", ":")))
        tmp.replace(self._index_path)

    def _lock_for(self, entry_id: str) -> threading.Lock:
        with self._key_locks_guard:
            if entry_id not in self._key_locks:
                self._key_locks[entry_id] = threading.Lock()
            return self._key_locks[entry_id]

    def _file_lock(self) -> int:
        lock_path = self.root / _LOCK_NAME
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(str(lock_path), os.O_CREAT | os.O_RDWR)
        fcntl.flock(fd, fcntl.LOCK_EX)
        return fd

    def _unlock(self, fd: int) -> None:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)

    def _cached_path(self, entry_id: str) -> Path:
        return self.objects_dir / entry_id

    def _touch(self, entry_id: str) -> None:
        with self._index_lock:
            row = self._index.get(entry_id)
            if row:
                row["atime"] = time.time()
                self._save_index()

    def _total_cached_bytes(self) -> int:
        return sum(int(v.get("size") or 0) for v in self._index.values())

    def _disk_used_pct(self) -> float:
        try:
            return float(shutil.disk_usage(self.root).used) / float(shutil.disk_usage(self.root).total) * 100.0
        except Exception:
            return 0.0

    def _evict_if_needed(self, incoming_bytes: int) -> None:
        max_b = _max_bytes()
        if max_b <= 0:
            return
        target = max_b - incoming_bytes
        with self._index_lock:
            while self._index and (
                self._total_cached_bytes() + incoming_bytes > max_b or self._disk_used_pct() >= _disk_max_pct()
            ):
                victim = min(self._index.items(), key=lambda kv: float(kv[1].get("atime") or 0))[0]
                path = self._cached_path(victim)
                path.unlink(missing_ok=True)
                del self._index[victim]
                if self._total_cached_bytes() <= target and self._disk_used_pct() < _disk_max_pct():
                    break
            self._save_index()

    def seed(self, object_key: str, etag: str, size: int, local_path: Path) -> None:
        if not _enabled() or not local_path.is_file():
            return
        entry_id = _entry_id(object_key, etag, size)
        dest = self._cached_path(entry_id)
        with self._lock_for(entry_id):
            fd = self._file_lock()
            try:
                self._evict_if_needed(local_path.stat().st_size)
                tmp = dest.with_suffix(".part")
                shutil.copy2(local_path, tmp)
                os.replace(tmp, dest)
                with self._index_lock:
                    self._index[entry_id] = {
                        "key": object_key,
                        "etag": etag,
                        "size": size,
                        "atime": time.time(),
                    }
                    self._save_index()
            finally:
                self._unlock(fd)

    def fetch(
        self,
        object_key: str,
        etag: str,
        size: int,
        dest: Path,
        download_fn: Callable[[Path], None],
    ) -> CacheFetchResult:
        if not _enabled():
            download_fn(dest)
            nbytes = dest.stat().st_size if dest.is_file() else size
            _log_egress(object_key, False, nbytes)
            return CacheFetchResult(cache_hit=False, egress_bytes=nbytes)

        entry_id = _entry_id(object_key, etag, size)
        cached = self._cached_path(entry_id)
        dest.parent.mkdir(parents=True, exist_ok=True)

        with self._lock_for(entry_id):
            fd = self._file_lock()
            try:
                if cached.is_file() and cached.stat().st_size == size:
                    shutil.copy2(cached, dest)
                    self._touch(entry_id)
                    _log_egress(object_key, True, 0)
                    return CacheFetchResult(cache_hit=True, egress_bytes=0)

                self._evict_if_needed(size)
                tmp = cached.with_suffix(".part")
                download_fn(tmp)
                if not tmp.is_file():
                    raise RuntimeError("cache download missing temp file")
                os.replace(tmp, cached)
                file_size = cached.stat().st_size
                with self._index_lock:
                    self._index[entry_id] = {
                        "key": object_key,
                        "etag": etag,
                        "size": file_size,
                        "atime": time.time(),
                    }
                    self._save_index()
                shutil.copy2(cached, dest)
                _log_egress(object_key, False, size)
                return CacheFetchResult(cache_hit=False, egress_bytes=size)
            finally:
                self._unlock(fd)


def _log_egress(object_key: str, cache_hit: bool, egress_bytes: int) -> None:
    msg = (
        f"WARN storage.b2_get object_key={object_key} cache_hit={cache_hit} "
        f"egress_bytes={egress_bytes}"
    )
    print(msg, file=sys.stderr, flush=True)
    log.warning("%s", msg)


_cache: SourceCache | None = None
_cache_guard = threading.Lock()


def get_source_cache() -> SourceCache:
    global _cache
    with _cache_guard:
        if _cache is None:
            _cache = SourceCache(_cache_root())
        return _cache
