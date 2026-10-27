"""Non-blocking headstart preview render (must not stall the main picker/reframe path)."""
from __future__ import annotations

import os
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from typing import Callable


def headstart_render_timeout_sec() -> float:
    return max(30.0, float(os.environ.get("HEADSTART_RENDER_TIMEOUT_SEC", "180")))


def await_headstart_render(
    executor: ThreadPoolExecutor,
    future: Future | None,
    *,
    head_render_state: dict,
    rendered_spans: set[tuple[int, int]],
    span_lock: threading.Lock,
    span_key: Callable[[int, int], tuple[int, int]],
    headstart_pick: dict | None,
    project_id: str,
    timeout_sec: float | None = None,
) -> None:
    """Wait up to timeout for optional headstart work; never block the pipeline indefinitely."""
    limit = timeout_sec if timeout_sec is not None else headstart_render_timeout_sec()
    if future is not None:
        try:
            future.result(timeout=limit)
        except FuturesTimeoutError:
            print(
                f"[clipper:speed] project={project_id} phase=headstart_render_timeout "
                f"after_sec={limit:.0f}",
                flush=True,
            )
            _release_headstart_span(head_render_state, rendered_spans, span_lock, span_key, headstart_pick)
        except Exception as exc:
            print(
                f"[clipper:speed] project={project_id} phase=headstart_render_future_failed "
                f"error={exc!s}"[:400],
                flush=True,
            )
            _release_headstart_span(head_render_state, rendered_spans, span_lock, span_key, headstart_pick)
    executor.shutdown(wait=False, cancel_futures=True)


def _release_headstart_span(
    head_render_state: dict,
    rendered_spans: set[tuple[int, int]],
    span_lock: threading.Lock,
    span_key: Callable[[int, int], tuple[int, int]],
    pick: dict | None,
) -> None:
    if not pick:
        return
    sk = span_key(int(pick["start_ms"]), int(pick["end_ms"]))
    with span_lock:
        rendered_spans.discard(sk)
        head_render_state.get("by_span", {}).pop(sk, None)
