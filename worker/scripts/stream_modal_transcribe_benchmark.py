#!/usr/bin/env python3
"""
Benchmark streamer Modal transcribe vs Deepgram on a 5-minute audio sample.

Usage (production worker env with Modal + Deepgram keys):
  python scripts/stream_modal_transcribe_benchmark.py \\
    --solo-audio-url <signed-url-4h-vod-sample> \\
    --collab-audio-url <signed-url-collab-sample> \\
    --sample-start-s 3600 --sample-duration-s 300

Reports: gpu_seconds, cold_start_s, cost estimate, word-count delta vs Deepgram,
and distinct speaker count for collab diarize run.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

WORKER_ROOT = Path(__file__).resolve().parents[1]
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))

from clips_worker.deepgram_transcribe import transcribe_deepgram
from clips_worker.gpu.base import TranscribeReq
from clips_worker.streamer.modal_transcribe import (
    estimate_modal_cost_usd,
    transcribe_stream_modal_with_meta,
)


def _slice_to_file(src_url: str, start_s: float, duration_s: float, dest: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{start_s:.3f}",
            "-t",
            f"{duration_s:.3f}",
            "-i",
            src_url,
            "-c:a",
            "libopus",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _word_text(words: list[dict]) -> str:
    return " ".join(w.get("w", "") for w in words).lower()


def _wer_proxy(a: str, b: str) -> float:
    aw = a.split()
    bw = b.split()
    if not aw and not bw:
        return 0.0
    # naive token mismatch rate (not full WER)
    mism = sum(1 for i, t in enumerate(aw[: len(bw)]) if i < len(bw) and t != bw[i])
    return mism / max(len(aw), len(bw), 1)


def bench_label(label: str, audio_path: Path, audio_url: str, diarize: bool) -> dict:
    req = TranscribeReq(audio_path=str(audio_path), audio_url=audio_url, offset_ms=0, language="en")
    t0 = time.time()
    modal_res, telem = transcribe_stream_modal_with_meta(req, diarize=diarize)
    modal_wall = time.time() - t0
    dg_res = transcribe_deepgram(TranscribeReq(audio_path=str(audio_path), offset_ms=0, language="en"))
    spk = {w.get("spk") for w in modal_res.words if w.get("spk") is not None}
    return {
        "label": label,
        "diarize": diarize,
        "modalGpuSeconds": modal_res.gpu_seconds,
        "modalColdStartS": telem.get("cold_start_s"),
        "modalWallSeconds": round(modal_wall, 2),
        "modalCostUsdEst": round(estimate_modal_cost_usd(modal_res.gpu_seconds), 4),
        "modalWordCount": len(modal_res.words),
        "deepgramWordCount": len(dg_res.words),
        "tokenMismatchVsDeepgram": round(_wer_proxy(_word_text(modal_res.words), _word_text(dg_res.words)), 4),
        "distinctSpeakers": len(spk) if diarize else 0,
        "diarizationSanity": "ok" if (not diarize or len(spk) >= 2) else "low_speaker_count",
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--solo-audio-url", required=True)
    p.add_argument("--collab-audio-url", required=True)
    p.add_argument("--sample-start-s", type=float, default=3600.0)
    p.add_argument("--sample-duration-s", type=float, default=300.0)
    args = p.parse_args()

    out: list[dict] = []
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        solo = td_path / "solo_sample.opus"
        collab = td_path / "collab_sample.opus"
        _slice_to_file(args.solo_audio_url, args.sample_start_s, args.sample_duration_s, solo)
        _slice_to_file(args.collab_audio_url, args.sample_start_s, args.sample_duration_s, collab)
        out.append(bench_label("solo_5min", solo, args.solo_audio_url, diarize=False))
        out.append(bench_label("collab_5min", collab, args.collab_audio_url, diarize=True))

    print(json.dumps({"benchmark": "stream_modal_transcribe", "results": out}, indent=2))


if __name__ == "__main__":
    main()
