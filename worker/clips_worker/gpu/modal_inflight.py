"""Semaphore limiting concurrent Modal GPU calls (S15)."""
from __future__ import annotations

import os
import threading

_lock = threading.Lock()
_inflight = 0
_MAX = max(1, int(os.environ.get("STREAMER_MODAL_INFLIGHT") or 8))


class ModalInflight:
    def __enter__(self):
        global _inflight
        with _lock:
            while _inflight >= _MAX:
                _lock.release()
                threading.Event().wait(0.05)
                _lock.acquire()
            _inflight += 1
        return self

    def __exit__(self, *args):
        global _inflight
        with _lock:
            _inflight = max(0, _inflight - 1)


def modal_inflight_limit() -> int:
    return _MAX
