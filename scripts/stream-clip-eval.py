#!/usr/bin/env python3
"""Streamer clip ranking eval — recall@10/@20 vs Twitch viewer clips (overlap >= 50%).

Usage:
  PYTHONPATH=worker python scripts/stream-clip-eval.py
  PYTHONPATH=worker python scripts/stream-clip-eval.py --fixture worker/fixtures/stream_clip_eval_vods.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "worker"))

from clips_worker.streamer.eval_recall import recall_at_k
from clips_worker.streamer.fusion import fuse_moments


def _synthetic_signals(duration_s: int, viewer_clips: list[dict]) -> dict:
    from clips_worker.streamer.signals.viewer_clips import viewer_clips_signal_per_second

    audio = [0.05] * duration_s
    for vc in viewer_clips:
        sec = int(vc.get("vod_offset_s") or 0)
        if 0 <= sec < duration_s:
            audio[sec] = 0.92
    return {
        "audio": audio,
        "transcript": [0.1] * duration_s,
        "chat": None,
        "viewerClips": viewer_clips_signal_per_second(viewer_clips, duration_s),
        "clipCues": [0.0] * duration_s,
        "markers": None,
        "speakerChange": None,
    }


def eval_fixture(row: dict) -> dict:
    duration_ms = int(row["durationMs"])
    duration_s = max(1, duration_ms // 1000)
    viewer = list(row.get("viewerClips") or [])
    signals = _synthetic_signals(duration_s, viewer)
    picks, payload = fuse_moments(
        duration_s=duration_s,
        signals=signals,
        words=[],
        settings={"streamer": {"clipCount": 15, "minClipS": 12, "maxClipS": 55}},
        llm_ranker=None,
    )
    cand = payload.get("candidates") or [
        {"startMs": p.start_ms, "endMs": p.end_ms, "score": p.score} for p in picks
    ]
    r10 = recall_at_k(cand, viewer, 10)
    r20 = recall_at_k(cand, viewer, 20)
    return {
        "id": row.get("id"),
        "recallAt10": round(r10, 3),
        "recallAt20": round(r20, 3),
        "pickCount": len(cand),
        "viewerClips": len(viewer),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixture", default=str(ROOT / "worker/fixtures/stream_clip_eval_vods.json"))
    args = ap.parse_args()
    rows = json.loads(Path(args.fixture).read_text())
    results = [eval_fixture(r) for r in rows]
    print(json.dumps({"benchmarks": results}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
