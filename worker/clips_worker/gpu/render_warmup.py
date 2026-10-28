"""Keep Modal Renderer hot for the duration of a clip job."""
from __future__ import annotations

import json
import os
import threading
import time

_warm_lock = threading.Lock()
_warm_until_mono = 0.0
_warm_thread: threading.Thread | None = None

APP_NAME = os.environ.get("MODAL_APP_NAME", "transovo-gpu")


def modal_keep_warm_sec() -> float:
    return max(60.0, float(os.environ.get("MODAL_RENDER_KEEP_WARM_SEC", "900")))


def schedule_modal_warmup_background() -> None:
    """Start Modal ping on a daemon thread so picker/transcribe are not blocked."""
    global _warm_thread

    from clips_worker.gpu_encode import render_provider_enabled

    if not render_provider_enabled():
        return
    now = time.monotonic()
    with _warm_lock:
        if now < _warm_until_mono:
            return
        if _warm_thread is not None and _warm_thread.is_alive():
            return

    def _run() -> None:
        warm_modal_renderer_if_needed(None)

    _warm_thread = threading.Thread(target=_run, name="modal-gpu-warmup", daemon=True)
    _warm_thread.start()
    print(
        f"[clipper:gpu_render] {json.dumps({'event': 'warmup_scheduled', 'provider': 'modal'})}",
        flush=True,
    )


def warm_modal_renderer_if_needed(conn) -> None:
    from clips_worker.gpu_encode import render_provider_enabled

    global _warm_until_mono

    if not render_provider_enabled():
        return
    now = time.monotonic()
    with _warm_lock:
        if now < _warm_until_mono:
            return
    t0 = time.perf_counter()
    try:
        import modal

        Cls = modal.Cls.from_name(APP_NAME, "Renderer")
        raw = Cls().ping.remote()
        ms = (time.perf_counter() - t0) * 1000.0
        payload = {
            "event": "warmup",
            "provider": "modal",
            "ok": bool(raw.get("ok")),
            "renderMs": round(ms, 1),
            "coldStart": bool(raw.get("cold_start")),
        }
        print(f"[clipper:gpu_render] {json.dumps(payload)}", flush=True)
        with _warm_lock:
            _warm_until_mono = time.monotonic() + modal_keep_warm_sec()
    except Exception as exc:
        print(
            f"[clipper:gpu_render] {json.dumps({'event': 'warmup_failed', 'provider': 'modal', 'error': str(exc)[:200]})}",
            flush=True,
        )
