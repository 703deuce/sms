#!/usr/bin/env python3
"""Render clip A/B fixture edits and extract frame @ 3s for parity artifacts."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / "new-app" / "tests" / "fixtures" / "export-dialog-edits"
ARTIFACTS = Path("/opt/cursor/artifacts")


def make_src(dest: Path) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=1280x720:rate=30:duration=8",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-pix_fmt",
            "yuv420p",
            str(dest),
        ],
    )


def extract_frame(video: Path, dest_png: Path, t: float = 3.0) -> None:
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-ss",
            f"{t:.2f}",
            "-i",
            str(video),
            "-frames:v",
            "1",
            str(dest_png),
        ],
    )


def render_fixture(name: str, out_mp4: Path, work: Path) -> None:
    from clips_worker.edits_render import compose_export

    edits = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    src = work / "src.mp4"
    make_src(src)
    words = [{"w": "This", "s": 0.0, "e": 0.3, "i": 0}, {"w": "shit", "s": 0.35, "e": 0.6, "i": 1},
             {"w": "overstimulated.", "s": 0.65, "e": 1.2, "i": 2}]
    ctx = {
        "work_dir": work,
        "play_w": 1080,
        "play_h": 1920,
        "length_s": 6.0,
        "settings": {"aspectRatio": "9:16", "exportResolution": "1080p", "layout": "fit_top"},
        "conn": None,
        "project_id": "parity",
        "clip_id": name,
        "clip_start_ms": 0,
        "clip_end_ms": 6000,
        "render_id": "parity",
    }
    compose_export(src, words, out_mp4, edits, ctx)


def main() -> int:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    for label, fixture in (("clipA", "stream_headline_clipA.json"), ("clipB", "stream_v3_clipB.json")):
        work = ARTIFACTS / f"parity_{label}_work"
        work.mkdir(parents=True, exist_ok=True)
        mp4 = ARTIFACTS / f"t46_export_{label}_frame.mp4"
        png = ARTIFACTS / f"t46_export_{label}_3s.png"
        render_fixture(fixture, mp4, work)
        extract_frame(mp4, png, 3.0)
        print(f"wrote {png}")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(REPO / "worker"))
    raise SystemExit(main())
