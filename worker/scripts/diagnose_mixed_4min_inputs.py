#!/usr/bin/env python3
"""Evidence dump for mixed_4min VP inputs (transcript, proxy, frame clock)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

PROJECT_ID = os.environ.get("BENCH_PROJECT_ID", "proj_3edeaf9309b74bbfa8ce5313b0e346c3")
UPLOAD_KEY = os.environ.get(
    "BENCH_SOURCE_KEY",
    "ws/ws_1/uploads/upl_6e0b931f3b8b4d7b9f7d905682d70b7c/source.mp4",
)


def main() -> None:
    from clips_worker.picker.sentences import build_sentences
    from clips_worker.storage import download_object
    from clips_worker.video_picker import (
        format_timestamped_transcript,
        make_watch_proxy,
        video_picker_labeled_frames,
        _extract_labeled_frames,
        video_picker_fps,
    )

    duration_s = 226
    scratch = Path(tempfile.mkdtemp(prefix="diag_mixed4_"))
    src = scratch / "source.mp4"
    download_object(UPLOAD_KEY, src)
    proxy = scratch / "video_picker_upload.mp4"
    make_watch_proxy(src, proxy, 0.0, float(duration_s))

    print("=== input_mode env ===")
    print(f"VIDEO_PICKER_LABELED_FRAMES -> {video_picker_labeled_frames()}")
    print(f"VIDEO_PICKER_USER_PART_ORDER -> {os.environ.get('VIDEO_PICKER_USER_PART_ORDER', '(default transcript_first)')}")

    print("\n=== ffprobe source ===")
    for label, path in [("source", src), ("proxy", proxy)]:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration:stream=index,codec_type,start_time,start_pts,duration",
                "-of",
                "json",
                str(path),
            ],
            text=True,
        )
        print(f"--- {label} {path.name} ---")
        print(out)

    print("=== frame at 150s (proxy) ===")
    frame150 = scratch / "frame_150s.jpg"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-ss",
            "150",
            "-i",
            str(proxy),
            "-frames:v",
            "1",
            str(frame150),
        ],
    )
    print(f"extracted {frame150} size={frame150.stat().st_size}")

    fps = video_picker_fps()
    frames = _extract_labeled_frames(proxy, scratch, duration_s=float(duration_s), fps=fps)
    print(f"\n=== labeled_frames extract: count={len(frames)} fps={fps} ===")
    for t, _ in frames:
        if 145 <= t <= 155:
            print(f"  label [t={t:.1f}s] (index-based)")
    idx150 = int(150 * fps)
    if idx150 < len(frames):
        print(f"  frame index {idx150} labeled t={frames[idx150][0]}")

    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute('SELECT "transcriptWords" FROM clip_projects WHERE id = %s', (PROJECT_ID,))
    row = cur.fetchone()
    conn.close()
    words = row[0] if row and row[0] else []
    if isinstance(words, str):
        words = json.loads(words)

    sentences = build_sentences(words, 0, duration_s * 1000)
    transcript = format_timestamped_transcript(sentences, 0, duration_s * 1000)

    print("\n=== format_timestamped_transcript 70s–230s ===")
    for line in transcript.splitlines():
        if not line.startswith("["):
            continue
        try:
            t = float(line.split("s]")[0][1:])
        except ValueError:
            continue
        if 70 <= t <= 230:
            print(line)

    print("\n=== word-level sample (absolute s) 75–175 ===")
    for w in words:
        s = float(w.get("s", 0))
        if 75 <= s <= 175:
            print(f"  {s:.2f}-{float(w.get('e', s)):.2f} {w.get('w', '')}")

    needles = ["Move fast", "win a game", "Bloodhound", "meow", "CHAMPION"]
    print("\n=== needle search in transcript lines (any time) ===")
    for line in transcript.splitlines():
        low = line.lower()
        if any(n.lower() in low for n in needles):
            print(line)


if __name__ == "__main__":
    main()
