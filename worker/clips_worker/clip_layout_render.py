"""Per-clip layout framing for export (T5 Part C) — never stream-level facecam boxes."""
from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

DEFAULT_FACECAM_BOX = {"x": 0.02, "y": 0.02, "w": 0.32, "h": 0.28}
DEFAULT_GAMEPLAY_BOX = {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}


@dataclass(frozen=True)
class ClipLayoutApplyResult:
    path: Path
    applied: bool
    seam_captions: bool = False
    stack_split: float = 0.4


def _layout_edits_facecam(edits: dict) -> dict[str, Any]:
    layout_ed = edits.get("layout") if isinstance(edits.get("layout"), dict) else {}
    fc_meta = layout_ed.get("facecam") if isinstance(layout_ed.get("facecam"), dict) else {}
    box = fc_meta.get("box") if isinstance(fc_meta.get("box"), dict) else None
    if box and all(k in box for k in ("x", "y", "w", "h")):
        lay: dict[str, Any] = {
            "facecam": box,
            "split": fc_meta.get("split"),
            "facecamPosition": fc_meta.get("position") or fc_meta.get("facecamPosition") or "top",
        }
        gameplay = fc_meta.get("gameplay")
        if isinstance(gameplay, dict) and all(k in gameplay for k in ("x", "y", "w", "h")):
            lay["gameplay"] = gameplay
        return lay
    mode = str(layout_ed.get("mode") or "")
    if mode in ("facecam_stack", "facecam_pip", "stack", "screen_pip", "facecam_pip"):
        print(f"[clipper:facecam] facecam_default_fallback mode={mode}", flush=True)
        return {
            "facecam": dict(DEFAULT_FACECAM_BOX),
            "gameplay": dict(DEFAULT_GAMEPLAY_BOX),
            "split": float(fc_meta.get("split") or 0.35),
            "facecamPosition": str(fc_meta.get("position") or fc_meta.get("facecamPosition") or "top"),
        }
    return {}


def facecam_layout_for_render(edits: dict) -> tuple[dict | None, str]:
    """Clip edits only — no stream VOD layout fallback."""
    lay = _layout_edits_facecam(edits)
    if lay.get("facecam"):
        return lay, "clip_edits"
    return None, "none"


def _render_center_fill(
    src: Path,
    dest: Path,
    *,
    play_w: int,
    play_h: int,
    crop_box: dict | None = None,
) -> None:
    if crop_box and all(k in crop_box for k in ("x", "y", "w", "h")):
        x, y, w, h = float(crop_box["x"]), float(crop_box["y"]), float(crop_box["w"]), float(crop_box["h"])
        vf = f"crop=iw*{w}:ih*{h}:iw*{x}:ih*{y},scale={play_w}:{play_h}"
    else:
        vf = f"scale={play_w}:{play_h}:force_original_aspect_ratio=increase,crop={play_w}:{play_h}"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(src),
            "-vf",
            vf,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def headline_band_out_height(edits: dict, *, play_w: int, play_h: int) -> int:
    """When headline export band is active, render/crop at full width under the bar (no side pad)."""
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
    hb = tpl.get("headlineBar") if isinstance(tpl.get("headlineBar"), dict) else {}
    if not hb.get("enabled"):
        return play_h
    headline = str(hb.get("text") or tpl.get("suggestedHeadline") or "").strip()
    if not headline:
        return play_h
    from clips_worker.clip_export_template import stream_headline_frame_layout

    frame = stream_headline_frame_layout(play_w, play_h)
    return max(1, play_h - frame["bar_h"])


def speakercrop_settings_band_height(
    settings: dict,
    edits: dict,
    *,
    play_w: int,
    play_h: int,
) -> dict:
    """Speaker-follow export at band height when headline bar is on (edge-to-edge under bar)."""
    from clips_worker.clip_export_template import export_headline_active

    mode = str((edits.get("layout") or {}).get("mode") or "speaker_follow")
    if not export_headline_active(edits):
        return settings
    if mode not in ("speaker_follow", "subject_follow", "auto", "dynamic"):
        return settings
    band_h = headline_band_out_height(edits, play_w=play_w, play_h=play_h)
    if band_h >= play_h:
        return settings
    return {**settings, "speakercropOutH": band_h}


