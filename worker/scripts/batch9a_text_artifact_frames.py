#!/usr/bin/env python3
"""Extract 720p hook frames for Batch 9A text proof (f01, f03, f09)."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path("/opt/cursor/artifacts")
OUT.mkdir(parents=True, exist_ok=True)
CONTRACT = json.loads((ROOT / "new-app/tests/fixtures/batch9a-anchor-render-contract.json").read_text())
FFMPEG = "ffmpeg"


def render_hook_frame(anchor_id: str, edits: dict, total_frames: int, out_png: Path) -> None:
    duration_s = total_frames / 30.0
    duration_ms = int(round(total_frames * 1000 / 30))
    tmp = Path(tempfile.mkdtemp())
    carrier = tmp / "carrier.mp4"
    subprocess.check_call(
        [
            FFMPEG,
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"color=c=#1a1a1a:s=720x1280:r=30:d={duration_s:.6f}",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-t",
            f"{duration_s:.6f}",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-shortest",
            str(carrier),
        ]
    )
    colors = ("#DC2626", "#2563EB", "#16A34A", "#D97706", "#7C3AED")
    media: dict[str, Path] = {}
    for i, src in enumerate(edits.get("sources") or []):
        ref = str(src.get("refId") or src.get("id") or f"img_{i}")
        img = tmp / f"{ref}.png"
        subprocess.check_call(
            [
                FFMPEG,
                "-y",
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                f"color=c={colors[i % len(colors)]}:s=720x1280",
                "-frames:v",
                "1",
                str(img),
            ]
        )
        media[ref] = img

    sys.path.insert(0, str(ROOT / "worker"))
    from clips_worker.media_sources import apply_full_render_sources
    from clips_worker.text_items import apply_text_items

    sourced = apply_full_render_sources(carrier, edits, 0, duration_ms, tmp, media)
    burned = tmp / "burned.mp4"
    apply_text_items(sourced, burned, edits, play_w=720, play_h=1280)
    stamp = min(duration_s - 0.05, 0.45)
    subprocess.check_call(
        [
            FFMPEG,
            "-y",
            "-v",
            "error",
            "-ss",
            f"{stamp:.4f}",
            "-i",
            str(burned),
            "-frames:v",
            "1",
            str(out_png),
        ]
    )
    print(f"[batch9a-artifacts] {anchor_id} -> {out_png}", flush=True)


def main() -> None:
    edits_path = OUT / "compiled-edits"
    edits_path.mkdir(exist_ok=True)
    # Caller provides pre-compiled JSON via tsx helper; fallback: minimal stroked f01 from contract row
    for target in ("f01_bold", "f03_bold", "f09_bold"):
        row = next(a for a in CONTRACT["anchors"] if a["id"] == target)
        compiled_file = edits_path / f"{target}.json"
        if not compiled_file.is_file():
            print(f"skip {target}: missing {compiled_file}", flush=True)
            continue
        edits = json.loads(compiled_file.read_text())
        render_hook_frame(target, edits, row["totalFrames"], OUT / f"{target}-hook-after.png")

    # Plain legacy f01 (no stroke) for before shot
    f01_file = edits_path / "f01_bold.json"
    if not f01_file.is_file():
        return
    f01 = json.loads(f01_file.read_text())
    f01_row = next(a for a in CONTRACT["anchors"] if a["id"] == "f01_bold")
    plain = dict(f01)
    items = []
    for i, t in enumerate(f01.get("textItems") or []):
        if i == 0:
            st = dict(t.get("style") or {})
            st.pop("stroke", None)
            st.pop("shadow", None)
            st["case"] = "none"
            st["font"] = "DM Serif Display"
            items.append({**t, "style": st, "anim": {"in": {"type": "fade", "unit": "block", "durMs": 400}}})
        else:
            items.append(t)
    plain["textItems"] = items
    render_hook_frame("f01_plain", plain, f01_row["totalFrames"], OUT / "f01-before-plain-hook.png")


if __name__ == "__main__":
    main()
