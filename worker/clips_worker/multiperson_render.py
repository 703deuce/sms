"""Render crop_track v2 layouts via ffmpeg filtergraphs."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from clips_worker.filtergraph import (
    DIVIDER_PX,
    OUT_H,
    OUT_W,
    caption_seam_y,
    segment_layout_stack,
    slot_crop_filter,
    two_up_vstack_filter,
)
from clips_worker.ffmpeg_util import stderr_tail
from clips_worker.render_concurrency import ffmpeg_threads_per_job


def render_multiperson_v2(src: Path, dest: Path, crop: dict) -> None:
    if int(crop.get("version", 1)) != 2:
        raise ValueError("expected crop version 2")
    W = int(crop["W"])
    H = int(crop["H"])
    out_w = int(crop.get("out_w", OUT_W))
    out_h = int(crop.get("out_h", OUT_H))
    segments = crop.get("segments") or []
    if not segments:
        raise ValueError("no segments")
    filters: list[str] = []
    concat_in: list[str] = []
    for si, seg in enumerate(segments):
        layout = seg.get("layout", "close")
        t0, t1 = float(seg["t0"]), float(seg["t1"])
        slots = seg.get("slots") or []
        base = f"v{si}"
        filters.append(f"[0:v]trim=start={t0}:end={t1},setpts=PTS-STARTPTS[{base}]")
        if layout == "wide":
            filters.append(
                f"[{base}]scale={out_w}:{out_h}:force_original_aspect_ratio=decrease,"
                f"pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2,setsar=1[vout{si}]"
            )
            concat_in.append(f"[vout{si}]")
            continue
        if layout == "close" and slots:
            sl = slots[0]
            cx, cy = float(sl.get("cx", W / 2)), float(sl.get("cy", H / 2))
            filters.append(
                slot_crop_filter(base, f"out{si}", cx, cy, W, H, out_w, out_h)
            )
            concat_in.append(f"[out{si}]")
            continue
        slot_labels = []
        for j, sl in enumerate(slots[:4]):
            cx, cy = float(sl.get("cx", W / 2)), float(sl.get("cy", H / 2))
            sh = out_h // 2 if layout in ("two_up", "grid3") else out_h // 2
            sw = out_w if layout == "two_up" else out_w // 2
            filters.append(slot_crop_filter(base, f"s{si}_{j}", cx, cy, W, H, sw, sh))
            slot_labels.append(f"s{si}_{j}")
        if layout == "two_up" and len(slot_labels) >= 2:
            filters.append(f"[{slot_labels[0]}][{slot_labels[1]}]{two_up_vstack_filter()}[vout{si}]")
        elif layout == "grid4" and len(slot_labels) >= 4:
            stack = segment_layout_stack("grid4")
            ins = "".join(f"[{lb}]" for lb in slot_labels)
            filters.append(f"{ins}{stack}[vout{si}]")
        else:
            filters.append(f"[{slot_labels[0]}]scale={out_w}:{out_h}[vout{si}]")
        concat_in.append(f"[vout{si}]")
    fg = ";".join(filters)
    concat = "".join(concat_in) + f"concat=n={len(concat_in)}:v=1:a=0[vfinal]"
    vf = f"{fg};{concat}"
    threads = str(ffmpeg_threads_per_job())
    cmd = [
        "ffmpeg",
        "-y",
        "-threads",
        threads,
        "-v",
        "error",
        "-i",
        str(src),
        "-filter_complex",
        vf,
        "-map",
        "[vfinal]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        str(dest),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(stderr_tail(proc.stderr or proc.stdout or "", lines=20))


def load_and_render(src: Path, dest: Path, crop_path: Path) -> None:
    crop = json.loads(crop_path.read_text())
    render_multiperson_v2(src, dest, crop)
