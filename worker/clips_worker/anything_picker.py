"""ClipAnything: scan → Gemini rank → clip picks."""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any

from clips_worker.gemini import rank_clipanything_candidates
from clips_worker.picker.titles import ensure_clip_title
from clips_worker.render_clip import slice_words
from clips_worker.scan import (
    build_candidate_windows,
    iou,
    probe_duration_s,
    sample_candidate_frames,
    scene_events,
)


def _transcript_excerpt(words: list[dict], start_s: float, end_s: float) -> str:
    chunk = slice_words(words, int(start_s * 1000), int(end_s * 1000))
    return " ".join(w.get("w", "") for w in chunk[:120])


def _emphasis_indexes(words: list[dict], start_ms: int, end_ms: int) -> list[int]:
    chunk = slice_words(words, start_ms, end_ms)
    out: list[int] = []
    for w in chunk:
        t = str(w.get("w", "")).strip()
        if len(t) >= 5 and t[0].isupper():
            out.append(int(w.get("i", w.get("idx", 0))))
    return out[:8]


def pick_anything_clips(
    conn,
    video: Path,
    words: list[dict],
    settings: dict[str, Any],
    range_start_ms: int,
    range_end_ms: int,
    workspace_id: str,
    project_id: str,
    work: Path,
) -> tuple[list[dict], str | None]:
    range_start_s = range_start_ms / 1000.0
    range_end_s = range_end_ms / 1000.0 if range_end_ms > 0 else probe_duration_s(video)
    user_prompt = (settings.get("prompt") or "").strip()
    max_clips = int(settings.get("maxClips") or settings.get("max_clips") or 10)

    cands = build_candidate_windows(video, words, work, range_start_s, range_end_s)
    if not cands:
        return [], "No highlight moments detected in this video."

    prepared: list[dict] = []
    for cand in cands:
        frames = sample_candidate_frames(video, cand, work / "cand_frames")
        prepared.append(
            {
                "id": cand.id,
                "start_s": cand.start_s,
                "end_s": cand.end_s,
                "transcript": _transcript_excerpt(words, cand.start_s, cand.end_s),
                "frames": frames,
            },
        )

    ranked = rank_clipanything_candidates(
        conn,
        workspace_id=workspace_id,
        project_id=project_id,
        candidates=prepared,
        user_prompt=user_prompt,
    )
    events = scene_events(video, work)
    cuts = sorted({t for t, _ in events})

    picks: list[dict] = []
    for row in sorted(ranked, key=lambda r: -int(r.get("score") or 0)):
        cid = str(row.get("candidateId") or "")
        base = next((c for c in cands if c.id == cid), None)
        start_s = float(row.get("start") or (base.start_s if base else 0))
        end_s = float(row.get("end") or (base.end_s if base else start_s + 30))
        for c in cuts:
            if abs(c - start_s) <= 1.5:
                start_s = c
            if abs(c - end_s) <= 1.5:
                end_s = c
        if end_s - start_s < 15:
            end_s = start_s + 15
        if end_s - start_s > 90:
            end_s = start_s + 90
        if any(iou(start_s, end_s, p["start_ms"] / 1000, p["end_ms"] / 1000) > 0.5 for p in picks):
            continue
        start_ms = int(start_s * 1000)
        end_ms = int(end_s * 1000)
        pick = {
            "start_ms": start_ms,
            "end_ms": end_ms,
            "title": str(row.get("title") or "Clip"),
            "hook": str(row.get("hook") or ""),
            "reason": str(row.get("reason") or ""),
            "score": int(row.get("score") or 70),
            "scores": {"hook": "B", "flow": "B", "value": "B", "trend": "B"},
            "aiMeta": {
                "hook": row.get("hook"),
                "action": row.get("action"),
                "payoff": row.get("payoff"),
                "subjectBox": row.get("subjectBox"),
                "mode": "anything",
                "emphasisWords": _emphasis_indexes(words, start_ms, end_ms),
            },
        }
        ensure_clip_title(pick, words, settings.get("genre", "vlog"))
        picks.append(pick)
        if len(picks) >= max_clips:
            break

    if not picks:
        return [], "Vision ranking did not return usable clips."
    return picks, None