def per_clip_stack_out_height(edits: dict, *, play_w: int, play_h: int) -> int:
    """Alias — stack/PiP and speaker_follow share headline band height."""
    return headline_band_out_height(edits, play_w=play_w, play_h=play_h)


def apply_per_clip_layout(
    clip_src: Path,
    work_dir: Path,
    edits: dict,
    *,
    play_w: int,
    play_h: int,
) -> ClipLayoutApplyResult:
    layout_mode = str((edits.get("layout") or {}).get("mode") or "speaker_follow")
    lay, source = facecam_layout_for_render(edits)
    stack_out_h = headline_band_out_height(edits, play_w=play_w, play_h=play_h)

    if layout_mode in ("stack", "facecam_stack"):
        if lay and lay.get("facecam"):
            from clips_worker.streamer.layout.render_stack import render_stack_mp4

            stacked = work_dir / "facecam_stack.mp4"
            try:
                render_stack_mp4(clip_src, stacked, lay, out_w=play_w, out_h=stack_out_h)
                split = float(lay.get("split") or 0.4)
                print(
                    f"[clipper:facecam] facecam_applied mode=stack source={source} split={split}",
                    flush=True,
                )
                return ClipLayoutApplyResult(
                    stacked,
                    True,
                    seam_captions=True,
                    stack_split=split,
                )
            except Exception as e:
                print(
                    f"[clipper:facecam] facecam_fallback mode=stack err={type(e).__name__}:{str(e)[:120]}",
                    flush=True,
                )
        else:
            print("[clipper:facecam] facecam_fallback mode=stack reason=no_facecam_box", flush=True)

    if layout_mode in ("screen_pip", "facecam_pip"):
        from clips_worker.streamer.layout.render_stack import render_pip_mp4

        if lay and lay.get("facecam"):
            pip_out = work_dir / "screen_pip_layout.mp4"
            try:
                render_pip_mp4(clip_src, pip_out, lay, out_w=play_w, out_h=stack_out_h)
                print(f"[clipper:facecam] facecam_applied mode=pip source={source}", flush=True)
                return ClipLayoutApplyResult(pip_out, True)
            except Exception as e:
                print(
                    f"[clipper:facecam] facecam_fallback mode=pip err={type(e).__name__}:{str(e)[:120]}",
                    flush=True,
                )
        else:
            print("[clipper:facecam] facecam_fallback mode=pip reason=no_facecam_box", flush=True)

    if layout_mode in ("fit_blur", "full_frame", "fit_top"):
        from clips_worker.streamer.layout.stream_frame import render_stream_clip_layout

        mode = "fit_top" if layout_mode == "fit_top" else "fit_blur"
        out = work_dir / "stream_fit_layout.mp4"
        try:
            render_stream_clip_layout(clip_src, out, edits, mode, play_w=play_w, play_h=play_h)
            print(f"[clipper:layout] static_frame mode={mode}", flush=True)
            return ClipLayoutApplyResult(out, True)
        except Exception as e:
            print(f"[clipper:layout] static_frame_fallback mode={mode} err={type(e).__name__}", flush=True)

    if layout_mode in ("center_crop", "fill"):
        out = work_dir / "center_fill_layout.mp4"
        layout_ed = edits.get("layout") if isinstance(edits.get("layout"), dict) else {}
        crop_box = layout_ed.get("cropBox") if isinstance(layout_ed.get("cropBox"), dict) else None
        try:
            _render_center_fill(clip_src, out, play_w=play_w, play_h=play_h, crop_box=crop_box)
            print("[clipper:layout] center_fill_applied", flush=True)
            return ClipLayoutApplyResult(out, True)
        except Exception as e:
            print(f"[clipper:layout] center_fill_fallback err={type(e).__name__}", flush=True)

    return ClipLayoutApplyResult(clip_src, False)


def caption_edits_for_seam(
    cap_edits: dict,
    *,
    play_h: int,
    stack_split: float,
    facecam_position: str = "top",
) -> dict:
    from clips_worker.streamer.layout.caption_anchor import caption_margin_v

    align, margin_v = caption_margin_v(
        "seam",
        stack_split=stack_split,
        frame_h=play_h,
        facecam_position=facecam_position,
    )
    base = dict(cap_edits) if isinstance(cap_edits, dict) else {}
    return {
        **base,
        "position": "bottom",
        "_assAlignment": align,
        "_assMarginV": margin_v,
        "captionSeamStack": True,
        "stackSplit": stack_split,
    }
