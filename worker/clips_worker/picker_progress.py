"""FIX2 R2: keep 'finding clips' moving (progress + decaying etaSeconds) while the blocking picker runs."""
from __future__ import annotations

import math
import threading
import time
from typing import Any, Callable

from clips_worker.clip_progress import REFRAME_ETA_SEC_PER_CLIP, picker_progress_payload
from clips_worker.pipeline_eta import estimated_clip_count, picker_budget_s, upload_pipeline_eta_seconds

PICKER_TICK_S = 10.0
PICKER_OVERRUN_FLOOR_S = 15
PICKER_STAGE = "finding_clips"


def picker_eta_seconds(elapsed_s: float, source_s: float, render_concurrency: int) -> int:
    return upload_pipeline_eta_seconds(elapsed_s, source_s, render_concurrency)


def picker_tick_payload(elapsed_s: float, source_s: float, render_concurrency: int) -> dict:
    budget = picker_budget_s(source_s)
    progress = 52 + min(2, int(3 * max(0.0, elapsed_s) / budget))
    eta = picker_eta_seconds(elapsed_s, source_s, render_concurrency)
    return picker_progress_payload(PICKER_STAGE, progress, eta)


class PickerProgressTicker:
    """Context manager: posts picker_tick_payload every ``every_s`` from a daemon thread until exit."""

    def __init__(
        self,
        job_id: str,
        post_progress: Callable[[str, dict], Any],
        source_s: float,
        render_concurrency: int,
        every_s: float = PICKER_TICK_S,
    ) -> None:
        self._job_id = job_id
        self._post = post_progress
        self._source_s = float(source_s)
        self._conc = int(render_concurrency)
        self._every_s = float(every_s)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._t0 = 0.0

    def __enter__(self) -> "PickerProgressTicker":
        self._t0 = time.monotonic()
        self._thread = threading.Thread(target=self._run, name="picker-progress", daemon=True)
        self._thread.start()
        return self

    def _run(self) -> None:
        while not self._stop.wait(self._every_s):
            try:
                self._post(self._job_id, picker_tick_payload(time.monotonic() - self._t0, self._source_s, self._conc))
            except Exception as exc:  # progress is best-effort; never break the picker
                print(f"[picker_progress] post_failed err={type(exc).__name__}", flush=True)

    def __exit__(self, *_exc: object) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
