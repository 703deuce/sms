"""Throttle high-frequency worker → web progress posts (yt-dlp emits many % lines)."""
from __future__ import annotations

import time
from typing import Callable


class ThrottledProgressPoster:
    def __init__(
        self,
        post: Callable[[str, dict], None],
        job_id: str,
        min_interval_s: float = 2.5,
        min_delta_pct: float = 1.0,
    ) -> None:
        self._post = post
        self._job_id = job_id
        self._min_interval = min_interval_s
        self._min_delta = min_delta_pct
        self._last_t = 0.0
        self._last_pct = -1.0

    def post(self, payload: dict, force: bool = False) -> None:
        progress = payload.get("progress")
        now = time.time()
        if not force and isinstance(progress, (int, float)):
            pct = float(progress)
            if (
                self._last_pct >= 0
                and pct - self._last_pct < self._min_delta
                and now - self._last_t < self._min_interval
                and pct < 99
            ):
                return
            self._last_pct = pct
        self._last_t = now
        self._post(self._job_id, payload)
