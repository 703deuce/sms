"""Graceful shutdown: stop claiming jobs; finish or checkpoint the active job."""
from __future__ import annotations

import os
import signal
import threading

_drain = threading.Event()
_installed = False


def log(msg: str) -> None:
    print(msg, flush=True)


def drain_requested() -> bool:
    return _drain.is_set()


def request_drain(signum: int | None = None, frame: object | None = None) -> None:
    if not _drain.is_set():
        log(f"[clipper:worker] drain requested signal={signum}")
    _drain.set()


def install_drain_handlers() -> None:
    global _installed
    if _installed:
        return
    signal.signal(signal.SIGTERM, request_drain)
    signal.signal(signal.SIGINT, request_drain)
    _installed = True


def drain_timeout_sec() -> int:
    return max(30, int(os.environ.get("WORKER_DRAIN_TIMEOUT_SEC", "600")))


class WorkerDrainExit(Exception):
    """Raised when a safe picker checkpoint exists and the worker must exit for deploy."""
