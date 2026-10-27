"""Modal/local GPU encode for clip previews and exports (filtergraph built on worker).

Encode quality: local fallback uses libx264 crf 20; Modal Renderer mirrors that (see modal_app/render.py).
"""
from __future__ import annotations

import json
import logging
import os
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from clips_worker.gpu import get_provider, render_with_fallback
from clips_worker.gpu.base import RenderReq, RenderRes
from clips_worker.storage import download_object, sign_upload_url, sign_url, upload_file

log = logging.getLogger(__name__)


def render_provider_enabled() -> bool:
    name = (os.environ.get("GPU_PROVIDER_RENDER") or "modal").strip().lower()
    return name == "modal" and os.environ.get("GPU_RENDER_DISABLED", "0") != "1"


def modal_render_chunk_size() -> int:
    return max(1, int(os.environ.get("MODAL_RENDER_CHUNK_SIZE", "4")))


def _scratch_src_key(workspace_id: str, project_id: str, clip_id: str) -> str:
    return f"ws/{workspace_id}/projects/{project_id}/scratch/render/{clip_id}/src_{uuid.uuid4().hex[:12]}.mp4"


def _scratch_out_key(workspace_id: str, project_id: str, clip_id: str) -> str:
    return f"ws/{workspace_id}/projects/{project_id}/scratch/render/{clip_id}/out_{uuid.uuid4().hex[:12]}.mp4"


def _upload_signed_put_url(object_key: str) -> str:
    signed = sign_upload_url(object_key)
    url = signed.get("url") or ""
    token = signed.get("token") or ""
    if token and "token=" not in url:
        sep = "&" if "?" in url else "?"
        return f"{url}{sep}token={token}"
    return url


@dataclass
class PreparedGpuRender:
    clip_id: str
    src_path: Path
    dest_path: Path
    filtergraph: str
    filter_complex: bool = False
    workspace_id: str = ""
    project_id: str = ""
    src_scratch_key: str | None = None
    out_scratch_key: str | None = None


def _prepare_render_req(prep: PreparedGpuRender) -> RenderReq:
    if not prep.workspace_id or not prep.project_id:
        raise ValueError("workspace_id and project_id required for gpu render")
    src_key = prep.src_scratch_key or _scratch_src_key(prep.workspace_id, prep.project_id, prep.clip_id)
    if prep.src_scratch_key is None:
        upload_file(src_key, prep.src_path, "video/mp4")
        prep.src_scratch_key = src_key
    out_key = prep.out_scratch_key or _scratch_out_key(prep.workspace_id, prep.project_id, prep.clip_id)
    prep.out_scratch_key = out_key
    return RenderReq(
        segment_url=sign_url(src_key, expires_s=7200),
        filtergraph=prep.filtergraph,
        filter_complex=prep.filter_complex,
        out_upload_url=_upload_signed_put_url(out_key),
        encoder="h264_nvenc",
        clip_id=prep.clip_id,
    )


def _apply_render_result(prep: PreparedGpuRender, res: RenderRes) -> bool:
    if not res.ok or not prep.out_scratch_key:
        return False
    download_object(prep.out_scratch_key, prep.dest_path)
    return prep.dest_path.is_file() and prep.dest_path.stat().st_size > 0


def _log_render_result(prep: PreparedGpuRender, res: RenderRes) -> None:
    render_ms = res.render_ms or 0.0
    log.info(
        "[clipper:gpu_render] %s",
        json.dumps(
            {
                "clipId": prep.clip_id,
                "projectId": prep.project_id,
                "provider": res.provider,
                "ok": res.ok,
                "renderMs": round(render_ms, 1),
                "gpuSeconds": round(res.gpu_seconds, 3),
                "sizeBytes": res.size_bytes,
                "filterComplex": prep.filter_complex,
            }
        ),
    )


def render_one_via_provider(
    conn,
    prep: PreparedGpuRender,
) -> bool:
    """Encode one clip; returns True when dest_path is written."""
    if not render_provider_enabled():
        return False
    t0 = time.perf_counter()
    req = _prepare_render_req(prep)
    results = render_with_fallback(conn, [req], prep.workspace_id, prep.project_id)
    if not results:
        return False
    res = results[0]
    if not res.render_ms:
        res.render_ms = (time.perf_counter() - t0) * 1000.0
    _log_render_result(prep, res)
    return _apply_render_result(prep, res)


def render_batch_via_provider(
    conn,
    preps: list[PreparedGpuRender],
) -> dict[str, bool]:
    """Encode many clips (Modal parallel map inside each chunk). Returns clip_id -> ok."""
    out: dict[str, bool] = {}
    if not preps or not render_provider_enabled():
        return {p.clip_id: False for p in preps}
    ws = preps[0].workspace_id
    proj = preps[0].project_id
    chunk = modal_render_chunk_size()
    for i in range(0, len(preps), chunk):
        batch = preps[i : i + chunk]
        reqs = [_prepare_render_req(p) for p in batch]
        t0 = time.perf_counter()
        try:
            provider = get_provider("render", conn)
            if provider.name == "modal":
                from clips_worker.gpu.modal_inflight import ModalInflight

                with ModalInflight():
                    results = provider.render_batch(reqs)
            else:
                results = render_with_fallback(conn, reqs, ws, proj)
        except Exception as exc:
            log.warning("gpu.render_batch failed chunk=%s error=%s", len(batch), exc)
            results = render_with_fallback(conn, reqs, ws, proj)
        wall_ms = (time.perf_counter() - t0) * 1000.0
        if conn is not None and results:
            from clips_worker.gpu.usage import record_modal_render

            for res in results:
                if res.provider == "modal" and res.ok:
                    record_modal_render(
                        conn,
                        ws,
                        proj,
                        res.gpu_seconds,
                        batch=len(batch) > 1,
                    )
        for prep, res in zip(batch, results, strict=False):
            if not res.render_ms:
                res.render_ms = wall_ms / max(1, len(batch))
            _log_render_result(prep, res)
            out[prep.clip_id] = _apply_render_result(prep, res)
    return out
