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
    # best_moments (default)
    moments: list[dict] = []
    meta_agg: dict[str, Any] = {"mode": mode, "sources": len(sources), "est_usd": 0.0}
    for src in sources:
        storage_key = str(src.get("storageKey") or "")
        if not storage_key:
            continue
        local = scratch / f"{src.get('sourceId', 'src')}.mp4"
        download_object(storage_key, local)
        range_ms = src.get("rangeMs") or [0, None]
        start_ms = int(range_ms[0] or 0)
        end_ms = int(range_ms[1] or 0) if range_ms[1] is not None else 0
        if end_ms > start_ms:
            scratch.mkdir(parents=True, exist_ok=True)
            moments_part, _curve, meta = watch_upload_range(
                local,
                range_start_ms=start_ms,
                range_end_ms=end_ms,
                scratch=scratch,
                target_clip_len_s=int(payload.get("targetClipLenS") or 30),
            )
        else:
            dur_s = max(1, int((src.get("durationMs") or 60_000) // 1000))
            moments_part, meta = watch_video_file(local, duration_s=dur_s, chunk_label=str(src.get("sourceId") or "src"))
        for m in moments_part:
            m["sourceId"] = src.get("sourceId")
        moments.extend(moments_part)
        meta_agg["est_usd"] = float(meta_agg.get("est_usd") or 0) + float(meta.get("est_usd") or 0)
    duration_s = max(1, int((sources[0].get("durationMs") or 60_000) // 1000))
    moments, _stats = validate_and_normalize_moments(moments, duration_s=duration_s)
    return {"moments": moments, "meta": meta_agg}
