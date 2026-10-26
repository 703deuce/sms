"""Keep long-running jobs alive by re-posting progress to refresh lockedAt."""
from __future__ import annotations

import logging
import threading
import time
from typing import Callable

log = logging.getLogger(__name__)


class Heartbeat:
    def __init__(
        self,
        job_id: str,
        post_progress: Callable[[str, dict], None],
        every_s: float = 45.0,
    ) -> None:
        self._job_id = job_id
        self._post = post_progress
        self._every_s = every_s
        self._stage = "running"
        self._progress = 0
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def update(self, stage: str | None = None, progress: int | None = None) -> None:
        if stage is not None:
            self._stage = stage
        if progress is not None:
            self._progress = progress

    def _tick(self) -> None:
        while not self._stop.wait(self._every_s):
            payload = {
                "stage": self._stage,
                "progress": self._progress,
                "jobStatus": "RUNNING",
            }
            try:
                self._post(self._job_id, payload)
            except Exception as exc:
                log.warning("heartbeat post failed job=%s: %s", self._job_id, exc)

    def __enter__(self) -> Heartbeat:
        self._thread = threading.Thread(target=self._tick, daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *args: object) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=self._every_s + 2)
