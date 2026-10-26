#!/usr/bin/env python3
"""Compare local vs Modal transcription on a speech file (JSON stdout)."""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

# Allow running from repo root or /app
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _wer(ref: str, hyp: str) -> float:
    ref_w = ref.lower().split()
    hyp_w = hyp.lower().split()
    if not ref_w:
        return 0.0 if not hyp_w else 1.0
    # Levenshtein at word level
    d = [[0] * (len(hyp_w) + 1) for _ in range(len(ref_w) + 1)]
    for i in range(len(ref_w) + 1):
        d[i][0] = i
    for j in range(len(hyp_w) + 1):
        d[0][j] = j
    for i, rw in enumerate(ref_w, 1):
        for j, hw in enumerate(hyp_w, 1):
            cost = 0 if rw == hw else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    return d[len(ref_w)][len(hyp_w)] / len(ref_w)


def _words_text(words: list[dict]) -> str:
    return " ".join(w.get("w", "") for w in words).strip()


def main() -> int:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/test_interview_60s.mp4")
    if not src.exists():
        print(json.dumps({"error": f"missing {src}"}))
        return 1

    from clips_worker.gpu.base import TranscribeReq
    from clips_worker.gpu.local import LocalProvider
    from clips_worker.storage import sign_url, upload_file

    opus = src.parent / f"{src.stem}.parity.opus"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(src),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "libopus",
            "-b:a",
            "24k",
            str(opus),
        ],
    )

    local = LocalProvider()
    t0 = time.time()
    local_res = local.transcribe(TranscribeReq(audio_path=str(src), language="en"))
    local_wall = time.time() - t0

    key = f"ws/smoke/parity/{src.stem}.opus"
    upload_file(key, opus, "audio/opus")
    url = sign_url(key, expires_s=3600)

    os.environ["GPU_PROVIDER"] = "modal"
    from clips_worker.gpu import get_provider

    modal = get_provider("transcribe")

    cold_t0 = time.time()
    cold_res = modal.transcribe(TranscribeReq(audio_url=url, language="en"))
    cold_wall = time.time() - cold_t0

    warm_t0 = time.time()
    warm_res = modal.transcribe(TranscribeReq(audio_url=url, language="en"))
    warm_wall = time.time() - warm_t0

    ref = _words_text(local_res.words)
    hyp = _words_text(cold_res.words)
    wer = round(_wer(ref, hyp), 4)

    l4 = float(os.environ.get("MODAL_L4_USD_PER_S", "0.000222"))

    out = {
        "file": str(src),
        "local": {
            "words": len(local_res.words),
            "wall_s": round(local_wall, 2),
            "gpu_s": 0,
            "cost_usd": 0,
        },
        "modal_cold": {
            "words": len(cold_res.words),
            "wall_s": round(cold_wall, 2),
            "gpu_s": round(cold_res.gpu_seconds, 3),
            "cost_usd": round(cold_res.gpu_seconds * l4, 5),
        },
        "modal_warm": {
            "words": len(warm_res.words),
            "wall_s": round(warm_wall, 2),
            "gpu_s": round(warm_res.gpu_seconds, 3),
            "cost_usd": round(warm_res.gpu_seconds * l4, 5),
        },
        "wer_local_vs_modal_cold": wer,
        "ref_excerpt": ref[:200],
        "hyp_excerpt": hyp[:200],
    }
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
