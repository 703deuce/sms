#!/usr/bin/env python3
"""Measure RMS envelope on an export MP4 (0.1 s steps). Used to verify AU-33 music fades."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from clips_worker.audio_render import measure_segment_rms_db


def rms_envelope(path: Path, step_s: float = 0.1, window_s: float = 0.08) -> list[dict]:
    dur_s = float(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            text=True,
        ).strip()
    )
    out: list[dict] = []
    t = 0.0
    while t < dur_s - window_s * 0.5:
        t1 = min(t + window_s, dur_s)
        db = measure_segment_rms_db(path, t, t1)
        out.append({"t": round(t, 2), "rmsDb": round(db, 2)})
        t += step_s
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("media", type=Path)
    ap.add_argument("--step", type=float, default=0.1)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    if not args.media.is_file():
        print(f"missing file: {args.media}", file=sys.stderr)
        return 1
    env = rms_envelope(args.media, step_s=args.step)
    if args.json:
        print(json.dumps(env, indent=2))
    else:
        for row in env:
            print(f"{row['t']:6.2f}s  {row['rmsDb']:7.2f} dB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
