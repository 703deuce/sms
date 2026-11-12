"""Public finder entrypoints for AI Producer Agent (copied clipper logic, separate cache scope)."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Callable

from clips_worker.ai_producer_agent.finder import inventory as inventory_mod
from clips_worker.ai_producer_agent.finder import story as story_mod
from clips_worker.ai_producer_agent.finder.watch import (
    validate_and_normalize_moments,
    watch_upload_range,
    watch_video_file,
)
from clips_worker.storage import download_object

CACHE_SCOPE = "ai_producer_agent"
DEFAULT_GEMINI_MODEL = os.environ.get("AI_PRODUCER_AGENT_GEMINI_MODEL", "gemini-3.8-flash")
DEFAULT_GEMINI_FALLBACK = os.environ.get("AI_PRODUCER_AGENT_GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite")


def _scratch_for_job(job_id: str) -> Path:
    base = Path(os.environ.get("CLIPPER_SCRATCH", "/tmp/clipper-scratch"))
    d = base / "ai_producer_agent" / str(job_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def source_absolute_visual_moments(
    moments: list[dict], start_ms: int,
) -> list[dict]:
    """Gemini watches trimmed proxies with t=0 at the crop start.

    Return original-recording timestamps for visual+audio evidence. Regular
    non-visual clipper mode keeps its existing coordinate contract.
    """
    offset_s = start_ms / 1000.0
    result: list[dict] = []
    for moment in moments:
        item = dict(moment)
        for field in ("start_s", "end_s", "peak_s", "hook_s"):
            val = item.get(field)
            if isinstance(val, (float, int)):
                item[field] = round(float(val) + offset_s, 3)
        item["source_time_origin_ms"] = start_ms
        result.append(item)
    return result


def run_analyze_payload(
    conn,
    *,
    job: dict,
    payload: dict[str, Any],
    progress: Callable[[str, dict], None],
) -> dict[str, Any]:
    mode = str(payload.get("mode") or "best_moments")
    sources = list(payload.get("sources") or [])
    if not sources:
        raise ValueError("sources_required")
    run_id = str(payload.get("runId") or "")
    scratch = _scratch_for_job(str(job.get("id") or run_id or "analyze"))
    progress(job["id"], {"jobStatus": "RUNNING", "stage": "analyze", "mode": mode, "runId": run_id})

    if mode == "story_search":
        return story_mod.run_story_search(sources=sources, query=str(payload.get("query") or ""), scratch=scratch)
    if mode == "inventory":
        return inventory_mod.run_inventory(sources=sources, scratch=scratch, conn=conn, run_id=run_id)
    # Existing best-moments path is unchanged when visualEvidence is absent.
    # Experimental Story path explicitly joins low-detail labeled frames,
    # original audio and the already-authoritative ASR transcript in Gemini.
    evidence = payload.get("visualEvidence")
    visual = evidence if isinstance(evidence, dict) and evidence.get("enabled") is True else None
    if mode == "visual_detail" and visual is None:
        raise ValueError("visual_detail_requires_visual_evidence")
    if visual:
        # Both the initial whole-source watch and focused follow-up use 1 fps.
        # Shared by single-source Story, multi-source Story and Clean Take.
        fps = 1.0
        model = str(visual.get("model") or "gemini-3.1-flash-lite")
        resolution = "MEDIA_RESOLUTION_LOW"
    else:
        fps = None
        model = None
        resolution = None
    moments: list[dict] = []
    meta_agg: dict[str, Any] = {
        "mode": mode, "sources": len(sources), "est_usd": 0.0,
        "visual_audio_enabled": bool(visual),
        "fps": fps, "media_resolution": resolution, "model_requested": model,
        "original_audio_attached": bool(visual),
        "deepgram_transcript_attached": bool(visual and visual.get("transcriptText")),
        "times_are_source_absolute": bool(visual),
    }
    for src in sources:
        storage_key = str(src.get("storageKey") or "")
        if not storage_key:
            continue
        local = scratch / f"{src.get('sourceId', 'src')}.mp4"
        download_object(storage_key, local)
        range_ms = src.get("rangeMs") or [0, None]
        start_ms = int(range_ms[0] or 0)
        end_ms = int(range_ms[1] or 0) if range_ms[1] is not None else 0
        if mode == "visual_detail":
            # Only the few model-selected first-pass regions are revisited at 1 fps.
            windows = list(visual.get("focusWindows") or [])[:3] if visual else []
            source_end = end_ms if end_ms > start_ms else int(src.get("durationMs") or 0)
            for index, window in enumerate(windows):
                if not isinstance(window, dict):
                    continue
                lo = max(start_ms, int(window.get("startMs") or 0))
                hi = min(source_end, int(window.get("endMs") or 0))
                if hi - lo < 1500 or hi - lo > 45000:
                    continue
                region = scratch / f"focus_{index}"
                region.mkdir(parents=True, exist_ok=True)
                excerpt = str(window.get("transcriptText") or "")[:12000]
                # Each focused window is an observation, NOT a standalone
                # clip candidate. 1s physical reactions should not be erased
                # by the regular clipper's minimum 5s moment gate.
                try:
                    refined, _curve, meta = watch_upload_range(
                        local,
                        range_start_ms=lo, range_end_ms=hi,
                        scratch=region, target_clip_len_s=int(payload.get("targetClipLenS") or 30),
                        transcript_text=excerpt,
                        fps_override=fps,
                        media_resolution_override=resolution,
                        model_override=model,
                        force_audio=True,
                        min_moment_s=1.0,
                    )
                except Exception as exc:
                    meta_agg.setdefault("focus_window_results", []).append({
                        "index": index, "sourceRangeMs": [lo, hi],
                        "status": "failed", "reason": str(exc)[:300],
                    })
                    meta_agg["focus_windows_failed"] = int(meta_agg.get("focus_windows_failed") or 0) + 1
                    continue
                # Focus analysis times are relative to its own proxy.
                # Make them absolute BEFORE source-aligned TS evidence filters.
                absolute = source_absolute_visual_moments(refined, lo)
                for moment in absolute:
                    moment["sourceId"] = src.get("sourceId")
                    moment["evidence_tier"] = "focused_1fps"
                    moment["inspection_window_ms"] = [lo, hi]
                moments.extend(absolute)
                meta_agg["est_usd"] += float(meta.get("est_usd") or 0)
                meta_agg["focus_windows_analyzed"] = int(meta_agg.get("focus_windows_analyzed") or 0) + 1
                meta_agg.setdefault("focus_window_results", []).append({
                    "index": index, "sourceRangeMs": [lo, hi],
                    "status": "ok", "observations": len(refined),
                    "normalizeRejects": meta.get("normalize_rejects") or {},
                })
            continue
        if end_ms > start_ms:
            scratch.mkdir(parents=True, exist_ok=True)
            moments_part, _curve, meta = watch_upload_range(
                local,
                range_start_ms=start_ms,
                range_end_ms=end_ms,
                scratch=scratch,
                target_clip_len_s=int(payload.get("targetClipLenS") or 30),
                transcript_text=str(visual.get("transcriptText") or "")[:60000] if visual else None,
                fps_override=fps,
                media_resolution_override=resolution,
                model_override=model,
                force_audio=bool(visual),
            )
        else:
            dur_s = max(1, int((src.get("durationMs") or 60_000) // 1000))
            moments_part, meta = watch_video_file(
                local, duration_s=dur_s, chunk_label=str(src.get("sourceId") or "src"),
                transcript_text=str(visual.get("transcriptText") or "")[:60000] if visual else "",
                fps_override=fps, media_resolution_override=resolution,
                model_override=model, use_labeled_frames=True if visual else None,
            )
        # Watch of a source trim returns proxy-relative times; otherwise
        # candidates after the crop start appear at the wrong original time.
        # Keep the legacy nonvisual path unchanged.
        if visual and end_ms > start_ms:
            moments_part = source_absolute_visual_moments(moments_part, start_ms)
        for m in moments_part:
            m["sourceId"] = src.get("sourceId")
            if visual:
                m["evidence_tier"] = "coarse_1fps"
        moments.extend(moments_part)
        meta_agg["est_usd"] = float(meta_agg.get("est_usd") or 0) + float(meta.get("est_usd") or 0)
    if visual:
        ends = []
        for source in sources:
            window = source.get("rangeMs") or [0, None]
            if window[1] is not None and int(window[1] or 0) > int(window[0] or 0):
                ends.append(int(window[1]))
        duration_s = max(1, (max(ends) // 1000) + 1) if ends else max(1, int((sources[0].get("durationMs") or 60_000) // 1000))
    else:
        duration_s = max(1, int((sources[0].get("durationMs") or 60_000) // 1000))
    if mode != "visual_detail":
        # YouTube gaming observations are long story beats, not capped 45s clips.
        youtube_gaming = bool(visual and str(visual.get('transcriptText') or '').lstrip().startswith('YOUTUBE GAMING EPISODE WATCHER'))
        moments, _stats = validate_and_normalize_moments(
            moments, duration_s=duration_s, allow_long_gaming=youtube_gaming,
        )
    return {"moments": moments, "meta": meta_agg}
