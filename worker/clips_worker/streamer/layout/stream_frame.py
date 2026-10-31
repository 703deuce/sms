"""Stream clip layouts: fit_blur (centered) and fit_top (headline band + video + blur footer)."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from clips_worker.clip_export_template import _esc_drawtext, _platform_label, _headline_style_from_edits
from clips_worker.filtergraph import fit_blur_bg_chain, fit_blur_overlay_filter, fit_blur_strength
from clips_worker.stream_headline_ass import burn_stream_headline, format_headline_for_export
from clips_worker.streamer.layout.stream_overlay_layout import (
    PLAY_H,
    PLAY_W,
    headline_box_height,
    overlay_layout,
)


def _probe_duration_s(video: Path) -> float:
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
        return max(0.1, float(json.loads(out).get("format", {}).get("duration") or 60))
    except Exception:
        return 60.0


def _headline_lines_from_edits(edits: dict) -> list[str]:
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
    hb = tpl.get("headlineBar") if isinstance(tpl.get("headlineBar"), dict) else {}
    if not hb.get("enabled"):
        return []
    raw = str(hb.get("text") or tpl.get("suggestedHeadline") or "").strip()
    if not raw:
        return []
    formatted = format_headline_for_export(raw)
    from clips_worker.stream_headline_ass import _wrap_headline_lines

    body = formatted
    return _wrap_headline_lines(body.split("  ")[0] if "  " in body else body)


def render_fit_blur_stream(
    src: Path, dest: Path, *, play_w: int = PLAY_W, play_h: int = PLAY_H, blur_strength: str | None = None
) -> None:
    dur = _probe_duration_s(src)
    fc = fit_blur_overlay_filter("0:v", "vout", play_w, play_h, blur_strength)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(src),
            "-filter_complex",
            fc,
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
            "aac",
            "-movflags",
            "+faststart",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _compose_layout(
    edits: dict,
    headline_line_count: int,
    *,
    play_w: int = PLAY_W,
    play_h: int = PLAY_H,
) -> dict[str, int]:
    """Rick fit_top overlay for stream compose (editor + export parity)."""
    mode = str((edits.get("layout") or {}).get("mode") or "speaker_follow").strip()
    if mode == "fit_top":
        return overlay_layout(headline_line_count, play_w=play_w, play_h=play_h)
    from clips_worker.layout_router import export_stream_headline_compose_active

    if export_stream_headline_compose_active(edits):
        return overlay_layout(headline_line_count, play_w=play_w, play_h=play_h)
    return overlay_layout(max(2, headline_line_count or 2), play_w=play_w, play_h=play_h)


def fit_top_headline_band_filters(
    *,
    lay: dict[str, int],
    play_w: int,
    h_box: int,
    box_color: str,
    headline_style: dict | None,
    work_dir: Path,
) -> str:
    """Headline band: full-width drawbox or rounded PNG when styled."""
    from clips_worker.clip_export_template import _headline_uses_styled_box
    from clips_worker.overlay_geometry import _hex_ffmpeg_color

    fill = _hex_ffmpeg_color(box_color, fallback="white")
    y = int(lay["headline_top"])
    style = headline_style if isinstance(headline_style, dict) else {}
    if _headline_uses_styled_box(style):
        from clips_worker.layer_sprites import headline_box_overlay_x, render_headline_box_png

        width_pct = int(style.get("widthPct") or 100)
        box_w = max(2, round(play_w * width_pct / 100.0))
        box_x = headline_box_overlay_x(play_w, width_pct)
        hl_png = work_dir / "fit_top_headline_box.png"
        render_headline_box_png(
            box_w, h_box, str(style.get("boxColor") or box_color), int(style.get("radiusPx") or 0), hl_png
        )
        hl_path = str(hl_png).replace("\\", "/").replace(":", "\\:")
        return (
            f"movie={hl_path}:loop=0,setpts=N/FRAME_RATE/TB[hlbox];"
            f"[bg0][hlbox]overlay=x={box_x}:y={y}:shortest=1[bg1]"
        )
    return f"[bg0]drawbox=x=0:y={y}:w={play_w}:h={h_box}:color={fill}:t=fill[bg1]"


def _fit_top_base(
    src: Path,
    stage: Path,
    *,
    lay: dict[str, int],
    dur: float,
    play_w: int,
    play_h: int,
    vid_y: int,
    vid_h: int,
    h_box: int,
    box_color: str = "white",
    headline_style: dict | None = None,
    blur_strength: str | None = None,
) -> None:
    band = fit_top_headline_band_filters(
        lay=lay,
        play_w=play_w,
        h_box=h_box,
        box_color=box_color,
        headline_style=headline_style,
        work_dir=stage.parent,
    )
    fc = (
        f"[0:v]{fit_blur_bg_chain(play_w, play_h, blur_strength)}[bgfull];"
        f"[0:v]scale={play_w}:{vid_h}:force_original_aspect_ratio=increase,"
        f"crop={play_w}:{vid_h}:(iw-{play_w})/2:(ih-{vid_h})/2[fg];"
        f"color=c=black:s={play_w}x{play_h}:d={dur:.3f}[base];"
        f"[base][bgfull]overlay=0:0[bg0];"
        f"{band};"
        f"[bg1][fg]overlay=0:{vid_y}[v1]"
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(src),
            "-filter_complex",
            fc,
            "-map",
            "[v1]",
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            str(stage),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _fit_top_band_layers(
    current: Path,
    dest: Path,
    edits: dict,
    *,
    lay: dict[str, int],
    dur: float,
    lines: list[str],
    play_w: int,
    play_h: int,
    h_box: int,
    tpl: dict,
    platform: str,
    badge_on: bool,
    link_on: bool,
    channel: str,
) -> None:
    text_box_x: int | None = None
    text_box_w: int | None = None
    from clips_worker.clip_export_template import _v3_badge_sprite_will_render

    badge_draw = badge_on and not _v3_badge_sprite_will_render(edits)
    if badge_draw:
        from clips_worker.overlay_geometry import badge_rect, _scale_px

        label, color = _platform_label(platform)
        name = channel or label
        badge_text = name if badge_on else ""
        rect = badge_rect(
            "fit_top_band",
            play_w,
            play_h,
            text=badge_text[:24],
            show_logo=False,
            anchor_top_gap=True,
        )
        gap = max(8, _scale_px(12, play_w))
        text_box_x = rect["x"] + rect["w"] + gap
        text_box_w = max(2, play_w - text_box_x - _scale_px(16, play_w))
    if lines:
        hl = dest.parent / "fit_top_headline.mp4"
        style = _headline_style_from_edits(edits)
        burn_stream_headline(
            current,
            hl,
            format_headline_for_export(
                str((tpl.get("headlineBar") or {}).get("text") or tpl.get("suggestedHeadline") or "")
            ),
            play_w=play_w,
            play_h=play_h,
            bar_h=h_box,
            duration_ms=int(dur * 1000),
            bar_y=lay["headline_top"],
            fit_top=True,
            text_color=str(style.get("textColor") or "#000000"),
            box_color=str(style.get("boxColor") or "#FFFFFF"),
            headline_style=style,
            text_box_x=text_box_x,
            text_box_w=text_box_w,
        )
        current = hl
    if _v3_badge_sprite_will_render(edits):
        badge_on = False
        channel = ""
    if badge_on or channel:
        from clips_worker.overlay_geometry import badge_rect, _scale_px

        label, color = _platform_label(platform)
        name = channel or label
        badge_text = name if badge_on else ""
        rect = badge_rect(
            "fit_top_band",
            play_w,
            play_h,
            text=badge_text[:24],
            show_logo=False,
            video_y=lay["video_y"],
            video_h=lay["video_h"],
            anchor_top_gap=True,
        )
        badge_x = rect["x"]
        badge_y = rect["y"]
        bw, bh = rect["w"], rect["h"]
        dt = (
            f"[0:v]drawbox=x={badge_x}:y={badge_y}:w={bw}:h={bh}:color={color}@0.95:t=fill,"
            f"drawtext=text='{_esc_drawtext(badge_text[:24] or label)}':fontsize=28:fontcolor=white:"
            f"x={badge_x + 8}:y={badge_y + 4}[vout]"
        )
        badged = dest.parent / "fit_top_badge.mp4"
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-i",
                str(current),
                "-filter_complex",
                dt,
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
                str(badged),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        current = badged
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-i", str(current), "-c", "copy", "-movflags", "+faststart", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def render_fit_top_stream(
    src: Path,
    dest: Path,
    edits: dict,
    *,
    play_w: int = PLAY_W,
    play_h: int = PLAY_H,
) -> None:
    lines = _headline_lines_from_edits(edits)
    lay = _compose_layout(edits, max(2, len(lines) or 2), play_w=play_w, play_h=play_h)
    dur = _probe_duration_s(src)
    vid_y = lay["video_y"]
    vid_h = lay["video_h"]
    h_box = lay["headline_h"]
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
    platform = str(tpl.get("platform") or "twitch")
    badge_on = bool((tpl.get("platformBadge") or {}).get("enabled"))
    link_on = bool((tpl.get("channelLink") or {}).get("enabled"))
    channel = ""
    if link_on:
        url = str((tpl.get("channelLink") or {}).get("url") or "")
        channel = url.rstrip("/").split("/")[-1].upper()[:32] if url else ""

    from clips_worker.clip_export_template import _v3_badge_sprite_will_render

    if _v3_badge_sprite_will_render(edits):
        badge_on = False
        channel = ""

    stage = dest.parent / "fit_top_stage.mp4"
    style = _headline_style_from_edits(edits)
    box_color = str(style.get("boxColor") or "#FFFFFF")
    _fit_top_base(
        src,
        stage,
        lay=lay,
        dur=dur,
        play_w=play_w,
        play_h=play_h,
        vid_y=vid_y,
        vid_h=vid_h,
        h_box=h_box,
        box_color=box_color,
        headline_style=style,
        blur_strength=fit_blur_strength(edits),
    )
    current = stage
    _fit_top_band_layers(
        current,
        dest,
        edits,
        lay=lay,
        dur=dur,
        lines=lines,
        play_w=play_w,
        play_h=play_h,
        h_box=h_box,
        tpl=tpl,
        platform=platform,
        badge_on=badge_on,
        link_on=link_on,
        channel=channel,
    )


def render_stream_clip_layout(
    src: Path,
    dest: Path,
    edits: dict,
    layout_mode: str,
    *,
    play_w: int = PLAY_W,
    play_h: int = PLAY_H,
) -> None:
    mode = (layout_mode or "fit_blur").strip()
    if mode == "fit_top":
        render_fit_top_stream(src, dest, edits, play_w=play_w, play_h=play_h)
        return
    from clips_worker.clip_export_template import export_headline_active

    if mode == "fit_blur" and export_headline_active(edits):
        render_fit_top_stream(src, dest, edits, play_w=play_w, play_h=play_h)
        return
    render_fit_blur_stream(src, dest, play_w=play_w, play_h=play_h, blur_strength=fit_blur_strength(edits))
