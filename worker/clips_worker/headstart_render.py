"""Non-blocking headstart preview render (must not stall the main picker/reframe path)."""
from __future__ import annotations

import os
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from typing import Callable


def headstart_render_timeout_sec() -> float:
    # Short wait: headstart is optional; reframe reuses async result instead of blocking 3 min.
    return max(5.0, float(os.environ.get("HEADSTART_RENDER_TIMEOUT_SEC", "45")))


def headstart_reframe_wait_sec() -> float:
    return max(30.0, float(os.environ.get("HEADSTART_REFRAME_WAIT_SEC", "600")))


def await_headstart_render(
    executor: ThreadPoolExecutor,
    future: Future | None,
    *,
    head_render_state: dict,
    rendered_spans: set[tuple[int, int]],
    persisted_spans: set[tuple[int, int]] | None = None,
    span_lock: threading.Lock,
    span_key: Callable[[int, int], tuple[int, int]],
    headstart_pick: dict | None,
    project_id: str,
    timeout_sec: float | None = None,
) -> None:
    """Wait briefly for optional headstart work; never block the pipeline for Modal cold start."""
    limit = timeout_sec if timeout_sec is not None else headstart_render_timeout_sec()
    from clips_worker.stage_log import future_result

    if future is not None:
        head_render_state["head_future"] = future
        try:
            future_result(
                future,
                "headstart_render",
                timeout=limit,
                project=project_id,
            )
        except FuturesTimeoutError:
            print(
                f"[clipper:speed] project={project_id} phase=headstart_render_timeout "
                f"after_sec={limit:.0f} continuing_async=1",
                flush=True,
            )
            # Do not release span or discard partial rows — reframe will await the same future.
        except Exception as exc:
            print(
                f"[clipper:speed] project={project_id} phase=headstart_render_future_failed "
                f"error={exc!s}"[:400],
                flush=True,
            )
            _release_headstart_span(
                head_render_state,
                rendered_spans,
                span_lock,
                span_key,
                headstart_pick,
                persisted_spans=persisted_spans,
            )
    # Let in-flight Modal work finish; do not cancel futures (that aborts GPU encode).
    executor.shutdown(wait=False, cancel_futures=False)


def wait_for_headstart_row(
    head_render_state: dict,
    span_key: Callable[[int, int], tuple[int, int]],
    pick: dict,
    *,
    project_id: str,
    timeout_sec: float | None = None,
) -> dict | None:
    """Block reframe only when reusing the same span as an in-flight headstart render."""
    sk = span_key(int(pick["start_ms"]), int(pick["end_ms"]))
    row = (head_render_state.get("by_span") or {}).get(sk)
    if row is not None:
        return row
    fut: Future | None = head_render_state.get("head_future")
    hs = head_render_state.get("headstart_pick")
    if fut is None or not hs:
        return None
    hsk = span_key(int(hs["start_ms"]), int(hs["end_ms"]))
    from clips_worker.clip_segments import spans_same_segment

    if not spans_same_segment(hsk[0], hsk[1], sk[0], sk[1]):
        return None
    limit = timeout_sec if timeout_sec is not None else headstart_reframe_wait_sec()
    try:
        fut.result(timeout=limit)
    except FuturesTimeoutError:
        print(
            f"[clipper:speed] project={project_id} phase=headstart_reframe_wait_timeout "
            f"after_sec={limit:.0f}",
            flush=True,
        )
        return (head_render_state.get("by_span") or {}).get(sk)
    except Exception:
        return None
    return (head_render_state.get("by_span") or {}).get(sk)


def _release_headstart_span(
    head_render_state: dict,
    rendered_spans: set[tuple[int, int]],
    span_lock: threading.Lock,
    span_key: Callable[[int, int], tuple[int, int]],
    pick: dict | None,
    *,
    persisted_spans: set[tuple[int, int]] | None = None,
) -> None:
    """Let the main reframe path claim and persist this span (hard headstart failure only)."""
    if not pick:
        return
    sk = span_key(int(pick["start_ms"]), int(pick["end_ms"]))
    with span_lock:
        rendered_spans.discard(sk)
        head_render_state.get("by_span", {}).pop(sk, None)
        if persisted_spans is not None:
            persisted_spans.discard(sk)
