"""Burn export-only Stream headline template (banner, in-video source bar, channel URL)."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from clips_worker.overlay_geometry import GEOM
from clips_worker.stream_headline_ass import burn_stream_headline, format_headline_for_export

_eb = GEOM["exportBar"]
_plats = GEOM["platforms"]
# Parity with new-app/lib/clips/export-template.ts
_HEADLINE_TEXT_MIN_Y = dict(_eb.get("headlineTextMinY") or {})
_BAR_FRAC = float(_eb["barFrac"])
_FOOTER_FRAC = float(_eb["footerFrac"])
_SOURCE_INSET_Y = int(_eb["sourceInsetY"])
_FONT_LINK = int(_eb["fontLink"])
_BADGE_W = int(_eb["badgeW"])
_BADGE_H = int(_eb["badgeH"])
_text_anchor_frac = float(_eb.get("textAnchorFrac") or 0.55)
_text_min_pad_px = int(_eb.get("textMinPadPx") or 48)


def _esc_drawtext(s: str) -> str:
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def _scale_y(px: int, play_h: int) -> int:
    return max(1, int(round(px * play_h / 1920)))


def _probe_duration_ms(video: Path) -> int:
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(video),
            ],
            text=True,
            timeout=30,
        )
        data = json.loads(out)
        dur = float((data.get("format") or {}).get("duration") or 60)
        return max(1000, int(dur * 1000))
    except Exception:
        return 60_000


def stream_headline_frame_layout(play_w: int, play_h: int) -> dict[str, int]:
    """White banner ~20%, video middle, black caption footer ~28%."""
    bar_h = int(round(play_h * _BAR_FRAC))
    footer_h = int(round(play_h * _FOOTER_FRAC))
    video_h = max(1, play_h - bar_h - footer_h)
    return {"bar_h": bar_h, "video_h": video_h, "footer_h": footer_h, "video_y": bar_h}


def headline_layout(platform_id: str | None, play_w: int, play_h: int) -> tuple[int, int]:
    """Legacy: bar height + text anchor (export safe zones)."""
    lay = stream_headline_frame_layout(play_w, play_h)
    pid = (platform_id or "tiktok").strip()
    text_min = _scale_y(_HEADLINE_TEXT_MIN_Y.get(pid, 260), play_h)
    bar_h = max(lay["bar_h"], text_min + _scale_y(_text_min_pad_px, play_h))
    text_y = int(bar_h * _text_anchor_frac)
    return bar_h, text_y


def fit_16x9_rect(play_w: int, play_h: int) -> tuple[int, int, int, int]:
    fg_w = play_w
    fg_h = int(round(fg_w * 9 / 16))
    if fg_h > play_h:
        fg_h = play_h
        fg_w = int(round(fg_h * 16 / 9))
    fg_x = (play_w - fg_w) // 2
    fg_y = (play_h - fg_h) // 2
    return fg_x, fg_y, fg_w, fg_h


def _hex_to_drawtext(color: str) -> str:
    c = (color or "").strip()
    if c.startswith("#") and len(c) >= 7:
        return "0x" + c[1:7].upper()
    if c.startswith("0x"):
        return c
    return "0x9146FF"


def _platform_label(platform: str) -> tuple[str, str]:
    p = (platform or "").lower()
    if p == "kick":
        meta = _plats.get("kick") or {}
        return str(meta.get("label") or "KICK"), _hex_to_drawtext(str(meta.get("color") or "#53FC18"))
    if p == "twitch":
        meta = _plats.get("twitch") or {}
        return str(meta.get("label") or "TWITCH"), _hex_to_drawtext(str(meta.get("color") or "#9146FF"))
    meta = _plats.get("default") or {}
    return str(meta.get("label") or "LIVE"), _hex_to_drawtext(str(meta.get("color") or "#9146FF"))


def export_template_overlays_active(tpl: dict | None) -> bool:
    """Mirror new-app/lib/clips/export-template.ts exportTemplateOverlaysActive."""
    if not tpl or not isinstance(tpl, dict):
        return False
    hb = tpl.get("headlineBar") if isinstance(tpl.get("headlineBar"), dict) else {}
    if hb.get("enabled") and (str(hb.get("text") or "").strip() or str(tpl.get("suggestedHeadline") or "").strip()):
        return True
    pb = tpl.get("platformBadge") if isinstance(tpl.get("platformBadge"), dict) else {}
    if pb.get("enabled"):
        return True
    cl = tpl.get("channelLink") if isinstance(tpl.get("channelLink"), dict) else {}
    if cl.get("enabled") and str(cl.get("url") or "").strip():
        return True
    return False


def apply_export_template(
    video: Path,
    out: Path,
    edits: dict,
    *,
    play_w: int,
    play_h: int,
    layout_mode: str = "speaker_follow",
    stream_stack: bool = False,
) -> Path:
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else None
    if not tpl:
        return video

    split_layouts = {"split", "grid3", "grid4", "dynamic", "screen_pip", "split_debate", "grid", "two_up"}
    allow_headline = layout_mode not in split_layouts and not stream_stack

    headline_on = allow_headline and bool((tpl.get("headlineBar") or {}).get("enabled"))
    hb = tpl.get("headlineBar") or {}
    headline = str(hb.get("text") or tpl.get("suggestedHeadline") or "").strip()

    badge_on = bool((tpl.get("platformBadge") or {}).get("enabled"))
    link_on = bool((tpl.get("channelLink") or {}).get("enabled"))
    link_url = str((tpl.get("channelLink") or {}).get("url") or "").strip()
    platform = str(tpl.get("platform") or "twitch")

    source_on = badge_on or (link_on and link_url)
    if not headline_on and not source_on:
        return video

    frame = stream_headline_frame_layout(play_w, play_h)
    bar_h = frame["bar_h"]
    video_h = frame["video_h"]
    video_y = frame["video_y"]
    duration_ms = _probe_duration_ms(video)

    work = video.parent / "export_tpl_stage.mp4"
    stage = video.parent / "export_tpl_composed.mp4"

    from clips_worker.filtergraph import fit_blur_overlay_filter

    use_blur_fill = layout_mode in ("full_frame", "fit_blur")
    # 1) Stack: black 9:16, video band (blurred fill for full_frame), optional white headline bar on top
    if use_blur_fill:
        fc = (
            f"color=c=black:s={play_w}x{video_h}:d={duration_ms / 1000:.3f}[bg];"
            f"{fit_blur_overlay_filter('0:v', 'vid', play_w, video_h)};"
            f"[bg][vid]overlay=0:0[v1];"
            f"[v1]pad={play_w}:{play_h}:0:{video_y}:black[v1p];"
        )
        v1_label = "[v1p]"
    else:
        fc = (
            f"color=c=black:s={play_w}x{play_h}:d={duration_ms / 1000:.3f}[bg];"
            f"[0:v]scale={play_w}:{video_h}:force_original_aspect_ratio=increase,"
            f"crop={play_w}:{video_h}:(iw-{play_w})/2:(ih-{video_h})/2[vid];"
            f"[bg][vid]overlay=0:{video_y}[v1];"
        )
        v1_label = "[v1]"
    if headline_on and headline:
        fc += f"{v1_label}drawbox=x=0:y=0:w={play_w}:h={bar_h}:color=white@1:t=fill[vout]"
        vmap = "[vout]"
    else:
        vmap = v1_label

    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video),
            "-filter_complex",
            fc,
            "-map",
            vmap,
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "copy",
            str(stage),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    current = stage
    if headline_on and headline:
        hl_out = video.parent / "export_tpl_headline.mp4"
        burn_stream_headline(
            current,
            hl_out,
            format_headline_for_export(headline),
            play_w=play_w,
            play_h=play_h,
            bar_h=bar_h,
            duration_ms=duration_ms,
        )
        current = hl_out

    if source_on:
        label, color = _platform_label(platform)
        display = link_url.replace("https://", "").replace("http://", "").upper() if link_on and link_url else ""
        badge_y = video_y + video_h - _scale_y(_BADGE_H + _SOURCE_INSET_Y, play_h)
        badge_x = _scale_y(16, play_w)
        bw = _scale_y(_BADGE_W, play_w)
        bh = _scale_y(_BADGE_H, play_h)
        fs_badge = _scale_y(18, play_h)
        fs_link = _scale_y(_FONT_LINK, play_h)
        link_x = badge_x + bw + _scale_y(12, play_w) if badge_on else badge_x
        parts = [f"[0:v]"]
        if badge_on:
            parts.append(
                f"drawbox=x={badge_x}:y={badge_y}:w={bw}:h={bh}:color={color}@0.98:t=fill,"
                f"drawtext=text='{_esc_drawtext(label)}':fontsize={fs_badge}:fontcolor=white:"
                f"x={badge_x + _scale_y(10, play_w)}:y={badge_y + _scale_y(8, play_h)}"
            )
        if display:
            sep = "," if badge_on else ""
            parts.append(
                f"{sep}drawtext=text='{_esc_drawtext(display[:48])}':fontsize={fs_link}:"
                f"fontcolor=white@0.95:x={link_x}:y={badge_y + _scale_y(10, play_h)}"
            )
        parts.append("[vout]")
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-i",
                str(current),
                "-filter_complex",
                "".join(parts),
                "-map",
                "[vout]",
                "-map",
                "0:a?",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-c:a",
                "copy",
                str(work),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        current = work

    import shutil

    shutil.copy(current, out)
    return out
