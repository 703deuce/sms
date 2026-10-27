from __future__ import annotations

import logging
import os
from typing import Literal

from clips_worker.gpu.base import GpuProvider, RenderReq, RenderRes, TranscribeReq, TranscribeRes
from clips_worker.gpu.budget import allow as budget_allow
from clips_worker.gpu.local import LocalProvider

log = logging.getLogger(__name__)

Op = Literal["transcribe", "face", "render"]


def _provider_name(op: Op) -> str:
    override = os.environ.get(f"GPU_PROVIDER_{op.upper()}")
    if override:
        return override.strip().lower()
    if op == "render":
        return "modal"
    return (os.environ.get("GPU_PROVIDER") or "local").strip().lower()


def get_provider(op: Op, conn=None) -> GpuProvider:
    name = _provider_name(op)
    if name == "runpod":
        raise NotImplementedError("runpod provider not built yet")
    if name == "modal":
        from clips_worker.gpu.modal_provider import ModalProvider

        return ModalProvider()
    if name == "local":
        return LocalProvider()
    raise ValueError(f"unknown GPU provider: {name}")


def transcribe_with_fallback(
    conn,
    req: TranscribeReq,
    workspace_id: str,
    project_id: str,
) -> TranscribeRes:
    """Transcribe using configured provider; optional local fallback."""
    fallback = os.environ.get("GPU_FALLBACK_LOCAL", "1") != "0"
    name = _provider_name("transcribe")
    if name == "modal" and not budget_allow(conn):
        log.warning("gpu.fallback op=transcribe reason=budget")
        name = "local"
    if name == "local":
        res = LocalProvider().transcribe(req)
        res.transcription_engine = "local_whisper"
        return res
    try:
        provider = get_provider("transcribe", conn)
        res = provider.transcribe(req)
        if res.provider == "modal" and conn is not None:
            from clips_worker.gpu.usage import record_modal_transcribe

            record_modal_transcribe(conn, workspace_id, project_id, res.gpu_seconds)
        return res
    except Exception as exc:
        if not fallback:
            raise
        log.warning("gpu.fallback op=transcribe reason=%s", exc)
        res = LocalProvider().transcribe(req)
        res.transcription_engine = "local_whisper"
        res.fallback_reason = str(exc)
        return res


def render_with_fallback(
    conn,
    reqs: list[RenderReq],
    workspace_id: str,
    project_id: str,
) -> list[RenderRes]:
    """Render clips via configured provider; per-item local ffmpeg fallback on error or budget block."""
    if not reqs:
        return []
    fallback = os.environ.get("GPU_FALLBACK_LOCAL", "1") != "0"
    name = _provider_name("render")
    if name == "modal" and not budget_allow(conn):
        log.warning("gpu.fallback op=render reason=budget clips=%s", len(reqs))
        name = "local"
    if name == "local":
        return LocalProvider().render_batch(reqs)

    try:
        provider = get_provider("render", conn)
        results = provider.render_batch(reqs)
        if conn is not None:
            from clips_worker.gpu.usage import record_modal_render

            for res in results:
                if res.provider == "modal" and res.ok:
                    record_modal_render(
                        conn,
                        workspace_id,
                        project_id,
                        res.gpu_seconds,
                        batch=len(reqs) > 1,
                    )
        return results
    except Exception as exc:
        if not fallback:
            raise
        log.warning("gpu.fallback op=render reason=%s clips=%s", exc, len(reqs))
        out = LocalProvider().render_batch(reqs)
        for r in out:
            r.provider = "local"
        return out
