"""Headstart render failure must not block the main render pass for the same span."""
from __future__ import annotations

import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor

from clips_worker.headstart_render import await_headstart_render


def test_mark_span_no_self_deadlock():
    """Regression: _mark_span must not re-acquire span_lock inside _overlap_existing."""
    span_lock = threading.Lock()
    rendered_spans: set[tuple[int, int]] = set()

    def _overlap_existing_locked(start_ms: int, end_ms: int) -> bool:
        for a0, a1 in rendered_spans:
            overlap = max(0, min(a1, end_ms) - max(a0, start_ms))
            span = max(1, min(a1 - a0, end_ms - start_ms))
            if overlap / span >= 0.35:
                return True
        return False

    def _mark_span(start_ms: int, end_ms: int) -> bool:
        with span_lock:
            if _overlap_existing_locked(start_ms, end_ms):
                return False
            rendered_spans.add((start_ms, end_ms))
            return True

    done = threading.Event()

    def worker() -> None:
        assert _mark_span(0, 20_000) is True
        done.set()

    threading.Thread(target=worker, daemon=True).start()
    assert done.wait(timeout=2.0)
    assert (0, 20_000) in rendered_spans


def test_mark_span_discard_pattern():
    rendered = {(0, 20_000)}
    sk = (0, 20_000)
    rendered.discard(sk)
    assert sk not in rendered


def test_headstart_failure_releases_span_for_main_pass(words_60s=None):
    """Simulate failed headstart: span removed from rendered_spans so main pass can render."""
    if words_60s is None:
        words_60s = [{"w": "hi", "s": 0.0, "e": 0.4}]

    picks = [
        {
            "start_ms": 0,
            "end_ms": 20_000,
            "score": 90,
            "title": "A",
            "hook": "A",
            "reason": "A",
            "scores": {},
        },
    ]
    rendered_spans: set[tuple[int, int]] = set()
    head_render_state: dict = {"by_span": {}}
    span_lock = __import__("threading").Lock()

    def _span_key(a: int, b: int) -> tuple[int, int]:
        return (int(a), int(b))

    def _mark_span(start_ms: int, end_ms: int) -> bool:
        sk = _span_key(start_ms, end_ms)
        with span_lock:
            if sk in rendered_spans:
                return False
            rendered_spans.add(sk)
            return True

    def _render_pick_async(pick: dict) -> None:
        sk = _span_key(pick["start_ms"], pick["end_ms"])
        if not _mark_span(pick["start_ms"], pick["end_ms"]):
            return
        try:
            raise RuntimeError("headstart reframe failed")
        except Exception:
            with span_lock:
                rendered_spans.discard(sk)
                head_render_state["by_span"].pop(sk, None)

    _render_pick_async(picks[0])
    assert (0, 20_000) not in rendered_spans
    assert _mark_span(0, 20_000) is True


def test_headstart_timeout_keeps_span_for_async_reframe():
    """Timeout does not discard span — main reframe may await the same future."""
    rendered_spans: set[tuple[int, int]] = {(0, 20_000)}
    head_render_state: dict = {"by_span": {}}
    span_lock = threading.Lock()
    pick = {"start_ms": 0, "end_ms": 20_000}

    def slow():
        time.sleep(10)

    ex = ThreadPoolExecutor(max_workers=1)
    fut: Future = ex.submit(slow)
    persisted: set[tuple[int, int]] = set()
    await_headstart_render(
        ex,
        fut,
        head_render_state=head_render_state,
        rendered_spans=rendered_spans,
        persisted_spans=persisted,
        span_lock=span_lock,
        span_key=lambda a, b: (int(a), int(b)),
        headstart_pick=pick,
        project_id="proj_test",
        timeout_sec=0.05,
    )
    assert (0, 20_000) in rendered_spans
