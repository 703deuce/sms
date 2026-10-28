"""Parallel per-chunk Gemini video watch for STREAM_ANALYZE."""
from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from clips_worker.storage import download_object
from clips_worker.streamer.audio_first_ingest import ingest_clip_section_video
from clips_worker.video_picker import (
    attach_absolute_ms,
    make_watch_proxy,
    merge_stream_moments,
    moments_to_per_second,
    video_picker_enabled,
    video_picker_stream_overlap_s,
    watch_video_file,
)
from clips_worker.video_picker_cache import load_video_picker_cache, save_video_picker_cache


def _resolve_base_video(
    *,
    state: dict,
    scratch: Path,
) -> tuple[Path | None, bool]:
    """Return (path, times_are_absolute_in_file)."""
    if state.get("localUploadKey") and not state.get("analysisProxyKey"):
        dest = scratch / "video_picker_base.mp4"
        download_object(str(state["localUploadKey"]), dest)
        return dest, True
    for key_name in ("analysisProxyKey", "localUploadKey"):
        storage_key = state.get(key_name)
        if storage_key:
            dest = scratch / "video_picker_base.mp4"
            download_object(str(storage_key), dest)
            return dest, False
    return None, False


def stream_chunk_video_signals(
    *,
    vod: dict,
    state: dict,
    ranges: list[tuple[int, int]],
    scratch: Path,
    job_id: str,
    target_clip_len_s: int | None = None,
    transcript_text: str = "",
) -> tuple[list[float] | None, list[dict], dict[str, Any]]:
    """Returns slice-relative 1Hz video curve, flat moments (vod-relative ms), aggregate cost meta."""
    empty_meta: dict[str, Any] = {"chunks": 0, "ok_chunks": 0, "est_usd": 0.0, "vp_calls": 0}
    if not video_picker_enabled() or not ranges:
        return None, [], empty_meta
    workspace_id = str(vod.get("workspaceId") or vod.get("workspace_id") or "")
    vod_id = str(vod.get("id") or "vod")
    duration_ms = max(r[1] for r in ranges) if ranges else int(vod.get("durationMs") or 0)
    duration_s = max(1, duration_ms // 1000)
    url = vod.get("url")
    base, base_absolute = _resolve_base_video(state=state, scratch=scratch)
    vod_start_ms = int(vod.get("rangeStartMs") or 0)
    workers = max(1, min(4, int(os.environ.get("VIDEO_PICKER_CHUNK_CONCURRENCY", "3"))))
    chunk_dir = scratch / "video_picker_chunks"
    chunk_dir.mkdir(parents=True, exist_ok=True)
    overlap_s = video_picker_stream_overlap_s()
    vp_calls = 0

    def _one(idx: int, start_ms: int, end_ms: int) -> tuple[int, list[dict], list[float], dict]:
        nonlocal vp_calls
        cached = load_video_picker_cache(workspace_id, vod_id, start_ms, end_ms)
        if cached:
            moments = list(cached.get("moments") or [])
            curve = list(cached.get("curve") or [])
            meta = dict(cached.get("meta") or {})
            meta["cache_hit"] = True
            return idx, moments, curve, meta

        rel_start_s = start_ms / 1000.0
        rel_end_s = end_ms / 1000.0
        chunk_s = max(1, int(rel_end_s - rel_start_s))
        abs_start_s = (vod_start_ms + start_ms) / 1000.0
        abs_end_s = (vod_start_ms + end_ms) / 1000.0
        proxy = chunk_dir / f"chunk_{idx}.mp4"
        proxy_t0 = time.time()
        if base is not None and base.is_file():
            if base_absolute:
                make_watch_proxy(base, proxy, abs_start_s, abs_end_s)
            else:
                make_watch_proxy(base, proxy, rel_start_s, rel_end_s)
        elif url:
            ingest_clip_section_video(
                str(url),
                proxy,
                purpose="analysis",
                job_id=job_id,
                vod_id=vod_id,
                clip_id=f"vp_{idx}",
                start_s=abs_start_s,
                end_s=abs_end_s,
            )
        else:
            return idx, [], [0.0], {"ok": False, "error": "no_video_source"}
        upload_ms = int((time.time() - proxy_t0) * 1000)
        trim_lo_s = abs_start_s if base_absolute else rel_start_s
        trim_hi_s = abs_end_s if base_absolute else rel_end_s
        vp_calls += 1
        moments, meta = watch_video_file(
            proxy,
            duration_s=chunk_s,
            chunk_label=f"stream_{idx}",
            target_clip_len_s=target_clip_len_s,
            transcript_text=transcript_text,
            source_video=base,
            scratch=chunk_dir,
            trim_start_s=trim_lo_s,
            trim_end_s=trim_hi_s,
            use_labeled_frames=False,
        )
        meta["upload_ms"] = upload_ms
        for m in moments:
            for key in ("start_s", "end_s", "peak_s", "hook_s", "t_s"):
                try:
                    m[key] = float(m.get(key) or 0) + rel_start_s
                except (TypeError, ValueError):
                    pass
        curve = moments_to_per_second(
            [
                {
                    **m,
                    "start_s": float(m.get("start_s", 0)) - rel_start_s,
                    "end_s": float(m.get("end_s", 0)) - rel_start_s,
                    "peak_s": float(m.get("peak_s", 0)) - rel_start_s,
                    "score": m.get("score"),
                }
                for m in moments
            ],
            chunk_s,
        )
        if meta.get("ok"):
            save_video_picker_cache(
                workspace_id,
                vod_id,
                start_ms,
                end_ms,
                moments=moments,
                curve=curve,
                meta=meta,
            )
        return idx, moments, curve, meta

    merged = [0.0] * duration_s
    all_moments: list[dict] = []
    total_usd = 0.0
    ok_chunks = 0
    total_gen_ms = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [pool.submit(_one, i, s, e) for i, (s, e) in enumerate(ranges)]
        for fut in as_completed(futs):
            try:
                idx, moments, curve, meta = fut.result()
            except Exception as exc:
                from clips_worker.picker.picker_errors import log_picker_error

                log_picker_error("gemini", str(exc)[:300], None)
                continue
            if meta.get("ok"):
                ok_chunks += 1
            total_usd += float(meta.get("est_usd") or 0)
            total_gen_ms += int(meta.get("gen_ms") or 0)
            start_ms = ranges[idx][0]
            off = start_ms // 1000
            all_moments.extend(moments)
            for i, val in enumerate(curve):
                ti = off + i
                if 0 <= ti < duration_s:
                    merged[ti] = max(merged[ti], float(val))
    all_moments = merge_stream_moments(all_moments, overlap_s)
    vod_range_start_ms = vod_start_ms
    attach_absolute_ms(all_moments, vod_range_start_ms)
    agg = {
        "chunks": len(ranges),
        "ok_chunks": ok_chunks,
        "est_usd": round(total_usd, 6),
        "vp_calls": vp_calls,
        "gen_ms": total_gen_ms,
    }
    print(
        f"[clipper:vp] calls={vp_calls} model=stream chunks={len(ranges)} "
        f"gen_ms={total_gen_ms} ok={ok_chunks}",
        flush=True,
    )
    if ok_chunks == 0:
        from clips_worker.picker.picker_errors import log_picker_error

        log_picker_error("gemini", "all stream video_picker chunks failed; continuing without visual", None)
        return None, [], agg
    return merged, all_moments, agg
