"""Render crop_track v2 layouts via ffmpeg filtergraphs."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from clips_worker.filtergraph import (
    HALF_H,
    OUT_H,
    OUT_W,
    QUAD_W,
    fit_blur_overlay_filter,
    grid3_layout_filter_labels,
    grid4_xstack_filter,
    screen_pip_overlay_filter,
    segment_layout_stack,
    side_by_side_filter,
    slot_crop_filter,
    two_up_vstack_filter,
)
from clips_worker.compose_layout import layout_slots
from clips_worker.ffmpeg_util import stderr_tail
from clips_worker.render_concurrency import ffmpeg_threads_per_job


def build_multiperson_filter_complex(crop: dict) -> str:
    """Return ffmpeg -filter_complex string ending in [vfinal] (no encode)."""
    if int(crop.get("version", 1)) != 2:
        raise ValueError("expected crop version 2")
    W = int(crop["W"])
    H = int(crop["H"])
    out_w = int(crop.get("out_w", OUT_W))
    out_h = int(crop.get("out_h", OUT_H))
    half_h = out_h // 2
    quad_w = out_w // 2
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
            filters.append(fit_blur_overlay_filter(base, f"vout{si}", out_w, out_h))
            concat_in.append(f"[vout{si}]")
            continue
        if layout in ("pip", "screen_pip") and slots:
            sl = slots[0]
            cx, cy = float(sl.get("cx", W / 2)), float(sl.get("cy", H / 2))
            pip_slot = layout_slots("screen_pip", out_w, out_h, 2)[1]
            _, _, ow_pip, oh_pip = pip_slot
            filters.append(fit_blur_overlay_filter(base, f"bg{si}", out_w, out_h))
            filters.append(
                slot_crop_filter(
                    base,
                    f"cam{si}",
                    cx,
                    cy,
                    W,
                    H,
                    ow_pip,
                    oh_pip,
                    letterbox_blur=False,
                )
            )
            filters.append(screen_pip_overlay_filter(f"bg{si}", f"cam{si}", f"vout{si}", out_w, out_h))
            concat_in.append(f"[vout{si}]")
            continue
        if layout == "side" and len(slots) >= 2:
            slot_labels = []
            side_slots = layout_slots("side", out_w, out_h, 2)
            for j, sl in enumerate(slots[:2]):
                cx, cy = float(sl.get("cx", W / 2)), float(sl.get("cy", H / 2))
                _, _, sw, sh = (0, 0, side_slots[j][2], side_slots[j][3])
                filters.append(
                    slot_crop_filter(base, f"s{si}_{j}", cx, cy, W, H, sw, sh, letterbox_blur=False)
                )
                slot_labels.append(f"s{si}_{j}")
            if len(slot_labels) >= 2:
                filters.append(f"[{slot_labels[0]}][{slot_labels[1]}]{side_by_side_filter()}[vout{si}]")
            concat_in.append(f"[vout{si}]")
            continue
        if layout == "close" and slots:
            sl = slots[0]
            cx, cy = float(sl.get("cx", W / 2)), float(sl.get("cy", H / 2))
            filters.append(
                slot_crop_filter(base, f"out{si}", cx, cy, W, H, out_w, out_h, letterbox_blur=True)
            )
            concat_in.append(f"[out{si}]")
            continue
        slot_labels = []
        for j, sl in enumerate(slots[:4]):
            cx, cy = float(sl.get("cx", W / 2)), float(sl.get("cy", H / 2))
            if layout == "two_up":
                sw, sh = out_w, half_h
            elif layout == "grid3":
                sw, sh = (out_w, half_h) if j == 0 else (quad_w, half_h)
            else:
                sw, sh = quad_w, half_h
            filters.append(
                slot_crop_filter(
                    base,
                    f"s{si}_{j}",
                    cx,
                    cy,
                    W,
                    H,
                    sw,
                    sh,
                    letterbox_blur=False,
                )
            )
            slot_labels.append(f"s{si}_{j}")
        if layout == "two_up" and len(slot_labels) >= 2:
            filters.append(f"[{slot_labels[0]}][{slot_labels[1]}]{two_up_vstack_filter()}[vout{si}]")
        elif layout == "grid4" and len(slot_labels) >= 4:
            ins = "".join(f"[{lb}]" for lb in slot_labels)
            filters.append(f"{ins}{grid4_xstack_filter()}[vout{si}]")
        elif layout == "grid3" and len(slot_labels) >= 3:
            filters.append(grid3_layout_filter_labels(slot_labels[0], slot_labels[1], slot_labels[2], f"vout{si}"))
        elif slot_labels:
            filters.append(fit_blur_overlay_filter(slot_labels[0], f"vout{si}", out_w, out_h))
        else:
            filters.append(fit_blur_overlay_filter(base, f"vout{si}", out_w, out_h))
        concat_in.append(f"[vout{si}]")
    fg = ";".join(filters)
    concat = "".join(concat_in) + f"concat=n={len(concat_in)}:v=1:a=0[vfinal]"
    return f"{fg};{concat}"


def render_multiperson_v2(src: Path, dest: Path, crop: dict) -> None:
    vf = build_multiperson_filter_complex(crop)
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
