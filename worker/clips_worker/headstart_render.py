"""Non-blocking headstart preview render (must not stall the main picker/reframe path)."""
from __future__ import annotations

import os
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from collections.abc import Callable
from typing import Any


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


def prune_headstart_to_planned(
    head_render_state: dict[str, Any],
    planned_picks: list[dict],
    *,
    span_key: Callable[[int, int], tuple[int, int]],
    rendered_spans: set[tuple[int, int]],
    persisted_spans: set[tuple[int, int]] | None,
    span_lock: threading.Lock,
    project_id: str,
    conn=None,
) -> None:
    from clips_worker.clip_segments import spans_same_segment
    from clips_worker.storage import delete_object

    from clips_worker.decision_log import decision_log

    def _matches_planned(start_ms: int, end_ms: int) -> bool:
        for p in planned_picks:
            if spans_same_segment(
                int(p["start_ms"]),
                int(p["end_ms"]),
                start_ms,
                end_ms,
            ):
                return True
        return False

    by_span: dict[tuple[int, int], dict] = dict(head_render_state.get("by_span") or {})
    clip_ids = dict(head_render_state.get("clip_id_by_span") or {})
    drop: list[tuple[int, int]] = []
    for sk, row in by_span.items():
        s, e = int(row["startMs"]), int(row["endMs"])
        if not _matches_planned(s, e):
            drop.append(sk)

    for sk in drop:
        row = by_span.pop(sk, None)
        clip_id = clip_ids.pop(sk, None)
        with span_lock:
            rendered_spans.discard(sk)
            if persisted_spans is not None:
                persisted_spans.discard(sk)
        if not row:
            continue
        if clip_id and conn is not None:
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        'DELETE FROM clips WHERE id = %s AND "projectId" = %s',
                        (clip_id, project_id),
                    )
                conn.commit()
                decision_log(
                    "headstart",
                    "deleted_db_row",
                    project_id=project_id,
                    clip_id=clip_id,
                    span_start_ms=int(row.get("startMs") or sk[0]),
                    span_end_ms=int(row.get("endMs") or sk[1]),
                )
            except Exception as exc:
                decision_log(
                    "headstart",
                    "delete_db_row_failed",
                    project_id=project_id,
                    clip_id=clip_id,
                    error=str(exc)[:160],
                )
        decision_log(
            "headstart",
            "pruned_unplanned",
            project_id=project_id,
            span_start_ms=int(row.get("startMs") or sk[0]),
            span_end_ms=int(row.get("endMs") or sk[1]),
            storage_deleted=True,
            clip_id=clip_id,
        )
        for key_name in ("previewKey", "posterKey", "wordsKey", "cropKey"):
            storage_key = row.get(key_name)
            if storage_key:
                try:
                    delete_object(str(storage_key))
                except Exception:
                    pass

    for p in planned_picks:
        decision_log(
            "headstart",
            "kept_planned",
            project_id=project_id,
            start_ms=int(p["start_ms"]),
            end_ms=int(p["end_ms"]),
        )

    head_render_state["by_span"] = by_span
    head_render_state["clip_id_by_span"] = clip_ids
