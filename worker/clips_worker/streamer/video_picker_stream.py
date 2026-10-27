"""Parallel per-chunk Gemini video watch for STREAM_ANALYZE."""
from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from clips_worker.storage import download_object
from clips_worker.streamer.audio_first_ingest import ingest_clip_section_video
from clips_worker.video_picker import (
    make_watch_proxy,
    moments_to_per_second,
    video_picker_enabled,
    watch_video_file,
)


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
) -> tuple[list[float] | None, list[dict], dict[str, Any]]:
    """Returns slice-relative 1Hz video curve, flat moments (ms), aggregate cost meta."""
    empty_meta: dict[str, Any] = {"chunks": 0, "ok_chunks": 0, "est_usd": 0.0}
    if not video_picker_enabled() or not ranges:
        return None, [], empty_meta
    duration_ms = int(vod.get("durationMs") or 0)
    duration_s = max(1, duration_ms // 1000)
    url = vod.get("url")
    base, base_absolute = _resolve_base_video(state=state, scratch=scratch)
    vod_start_ms = int(vod.get("rangeStartMs") or 0)
    vod_id = str(vod.get("id") or "vod")
    workers = max(1, min(4, int(os.environ.get("VIDEO_PICKER_CHUNK_CONCURRENCY", "3"))))
    chunk_dir = scratch / "video_picker_chunks"
    chunk_dir.mkdir(parents=True, exist_ok=True)

    def _one(idx: int, start_ms: int, end_ms: int) -> tuple[int, list[dict], list[float], dict]:
        rel_start_s = start_ms / 1000.0
        rel_end_s = end_ms / 1000.0
        chunk_s = max(1, int(rel_end_s - rel_start_s))
        abs_start_s = (vod_start_ms + start_ms) / 1000.0
        abs_end_s = (vod_start_ms + end_ms) / 1000.0
        proxy = chunk_dir / f"chunk_{idx}.mp4"
        if base is not None and base.is_file():
            if base_absolute:
                make_watch_proxy(base, proxy, abs_start_s, abs_end_s)
            else:
                make_watch_proxy(base, proxy, rel_start_s, rel_end_s)
        elif url:
            ingest_clip_section_video(
                str(url),
                proxy,
                job_id=job_id,
                vod_id=vod_id,
                clip_id=f"vp_{idx}",
                start_s=abs_start_s,
                end_s=abs_end_s,
            )
        else:
            return idx, [], [0.0], {"ok": False}
        moments, meta = watch_video_file(proxy, duration_s=chunk_s, chunk_label=f"stream_{idx}")
        for m in moments:
            try:
                m["t_s"] = float(m.get("t_s") or 0) + rel_start_s
            except (TypeError, ValueError):
                pass
        curve = moments_to_per_second(
            [{"t_s": float(m.get("t_s") or 0) - rel_start_s, "score": m.get("score")} for m in moments],
            chunk_s,
        )
        return idx, moments, curve, meta

    merged = [0.0] * duration_s
    all_moments: list[dict] = []
    total_usd = 0.0
    ok_chunks = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [pool.submit(_one, i, s, e) for i, (s, e) in enumerate(ranges)]
        for fut in as_completed(futs):
            try:
                idx, moments, curve, meta = fut.result()
            except Exception:
                continue
            if meta.get("ok"):
                ok_chunks += 1
            total_usd += float(meta.get("est_usd") or 0)
            start_ms = ranges[idx][0]
            off = start_ms // 1000
            for m in moments:
                try:
                    t_s = float(m.get("t_s") or 0)
                except (TypeError, ValueError):
                    continue
                all_moments.append(
                    {
                        "t_ms": int(round(t_s * 1000)),
                        "reason": str(m.get("reason") or "")[:200],
                        "score": float(m.get("score") or 0),
                    }
                )
            for i, val in enumerate(curve):
                ti = off + i
                if 0 <= ti < duration_s:
                    merged[ti] = max(merged[ti], float(val))
    agg = {"chunks": len(ranges), "ok_chunks": ok_chunks, "est_usd": round(total_usd, 6)}
    if ok_chunks == 0:
        return None, [], agg
    return merged, all_moments, agg
