"""Modal/local GPU encode for clip previews and exports (filtergraph built on worker).

Encode quality: local fallback uses libx264 crf 20; Modal Renderer mirrors that (see modal_app/render.py).
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import time
import urllib.error
import uuid
from dataclasses import dataclass
from pathlib import Path

from clips_worker.gpu import get_provider, render_with_fallback
from clips_worker.gpu.base import RenderReq, RenderRes
from clips_worker.storage import download_object, sign_upload_url, sign_url, upload_file

log = logging.getLogger(__name__)

_modal_render_warm = False


def _gpu_render_print(payload: dict) -> None:
    print(f"[clipper:gpu_render] {json.dumps(payload)}", flush=True)
    clip_id = payload.get("clipId")
    if clip_id and payload.get("provider"):
        try:
            from clips_worker.job_telemetry import record_render_stats

            record_render_stats(str(clip_id), payload)
        except Exception:
            pass


def _gpu_render_warn(msg: str) -> None:
    print(f"[clipper:gpu_render] {msg}", flush=True)


def gpu_render_local_max_clip_s() -> float:
    return max(0.0, float(os.environ.get("GPU_RENDER_LOCAL_MAX_CLIP_S", "18")))


def _clip_src_duration_s(src_path: Path) -> float:
    try:
        from clips_worker.probe import probe_duration

        return float(probe_duration(src_path))
    except Exception:
        return 0.0


def _prefer_local_for_short_clip(prep: PreparedGpuRender) -> bool:
    limit = gpu_render_local_max_clip_s()
    if limit <= 0:
        return False
    dur = _clip_src_duration_s(prep.src_path)
    return dur > 0 and dur <= limit


def render_provider_enabled() -> bool:
    name = (os.environ.get("GPU_PROVIDER_RENDER") or "modal").strip().lower()
    return name == "modal" and os.environ.get("GPU_RENDER_DISABLED", "0") != "1"


def modal_render_chunk_size() -> int:
    return max(1, int(os.environ.get("MODAL_RENDER_CHUNK_SIZE", "4")))


def _scratch_src_key(workspace_id: str, project_id: str, clip_id: str) -> str:
    return f"ws/{workspace_id}/projects/{project_id}/scratch/render/{clip_id}/src_{uuid.uuid4().hex[:12]}.mp4"


def _scratch_out_key(workspace_id: str, project_id: str, clip_id: str) -> str:
    return f"ws/{workspace_id}/projects/{project_id}/scratch/render/{clip_id}/out_{uuid.uuid4().hex[:12]}.mp4"


def _error_summary(exc: BaseException) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        body_len = 0
        try:
            body_len = len(exc.read())
        except Exception:
            pass
        return f"HTTP {exc.code} {exc.reason or 'error'} body_bytes={body_len}"
    return f"{type(exc).__name__}: {str(exc)[:160]}"


def _upload_signed_put_url(object_key: str) -> str:
    signed = sign_upload_url(object_key)
    url = signed.get("url") or ""
    token = signed.get("token") or ""
    if not url:
        raise RuntimeError("sign_upload_url returned empty url")
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


def _ensure_src_uploaded(prep: PreparedGpuRender) -> str:
    if not prep.workspace_id or not prep.project_id:
        raise ValueError("workspace_id and project_id required for gpu render")
    src_key = prep.src_scratch_key or _scratch_src_key(prep.workspace_id, prep.project_id, prep.clip_id)
    if prep.src_scratch_key is None:
        upload_file(src_key, prep.src_path, "video/mp4")
        prep.src_scratch_key = src_key
    return src_key


def _prepare_modal_render_req(prep: PreparedGpuRender) -> RenderReq:
    src_key = _ensure_src_uploaded(prep)
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


def _render_local_ffmpeg(prep: PreparedGpuRender) -> bool:
    """Encode on worker disk (no Modal / no output PUT signing)."""
    from clips_worker.render_concurrency import ffmpeg_threads_per_job

    threads = str(ffmpeg_threads_per_job())
    prep.dest_path.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.perf_counter()
    try:
        vcodec = "libx264"
        extra: list[str] = ["-crf", "20", "-preset", "veryfast"]
        if prep.filter_complex:
            cmd = [
                "ffmpeg",
                "-y",
                "-threads",
                threads,
                "-v",
                "error",
                "-i",
                str(prep.src_path),
                "-filter_complex",
                prep.filtergraph or "",
                "-map",
                "[vfinal]",
                "-map",
                "0:a?",
                "-c:v",
                vcodec,
                *extra,
                "-c:a",
                "aac",
                "-movflags",
                "+faststart",
                str(prep.dest_path),
            ]
        else:
            vf = prep.filtergraph or "scale=720:1280"
            cmd = [
                "ffmpeg",
                "-y",
                "-threads",
                threads,
                "-v",
                "error",
                "-i",
                str(prep.src_path),
                "-vf",
                vf,
                "-c:v",
                vcodec,
                *extra,
                "-c:a",
                "aac",
                "-movflags",
                "+faststart",
                str(prep.dest_path),
            ]
        subprocess.check_call(cmd)
        ok = prep.dest_path.is_file() and prep.dest_path.stat().st_size > 0
        render_ms = (time.perf_counter() - t0) * 1000.0
        _gpu_render_print(
            {
                "clipId": prep.clip_id,
                "projectId": prep.project_id,
                "provider": "local",
                "ok": ok,
                "renderMs": round(render_ms, 1),
                "gpuSeconds": 0.0,
                "sizeBytes": prep.dest_path.stat().st_size if ok else 0,
                "filterComplex": prep.filter_complex,
                "fallback": True,
                "coldStart": False,
            }
        )
        return ok
    except Exception as exc:
        _gpu_render_warn(f"local_fallback_failed clipId={prep.clip_id} reason={_error_summary(exc)}")
        return False


def _apply_render_result(prep: PreparedGpuRender, res: RenderRes) -> bool:
    if not res.ok or not prep.out_scratch_key:
        return False
    download_object(prep.out_scratch_key, prep.dest_path)
    return prep.dest_path.is_file() and prep.dest_path.stat().st_size > 0


def _log_render_result(
    prep: PreparedGpuRender,
    res: RenderRes,
    *,
    fallback: bool = False,
    cold_start: bool | None = None,
) -> None:
    global _modal_render_warm
    render_ms = res.render_ms or 0.0
    if cold_start is None:
        cold_start = bool(res.cold_start) or (res.provider == "modal" and not _modal_render_warm)
    if res.provider == "modal" and res.ok:
        _modal_render_warm = True
    payload: dict[str, object] = {
        "clipId": prep.clip_id,
        "projectId": prep.project_id,
        "provider": res.provider,
        "ok": res.ok,
        "renderMs": round(render_ms, 1),
        "gpuSeconds": round(res.gpu_seconds, 3),
        "sizeBytes": res.size_bytes,
        "filterComplex": prep.filter_complex,
        "coldStart": bool(cold_start),
    }
    if fallback:
        payload["fallback"] = True
    _gpu_render_print(payload)


def render_one_via_provider(
    conn,
    prep: PreparedGpuRender,
) -> bool:
    """Encode one clip; returns True when dest_path is written."""
    if not render_provider_enabled():
        return _render_local_ffmpeg(prep)

    if _prefer_local_for_short_clip(prep):
        _gpu_render_print(
            {
                "clipId": prep.clip_id,
                "projectId": prep.project_id,
                "provider": "local",
                "reason": "short_clip",
                "maxModalClipS": gpu_render_local_max_clip_s(),
                "clipDurationS": round(_clip_src_duration_s(prep.src_path), 2),
            }
        )
        return _render_local_ffmpeg(prep)

    modal_req: RenderReq | None = None
    try:
        modal_req = _prepare_modal_render_req(prep)
    except Exception as exc:
        _gpu_render_warn(f"modal_prepare_failed clipId={prep.clip_id} reason={_error_summary(exc)}")
        return _render_local_ffmpeg(prep)

    t0 = time.perf_counter()
    try:
        results = render_with_fallback(conn, [modal_req], prep.workspace_id, prep.project_id)
    except Exception as exc:
        _gpu_render_warn(f"modal_render_failed clipId={prep.clip_id} reason={_error_summary(exc)}")
        return _render_local_ffmpeg(prep)

    if not results:
        return _render_local_ffmpeg(prep)
    res = results[0]
    if not res.render_ms:
        res.render_ms = (time.perf_counter() - t0) * 1000.0
    _log_render_result(prep, res)
    if res.ok and _apply_render_result(prep, res):
        return True
    _gpu_render_warn(
        f"modal_result_not_ok clipId={prep.clip_id} provider={res.provider} ok={res.ok}"
    )
    return _render_local_ffmpeg(prep)


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
        reqs: list[RenderReq] = []
        modal_preps: list[PreparedGpuRender] = []
        for prep in batch:
            if _prefer_local_for_short_clip(prep):
                out[prep.clip_id] = _render_local_ffmpeg(prep)
                continue
            try:
                reqs.append(_prepare_modal_render_req(prep))
                modal_preps.append(prep)
            except Exception as exc:
                _gpu_render_warn(
                    f"modal_prepare_failed clipId={prep.clip_id} reason={_error_summary(exc)}"
                )
                out[prep.clip_id] = _render_local_ffmpeg(prep)

        if not reqs:
            continue

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
            _gpu_render_warn(f"render_batch_failed chunk={len(reqs)} reason={_error_summary(exc)}")
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
                        batch=len(reqs) > 1,
                    )
        for prep, res in zip(modal_preps, results, strict=False):
            if not res.render_ms:
                res.render_ms = wall_ms / max(1, len(results))
            _log_render_result(prep, res)
            ok = _apply_render_result(prep, res)
            if not ok:
                ok = _render_local_ffmpeg(prep)
            out[prep.clip_id] = ok
    return out
