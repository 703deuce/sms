"""Apply clip edits on source timeline (ms), then reframe, cut, and caption."""
from __future__ import annotations

import hashlib
import json
import logging
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

_log = logging.getLogger(__name__)

from clips_worker.caption_words import build_caption_words, caption_words_to_render
from clips_worker.layout_router import (
    editor_mode_uses_static_fit_blur,
    editor_mode_uses_stream_frame,
    export_stream_headline_compose_active,
    needs_per_segment_layout_export,
    normalize_layout_segments,
    speakercrop_settings_for_layout_mode,
    speakercrop_settings_from_edits,
    stream_compose_layout_mode,
)
from clips_worker.render_clip import run_speakercrop
from clips_worker.chat_overlay_apply import try_apply_chat_overlay

V3 = Path(__import__("os").environ.get("SPEAKERCROP_DIR", "/app/v3"))


def _sort_json(value):
    if isinstance(value, list):
        return [_sort_json(v) for v in value]
    if isinstance(value, dict):
        return {k: _sort_json(value[k]) for k in sorted(value.keys())}
    return value


def edits_version_hash(edits: dict) -> str:
    body = json.dumps(_sort_json(edits), separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(body.encode()).hexdigest()


def emphasis_indexes_for_zoom(words: list[dict], cap_edits: dict) -> list[int]:
    """Pick word indexes for auto-zoom (keywords + hook window)."""
    from clips_worker.caption_keyword_emphasis import auto_caption_emphasis_indexes

    explicit = cap_edits.get("emphasis") if isinstance(cap_edits.get("emphasis"), list) else []
    if explicit:
        return [int(x) for x in explicit]
    if not cap_edits.get("keywordHighlight") and not cap_edits.get("autoEmojis"):
        return []
    auto = auto_caption_emphasis_indexes(words, {"captions": cap_edits})
    if auto:
        return auto
    out: list[int] = []
    for w in words:
        if float(w.get("s", 0)) > 1.5:
            break
        idx = w.get("i", w.get("idx"))
        if idx is not None:
            out.append(int(idx))
            break
    return out


def default_edits(clip_start_ms: int, clip_end_ms: int) -> dict:
    return {
        "v": 2,
        "trim": {"in": clip_start_ms, "out": clip_end_ms},
        "cutRanges": [],
        "wordFixes": {},
        "captions": {"enabled": True, "presetId": "bold_pop"},
        "layout": {"mode": "speaker_follow", "shotOverrides": [], "layoutSegments": []},
    }


def migrate_edits(raw: dict, clip_start_ms: int, clip_end_ms: int) -> dict:
    clip_len = clip_end_ms - clip_start_ms
    trim = raw.get("trim") or {}
    tin = int(trim.get("in", 0))
    tout = int(trim.get("out", clip_len))
    if tout <= clip_len + 500 and tin < clip_len:
        cuts = raw.get("cutRanges") or []
        return {
            **raw,
            "trim": {"in": clip_start_ms + tin, "out": clip_start_ms + tout},
            "cutRanges": [[clip_start_ms + c[0], clip_start_ms + c[1]] for c in cuts],
        }
    return raw


def normalize_edits(raw, clip_start_ms: int, clip_end_ms: int) -> dict:
    base = default_edits(clip_start_ms, clip_end_ms)
    if not raw or not isinstance(raw, dict):
        return base
    raw = migrate_edits(raw, clip_start_ms, clip_end_ms)
    trim = raw.get("trim") or {}
    layout = raw.get("layout") or {}
    return {
        **base,
        **raw,
        "v": 2,
        "trim": {
            "in": max(0, int(trim.get("in", base["trim"]["in"]))),
            "out": int(trim.get("out", base["trim"]["out"])),
        },
        "cutRanges": list(raw.get("cutRanges") or []),
        "wordFixes": dict(raw.get("wordFixes") or {}),
        "wordFixMeta": dict(raw.get("wordFixMeta") or {}),
        "layout": {
            **{k: v for k, v in layout.items() if k not in ("shotOverrides", "layoutSegments")},
            "mode": layout.get("mode") or base["layout"]["mode"],
            "shotOverrides": list(layout.get("shotOverrides") or []),
            "layoutSegments": list(layout.get("layoutSegments") or []),
        },
    }


def is_default_edits(edits: dict, clip_start_ms: int, clip_end_ms: int) -> bool:
    d = default_edits(clip_start_ms, clip_end_ms)
    trim_in = int(edits["trim"]["in"])
    trim_out = int(edits["trim"]["out"])
    return (
        edits["trim"]["in"] == d["trim"]["in"]
        and edits["trim"]["out"] == d["trim"]["out"]
        and not edits["cutRanges"]
        and not edits["wordFixes"]
        and not (edits.get("layout") or {}).get("shotOverrides")
        and not normalize_section_order(edits.get("sectionOrder"), trim_in, trim_out)
        and edits.get("loudnessLufs") is None
        and edits.get("speechLevelingEnabled") is not True
        and edits.get("speed") in (None, 1, 1.0)
    )


from clips_worker.clip_keep_segments import keep_segments, normalize_section_order, ordered_keep_segments

def output_duration_ms(edits: dict) -> int:
    segs = keep_segments(int(edits["trim"]["in"]), int(edits["trim"]["out"]), edits.get("cutRanges") or [])
    return sum(b - a for a, b in segs)


def remap_time_ms(t_ms: int, segs: list[tuple[int, int]]) -> int | None:
    acc = 0
    for a, b in segs:
        if a <= t_ms < b:
            return acc + (t_ms - a)
        acc += b - a
    return None


def word_mid_ms(w: dict) -> float:
    return (float(w["s"]) + float(w["e"])) * 500.0


def ensure_word_i(words: list[dict]) -> list[dict]:
    out = []
    for pos, w in enumerate(words):
        wi = w.get("i", w.get("idx", pos))
        row = {**w, "i": int(wi)}
        row.pop("idx", None)
        out.append(row)
    return out


def words_after_edits(words: list[dict], edits: dict) -> tuple[list[dict], list[tuple[int, int]]]:
    segs = ordered_keep_segments(edits)
    words_fallback = bool(edits.get("_wordsFallback"))
    capped = build_caption_words(ensure_word_i(words), edits, words_fallback=words_fallback)
    remapped = caption_words_to_render(capped)
    return remapped, segs


def words_for_reframe(words: list[dict], edits: dict, clip_start_ms: int, clip_end_ms: int) -> list[dict]:
    fixes = edits.get("wordFixes") or {}
    cuts = edits.get("cutRanges") or []
    out: list[dict] = []
    for pos, w in enumerate(words):
        wi = int(w.get("i", w.get("idx", pos)))
        mid = word_mid_ms(w)
        if mid < clip_start_ms or mid >= clip_end_ms:
            continue
        if any(mid >= c[0] and mid < c[1] for c in cuts):
            continue
        key = str(wi)
        out.append(
            {
                "w": fixes.get(key, w["w"]),
                "s": round(float(w["s"]) - clip_start_ms / 1000.0, 3),
                "e": round(float(w["e"]) - clip_start_ms / 1000.0, 3),
                "p": w.get("p", 1),
                "spk": w.get("spk"),
            }
        )
    return out


def build_srt(words: list[dict]) -> str:
    lines: list[str] = []
    idx = 1
    for w in words:
        if not str(w.get("w", "")).strip():
            continue
        if float(w["e"]) <= float(w["s"]):
            continue
        lines.append(str(idx))
        lines.append(f"{_srt_time(w['s'])} --> {_srt_time(w['e'])}")
        lines.append(str(w["w"]))
        lines.append("")
        idx += 1
    return "\n".join(lines)


def _srt_time(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int((sec % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def ffmpeg_concat_segments(src: Path, dest: Path, segs_sec: list[tuple[float, float]]) -> None:
    if not segs_sec:
        raise RuntimeError("no segments")
    if len(segs_sec) == 1:
        a, b = segs_sec[0]
        subprocess.check_call(
            ["ffmpeg", "-y", "-v", "error", "-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-i", str(src), "-c", "copy", str(dest)],
        )
        return
    parts: list[str] = []
    for i, (a, b) in enumerate(segs_sec):
        dur = b - a
        parts.append(f"[0:v]trim=start={a}:end={b},setpts=PTS-STARTPTS[v{i}]")
        parts.append(
            f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,"
            f"afade=t=in:d=0.01,afade=t=out:st={max(0, dur - 0.01):.3f}:d=0.01[a{i}]"
        )
    concat_in = "".join(f"[v{i}][a{i}]" for i in range(len(segs_sec)))
    fc = ";".join(parts) + f";{concat_in}concat=n={len(segs_sec)}:v=1:a=1[v][a]"
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
            "[v]",
            "-map",
            "[a]",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            str(dest),
        ],
    )


def ffmpeg_trim_clip_segment(src: Path, dest: Path, start_s: float, end_s: float) -> None:
    if end_s - start_s < 0.08:
        raise RuntimeError("layout segment too short")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-ss",
            f"{start_s:.3f}",
            "-to",
            f"{end_s:.3f}",
            "-i",
            str(src),
            "-c",
            "copy",
            str(dest),
        ],
    )


def _filter_words_for_layout_segment(words: list[dict], seg_start_ms: int, seg_end_ms: int, clip_start_ms: int) -> list[dict]:
    """Words are clip-relative seconds (see words_for_reframe)."""
    out: list[dict] = []
    seg_start_s = (seg_start_ms - clip_start_ms) / 1000.0
    for w in words:
        mid_source_ms = clip_start_ms + word_mid_ms(w) * 1000.0
        if mid_source_ms < seg_start_ms or mid_source_ms >= seg_end_ms:
            continue
        rel_s = float(w["s"]) - seg_start_s
        rel_e = float(w["e"]) - seg_start_s
        out.append({**w, "s": round(max(0, rel_s), 3), "e": round(max(rel_s + 0.01, rel_e), 3)})
    return out


def _maybe_static_fit_blur_crop_track(
    clip_src: Path,
    work_dir: Path,
    clip_start_ms: int,
    editor_mode: str,
) -> Path | None:
    if not editor_mode_uses_static_fit_blur(editor_mode):
        return None
    from clips_worker.pipeline import write_fit_blur_crop_track

    track = work_dir / f"static_fit_blur_{editor_mode}.crop_track.json"
    write_fit_blur_crop_track(clip_src, track, clip_start_ms)
    return track


def _preview_crop_track_for_export(edits: dict, preview_crop_track: Path | None) -> Path | None:
    dom_mode = str((edits.get("layout") or {}).get("mode") or "speaker_follow")
    if editor_mode_uses_static_fit_blur(dom_mode):
        return None
    if preview_crop_track is not None and preview_crop_track.is_file():
        return preview_crop_track
    return None


def run_speakercrop_layout_timeline(
    clip_src: Path,
    out_mp4: Path,
    words_clip_relative: list[dict],
    settings: dict,
    edits: dict,
    work_dir: Path,
    clip_start_ms: int,
    clip_end_ms: int,
    shot_overrides: list | None = None,
    render_id: str | None = None,
    render_meta: dict | None = None,
    *,
    conn=None,
    workspace_id: str | None = None,
    project_id: str | None = None,
    clip_id: str | None = None,
    preview_crop_track: Path | None = None,
) -> Path:
    """Export speakercrop honoring per-segment layout modes when they differ."""
    from clips_worker.clip_layout_render import speakercrop_settings_band_height
    from clips_worker.render_clip import aspect_size

    aspect = settings.get("aspectRatio", "9:16")
    resolution = settings.get("exportResolution", "720p")
    play_w, play_h = aspect_size(aspect, resolution)
    if not needs_per_segment_layout_export(edits):
        sc_settings = speakercrop_settings_band_height(
            speakercrop_settings_from_edits(settings, edits),
            edits,
            play_w=play_w,
            play_h=play_h,
        )
        wpath = work_dir / "words_export.json"
        wpath.write_text(json.dumps(words_clip_relative))
        dom_mode = str((edits.get("layout") or {}).get("mode") or "speaker_follow")
        from clips_worker.layout_router import editor_mode_uses_static_fit_blur

        if editor_mode_uses_static_fit_blur(dom_mode):
            crop_track = _maybe_static_fit_blur_crop_track(clip_src, work_dir, clip_start_ms, dom_mode)
        elif preview_crop_track is not None and preview_crop_track.is_file():
            crop_track = preview_crop_track
        else:
            crop_track = None
        run_speakercrop(
            clip_src,
            out_mp4,
            wpath,
            sc_settings,
            work_dir,
            clip_start_ms=clip_start_ms,
            shot_overrides=shot_overrides,
            render_id=render_id,
            render_meta=render_meta,
            crop_track_out=crop_track,
            preserve_existing_crop_track=bool(crop_track),
            conn=conn,
            workspace_id=workspace_id,
            project_id=project_id,
            clip_id=clip_id,
        )
        return out_mp4

    segs = normalize_layout_segments(edits)
    clip_len_s = max(0.08, (clip_end_ms - clip_start_ms) / 1000.0)
    part_paths: list[Path] = []
    for i, seg in enumerate(segs):
        rel_a = max(0.0, (int(seg["startMs"]) - clip_start_ms) / 1000.0)
        rel_b = min(clip_len_s, (int(seg["endMs"]) - clip_start_ms) / 1000.0)
        if rel_b - rel_a < 0.08:
            continue
        trimmed = work_dir / f"layout_in_{i}.mp4"
        part_out = work_dir / f"layout_out_{i}.mp4"
        ffmpeg_trim_clip_segment(clip_src, trimmed, rel_a, rel_b)
        seg_words = _filter_words_for_layout_segment(
            words_clip_relative,
            int(seg["startMs"]),
            int(seg["endMs"]),
            clip_start_ms,
        )
        seg_wpath = work_dir / f"layout_words_{i}.json"
        seg_wpath.write_text(json.dumps(seg_words))
        seg_mode = str(seg["mode"])
        seg_settings = speakercrop_settings_band_height(
            speakercrop_settings_for_layout_mode(settings, seg_mode),
            edits,
            play_w=play_w,
            play_h=play_h,
        )
        crop_track = _maybe_static_fit_blur_crop_track(trimmed, work_dir, int(seg["startMs"]), seg_mode)
        run_speakercrop(
            trimmed,
            part_out,
            seg_wpath,
            seg_settings,
            work_dir,
            clip_start_ms=int(seg["startMs"]),
            shot_overrides=shot_overrides,
            render_id=render_id,
            render_meta=render_meta,
            crop_track_out=crop_track,
            preserve_existing_crop_track=bool(crop_track),
            conn=conn,
            workspace_id=workspace_id,
            project_id=project_id,
            clip_id=clip_id,
        )
        part_paths.append(part_out)

    if not part_paths:
        sc_settings = speakercrop_settings_band_height(
            speakercrop_settings_from_edits(settings, edits),
            edits,
            play_w=play_w,
            play_h=play_h,
        )
        wpath = work_dir / "words_export.json"
        wpath.write_text(json.dumps(words_clip_relative))
        run_speakercrop(
            clip_src,
            out_mp4,
            wpath,
            sc_settings,
            work_dir,
            clip_start_ms=clip_start_ms,
            shot_overrides=shot_overrides,
            render_id=render_id,
            render_meta=render_meta,
            conn=conn,
            workspace_id=workspace_id,
            project_id=project_id,
            clip_id=clip_id,
        )
        return out_mp4
    if len(part_paths) == 1:
        shutil.copy(part_paths[0], out_mp4)
        return out_mp4
    lst = work_dir / "layout_concat.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in part_paths))
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(lst),
            "-c",
            "copy",
            str(out_mp4),
        ],
    )
    return out_mp4


def probe_video_size(video: Path) -> tuple[int, int]:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0:s=x",
            str(video),
        ],
        text=True,
    ).strip()
    w, h = out.split("x")
    return int(w), int(h)


def burn_captions(
    video: Path,
    words: list[dict],
    out: Path,
    work_dir: Path,
    edits_captions: dict | None = None,
    play_w: int | None = None,
    play_h: int | None = None,
) -> None:
    from clips_worker.captions_ass import build_ass, resolve_preset, margin_v_px

    if play_w is None or play_h is None:
        play_w, play_h = probe_video_size(video)

    ass = work_dir / "cap.ass"
    cap = edits_captions if isinstance(edits_captions, dict) else {}
    if not cap.get("presetId") and not cap.get("preset"):
        cap = {**cap, "presetId": "bold_pop", "animation": "pop"}
    build_ass(words, cap, ass, play_w=play_w, play_h=play_h)
    fontsdir = V3 / "fonts"
    emoji_by_word = cap.get("emojiByWord") if isinstance(cap.get("emojiByWord"), dict) else {}
    emoji_events: list = []
    if emoji_by_word:
        from clips_worker.caption_emoji_overlay import emoji_events_from_words

        preset = resolve_preset(cap.get("presetId") or cap.get("preset"))
        size_pct = float(cap.get("size") or cap.get("sizePct") or preset["sizePct"])
        if size_pct < 3:
            size_pct = float(preset["sizePct"])
        size_pct = max(3.0, min(12.0, size_pct))
        fontsize = round(size_pct / 100 * play_h)
        position = cap.get("position") or preset["position"]
        emoji_events = emoji_events_from_words(
            words,
            emoji_by_word,
            play_w=play_w,
            play_h=play_h,
            fontsize=fontsize,
            position=str(position),
        )
    if emoji_events:
        from clips_worker.caption_emoji_overlay import build_caption_burn_filter_complex

        fc, pngs, vout_label = build_caption_burn_filter_complex(
            ass_path=ass,
            fontsdir=fontsdir,
            emoji_events=emoji_events,
        )
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video)]
        for png in pngs:
            cmd.extend(["-i", str(png)])
        cmd.extend(
            [
                "-filter_complex",
                fc,
                "-map",
                f"[{vout_label}]",
                "-map",
                "0:a?",
                "-c:a",
                "copy",
                str(out),
            ]
        )
        subprocess.check_call(cmd)
    else:
        vf = f"ass={ass}:fontsdir={fontsdir}".replace(",", r"\,")
        subprocess.check_call(
            ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vf", vf, "-c:a", "copy", str(out)],
        )


def _export_vertical_precomposed(edits: dict, ctx: dict) -> bool:
    """Video already sized to the band under the headline (stack/PiP or speaker_follow)."""
    from clips_worker.clip_export_template import export_headline_active

    if not export_headline_active(edits):
        return False
    mode = str((edits.get("layout") or {}).get("mode") or "")
    if mode in ("facecam_stack", "facecam_pip", "screen_pip", "stack"):
        return bool(ctx.get("per_clip_layout_applied"))
    if mode in ("speaker_follow", "subject_follow"):
        return True
    return False


def _per_clip_vertical_stack_layout(edits: dict, ctx: dict) -> bool:
    return _export_vertical_precomposed(edits, ctx)


def _legacy_compose(
    caption_src: Path,
    caption_words: list[dict],
    out_mp4: Path,
    edits: dict,
    ctx: dict,
) -> tuple[Path, list[dict]]:
    work_dir = ctx["work_dir"]
    play_w = ctx["play_w"]
    play_h = ctx["play_h"]
    length_s = ctx["length_s"]
    conn = ctx.get("conn")
    project_id = ctx.get("project_id")
    clip_id = ctx.get("clip_id")
    clip_start_ms = ctx["clip_start_ms"]
    clip_end_ms = ctx["clip_end_ms"]

    layout_mode = str((edits.get("layout") or {}).get("mode") or "speaker_follow")
    stream_frame_applied = False
    zoom_done = False
    spec = ctx.get("compose_spec")
    if spec:
        zoom_cfg = edits.get("zoom") if isinstance(edits.get("zoom"), dict) else {}
        if zoom_cfg.get("enabled"):
            from clips_worker.zoom_render import (
                apply_zoom,
                build_zoom_keyframes,
                clamp_zoom_intensity,
                layout_switch_times_from_words,
            )

            sw, sh = probe_video_size(caption_src)
            cap_edits_pre = edits.get("captions") if isinstance(edits.get("captions"), dict) else {}
            emph = (
                emphasis_indexes_for_zoom(caption_words, cap_edits_pre)
                if isinstance(cap_edits_pre, dict)
                else []
            )
            kf = build_zoom_keyframes(
                caption_words,
                list(emph or []),
                length_s,
                clamp_zoom_intensity(zoom_cfg.get("intensity")),
                layout_switches=layout_switch_times_from_words(caption_words),
            )
            zsrc = work_dir / "spec_zoomed_src.mp4"
            apply_zoom(
                caption_src,
                zsrc,
                kf,
                length_s,
                sw,
                sh,
                facecam_only=bool(zoom_cfg.get("facecamOnly")),
            )
            caption_src = zsrc
        from clips_worker.compose_spec_render import render_stream_band

        layout_mp4 = work_dir / "spec_stream_band.mp4"
        render_stream_band(caption_src, layout_mp4, spec, work_dir, length_s)
        caption_src = layout_mp4
        stream_frame_applied = True
        zoom_done = True
    elif export_stream_headline_compose_active(edits):
        if _per_clip_vertical_stack_layout(edits, ctx):
            pass
        elif editor_mode_uses_stream_frame(layout_mode):
            if not ctx.get("per_clip_layout_applied"):
                from clips_worker.streamer.layout.stream_frame import render_stream_clip_layout

                layout_mp4 = work_dir / "stream_layout.mp4"
                compose_mode = stream_compose_layout_mode(edits)
                render_stream_clip_layout(
                    caption_src, layout_mp4, edits, compose_mode, play_w=play_w, play_h=play_h
                )
                caption_src = layout_mp4
            stream_frame_applied = True

    tpl_censor = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else None
    if tpl_censor and tpl_censor.get("profanityCensor"):
        from clips_worker.profanity_censor import censor_clip_words_and_audio

        caption_words, caption_src = censor_clip_words_and_audio(caption_src, caption_words, work_dir)

    final = work_dir / "final.mp4"
    cap_edits = edits.get("captions") or {}
    if spec and isinstance(spec.get("captions"), dict):
        cap_spec = spec["captions"]
        cap_edits = {
            **cap_edits,
            "marginVPct": cap_spec.get("marginVPct"),
            "position": cap_spec.get("position"),
            "_composeSpecMaxLineWidthPx": cap_spec.get("maxLineWidthPx"),
            "_composeSpecAssFontsize": cap_spec.get("assFontsize"),
        }
    elif ctx.get("facecam_seam_captions") and isinstance(cap_edits, dict):
        from clips_worker.clip_layout_render import caption_edits_for_seam

        cap_edits = caption_edits_for_seam(
            cap_edits,
            play_h=play_h,
            stack_split=float(ctx.get("facecam_stack_split") or 0.4),
            facecam_position=str(ctx.get("facecam_position") or "top"),
        )
    elif (layout_mode == "fit_top" or stream_frame_applied) and isinstance(cap_edits, dict):
        cap_edits = {**cap_edits, "marginVPct": 6, "position": "bottom"}
    if int(cap_edits.get("enabled", True)):
        burn_captions(caption_src, caption_words, final, work_dir, cap_edits, play_w=play_w, play_h=play_h)
        caption_src = final
    branded = work_dir / "branded.mp4"
    brand = edits.get("brand") if isinstance(edits.get("brand"), dict) else None
    logo_key = brand.get("logoKey") if brand else None
    if logo_key:
        from clips_worker.brand_render import apply_brand_logo

        apply_brand_logo(caption_src, branded, logo_key, brand, work_dir)
        shutil.copy(branded, out_mp4)
    elif int(cap_edits.get("enabled", True)):
        shutil.copy(final, out_mp4)
    else:
        shutil.copy(caption_src, out_mp4)

    ho = edits.get("hookOverlay") if isinstance(edits.get("hookOverlay"), dict) else None
    if ho and ho.get("enabled") and str(ho.get("text") or "").strip():
        from clips_worker.hook_overlay import apply_hook_overlay

        hooked = work_dir / "hooked.mp4"
        apply_hook_overlay(out_mp4, hooked, edits, play_w=play_w, play_h=play_h)
        shutil.copy(hooked, out_mp4)

    zoom_cfg = edits.get("zoom") if isinstance(edits.get("zoom"), dict) else {}
    if zoom_cfg.get("enabled") and not zoom_done:
        from clips_worker.zoom_render import (
            apply_zoom,
            build_zoom_keyframes,
            clamp_zoom_intensity,
            layout_switch_times_from_words,
        )

        emphasis = (
            emphasis_indexes_for_zoom(caption_words, cap_edits)
            if isinstance(cap_edits, dict)
            else []
        )
        intensity = clamp_zoom_intensity(zoom_cfg.get("intensity"))
        layout_switches = layout_switch_times_from_words(caption_words)
        kf = build_zoom_keyframes(
            caption_words,
            list(emphasis or []),
            length_s,
            intensity,
            layout_switches=layout_switches,
        )
        zoomed = work_dir / "zoomed.mp4"
        zw, zh = probe_video_size(out_mp4)
        facecam_band_h: int | None = None
        if bool(zoom_cfg.get("facecamOnly")):
            split = float(ctx.get("facecam_stack_split") or 0.4)
            pos = str(ctx.get("facecam_position") or "top").lower()
            if pos == "top":
                facecam_band_h = max(1, int(zh * split))
        apply_zoom(
            out_mp4,
            zoomed,
            kf,
            length_s,
            zw,
            zh,
            facecam_only=bool(zoom_cfg.get("facecamOnly")),
            facecam_band_h=facecam_band_h,
        )
        shutil.copy(zoomed, out_mp4)

    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else None
    per_clip_vertical = _per_clip_vertical_stack_layout(edits, ctx)
    if tpl and not stream_frame_applied and not editor_mode_uses_stream_frame(layout_mode):
        from clips_worker.clip_export_template import apply_export_template

        templated = work_dir / "export_template.mp4"
        result_path = apply_export_template(
            out_mp4,
            templated,
            edits,
            play_w=play_w,
            play_h=play_h,
            layout_mode=layout_mode,
            vertical_precomposed=per_clip_vertical,
            work_dir=work_dir,
        )
        if result_path.resolve() == templated.resolve() and templated.is_file():
            shutil.copy(templated, out_mp4)
        elif result_path.resolve() != out_mp4.resolve() and result_path.is_file():
            shutil.copy(result_path, out_mp4)

    pb = cap_edits.get("progressBar") if isinstance(cap_edits.get("progressBar"), dict) else None
    if pb and pb.get("enabled"):
        from clips_worker.progress_bar import apply_progress_bar

        pb_out = work_dir / "with_progress.mp4"
        apply_progress_bar(
            out_mp4,
            pb_out,
            str(pb.get("color") or "#FFFFFF"),
            str(pb.get("position") or "bottom"),
            int(pb.get("thickness") or 8),
            play_w,
            play_h,
        )
        shutil.copy(pb_out, out_mp4)

    export_sfx_mode = str(edits.get("exportSfx") or "off")
    if export_sfx_mode in ("subtle", "meme"):
        from clips_worker.export_sfx import (
            apply_export_sfx_mix,
            build_export_sfx_events,
            bundled_sfx_available,
        )

        if bundled_sfx_available():
            zoom_kf: list[tuple[float, float]] = [(0.0, 1.0), (length_s, 1.0)]
            emph: list[int] = []
            if zoom_cfg.get("enabled"):
                emph = (
                    emphasis_indexes_for_zoom(caption_words, cap_edits)
                    if isinstance(cap_edits, dict)
                    else []
                )
                from clips_worker.zoom_render import (
                    build_zoom_keyframes,
                    clamp_zoom_intensity,
                    layout_switch_times_from_words,
                )

                zoom_kf = build_zoom_keyframes(
                    caption_words,
                    list(emph or []),
                    length_s,
                    clamp_zoom_intensity(zoom_cfg.get("intensity")),
                    layout_switches=layout_switch_times_from_words(caption_words),
                )
            elif isinstance(cap_edits, dict):
                emph = emphasis_indexes_for_zoom(caption_words, cap_edits)
            events = build_export_sfx_events(
                export_sfx_mode,
                duration_s=length_s,
                zoom_keyframes=zoom_kf,
                caption_words=caption_words,
                emphasis=emph,
            )
            if events:
                sfx_out = work_dir / "export_sfx.mp4"
                apply_export_sfx_mix(out_mp4, sfx_out, events)
                shutil.copy(sfx_out, out_mp4)

    try_apply_chat_overlay(
        out_mp4,
        work_dir,
        conn=conn,
        project_id=project_id or "",
        edits=edits,
        clip_start_ms=clip_start_ms,
        clip_end_ms=clip_end_ms,
        layout_mode=layout_mode,
        clip_id=clip_id,
        play_w=play_w,
        play_h=play_h,
    )
    return out_mp4, caption_words


def _merge_headline_style_burn(burn_edits: dict, layers: list[dict]) -> dict:
    from clips_worker.layers_spec import _layer_by_id

    hl = _layer_by_id(layers, "headline")
    if not hl or not isinstance(hl.get("style"), dict):
        return burn_edits
    out = {**burn_edits}
    tpl = out.get("exportTemplate") if isinstance(out.get("exportTemplate"), dict) else {}
    out["exportTemplate"] = {**tpl, "headlineStyle": hl["style"]}
    return out


def build_v3_extras(layers: list[dict], ctx: dict) -> list[dict]:
    work_dir = ctx["work_dir"]
    play_w = int(ctx["play_w"])
    play_h = int(ctx["play_h"])
    edits = ctx.get("edits") or {}
    layout_mode = str((edits.get("layout") or {}).get("mode") or "speaker_follow")
    from clips_worker.clip_export_template import stream_headline_frame_layout
    from clips_worker.layers_spec import _layer_by_id, _placement, badge_sprite_active
    from clips_worker.layer_sprites import render_badge_png, render_sticker_png
    from clips_worker.overlay_geometry import sticker_rect
    from clips_worker.streamer.layout.stream_overlay_layout import overlay_layout

    frame = stream_headline_frame_layout(play_w, play_h)
    video_y = frame["video_y"]
    video_h = frame["video_h"]
    hl = _layer_by_id(layers, "headline")
    line_count = 2
    if hl and str(hl.get("text") or "").strip():
        line_count = max(2, min(4, len(str(hl.get("text")).split()) // 3 + 1))
    lay = overlay_layout(line_count, play_w=play_w, play_h=play_h)

    sprites: list[dict] = []
    for layer in layers:
        if not layer.get("enabled"):
            continue
        ltype = layer.get("type")
        if ltype == "sticker":
            dest = work_dir / f"sprite_{layer.get('id', 'sticker')}.png"
            render_sticker_png(layer, dest, play_w=play_w, play_h=play_h)
            x_pct = float(layer.get("x") if layer.get("x") is not None else 0.82)
            y_pct = float(layer.get("y") if layer.get("y") is not None else 0.12)
            anchor = str(layer.get("anchor") or "center")
            rect = sticker_rect(play_w, play_h, x_pct, y_pct, anchor=anchor)
            timing = str(layer.get("timing") or "always")
            duration_ms = int(layer.get("durationMs") or 3500)
            sprites.append(
                {
                    "path": dest,
                    "x": rect["x"],
                    "y": rect["y"],
                    "timing": timing,
                    "durationMs": duration_ms,
                }
            )
        elif ltype == "badge" and badge_sprite_active(layer):
            placement = _placement(edits)
            platform = str(layer.get("platform") or "twitch")
            from clips_worker.clip_export_template import _platform_label

            label, _ = _platform_label(platform)
            show_label = bool(layer.get("showLabel"))
            show_logo = bool(layer.get("showLogo"))
            handle = str(layer.get("handle") or layer.get("url") or "").split("/")[-1][:24]
            text = handle.upper() if handle else label
            if not show_label and not show_logo:
                text = label
            badge_text = text if show_label else ""
            dest = work_dir / f"sprite_{layer.get('id', 'badge')}.png"
            render_badge_png(
                layer,
                dest,
                play_w=play_w,
                play_h=play_h,
                placement=placement,
                video_y=lay["video_y"] if placement == "fit_top_band" else video_y,
                video_h=lay["video_h"] if placement == "fit_top_band" else video_h,
                badge_y=lay.get("badge_y"),
            )
            from clips_worker.overlay_geometry import badge_rect
            from clips_worker.clip_export_template import export_headline_active

            headline_in_bar = export_headline_active(edits)
            rect = badge_rect(
                placement,
                play_w,
                play_h,
                text=badge_text,
                show_logo=show_logo,
                video_y=lay["video_y"] if placement == "fit_top_band" else video_y,
                video_h=lay["video_h"] if placement == "fit_top_band" else video_h,
                badge_y=lay.get("badge_y"),
                anchor_top_gap=placement == "fit_top_band",
                headline_in_bar=headline_in_bar if placement == "stack_corner" else False,
            )
            sprites.append({"path": dest, "x": rect["x"], "y": rect["y"]})
    if sprites:
        print(
            f"[clipper:compositor] v3_sprites count={len(sprites)} layout={layout_mode}",
            flush=True,
        )
    return sprites


def apply_v3_sprite_overlays(video: Path, out: Path, sprites: list[dict], work_dir: Path) -> None:
    if not sprites:
        shutil.copy(video, out)
        return
    from clips_worker.clip_export_template import _probe_duration_ms

    duration_s = _probe_duration_ms(video) / 1000.0
    parts: list[str] = []
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video)]
    last = "[0:v]"
    for i, sp in enumerate(sprites):
        cmd.extend(["-i", str(sp["path"])])
        label = f"[v{i}]"
        timing = str(sp.get("timing") or "always")
        duration_ms = int(sp.get("durationMs") or 3500)
        enable = ""
        if timing == "intro":
            enable = f":enable='between(t,0,{duration_ms / 1000.0:.3f})'"
        elif timing == "outro":
            start = max(0.0, duration_s - duration_ms / 1000.0)
            enable = f":enable='gte(t,{start:.3f})'"
        parts.append(
            f"{last}[{i + 1}:v]overlay={sp['x']}:{sp['y']}:format=auto{enable}{label}"
        )
        last = label
    fc = ";".join(parts)
    cmd.extend(
        [
            "-filter_complex",
            fc,
            "-map",
            last,
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-c:a",
            "copy",
            str(out),
        ]
    )
    subprocess.check_call(cmd)


def _facecam_layout_for_render(edits: dict, stream_layout: dict | None = None) -> tuple[dict | None, str]:
    """Backward-compatible wrapper — stream_layout ignored (T5 Part C)."""
    del stream_layout
    from clips_worker.clip_layout_render import facecam_layout_for_render

    return facecam_layout_for_render(edits)


def _apply_facecam_or_pip_layout(
    clip_src: Path,
    work_dir: Path,
    edits: dict,
    settings: dict,
    *,
    play_w: int,
    play_h: int,
) -> tuple[Path, bool, dict]:
    del settings
    from clips_worker.clip_layout_render import apply_per_clip_layout

    result = apply_per_clip_layout(clip_src, work_dir, edits, play_w=play_w, play_h=play_h)
    layout_ed = edits.get("layout") if isinstance(edits.get("layout"), dict) else {}
    fc_meta = layout_ed.get("facecam") if isinstance(layout_ed.get("facecam"), dict) else {}
    meta = {
        "seam_captions": result.seam_captions,
        "stack_split": result.stack_split,
        "facecam_position": str(
            fc_meta.get("position") or fc_meta.get("facecamPosition") or "top"
        ),
    }
    return result.path, result.applied, meta


def compose_export(
    caption_src: Path,
    caption_words: list[dict],
    out_mp4: Path,
    edits: dict,
    ctx: dict,
) -> tuple[Path, list[dict]]:
    from clips_worker.layers_spec import _stage_plan, legacy_from_layers, resolve_layers, v3_has_extras

    layers = resolve_layers(edits)
    burn_edits = legacy_from_layers(layers, edits)
    burn_edits = _merge_headline_style_burn(burn_edits, layers)
    plan = _stage_plan(burn_edits)
    source = "v3" if edits.get("layersV") == 3 and isinstance(edits.get("layers"), list) else "derived"
    layer_types = [{"type": l.get("type"), "enabled": l.get("enabled")} for l in layers if l.get("enabled")]
    rid = ctx.get("render_id") or "unknown"
    print(
        f"[clipper:compositor] {json.dumps({'renderId': rid, 'v': 3, 'plan': plan, 'layers': layer_types, 'source': source})}",
        flush=True,
    )
    out_mp4, caption_words = _legacy_compose(caption_src, caption_words, out_mp4, burn_edits, ctx)
    if ctx.get("compose_spec"):
        return out_mp4, caption_words
    if "sprites" in plan or v3_has_extras(layers):
        sprites = build_v3_extras(layers, {**ctx, "edits": burn_edits})
        if sprites:
            spr_out = ctx["work_dir"] / "v3_sprite_overlay.mp4"
            apply_v3_sprite_overlays(out_mp4, spr_out, sprites, ctx["work_dir"])
            shutil.copy(spr_out, out_mp4)
    return out_mp4, caption_words


def render_edited_clip(
    clip_src: Path,
    out_mp4: Path,
    source_words: list[dict],
    edits: dict,
    clip_start_ms: int,
    clip_end_ms: int,
    settings: dict,
    work_dir: Path,
    broll_specs: list[dict] | None = None,
    audio_assets: dict | None = None,
    render_id: str | None = None,
    render_meta: dict | None = None,
    *,
    conn=None,
    workspace_id: str | None = None,
    project_id: str | None = None,
    clip_id: str | None = None,
    preview_crop_track: Path | None = None,
    compose_spec: dict | None = None,
) -> tuple[Path, list[dict], str]:
    t0 = time.perf_counter()
    rid = render_id or "unknown"

    def stage(name: str, **extra: object) -> None:
        payload = {
            "tag": "clipper:export_stage",
            "renderId": rid,
            "stage": f"edits_render:{name}",
            "elapsedSec": round(time.perf_counter() - t0, 3),
        }
        payload.update(extra)
        print(f"[clipper:export_stage] {json.dumps(payload)}", flush=True)

    from clips_worker.silence_trim import effective_cut_ranges

    editor_edits_ms = output_duration_ms(edits)
    if render_meta is not None:
        render_meta["expected_editor_ms"] = editor_edits_ms

    eff_cuts = effective_cut_ranges(edits, source_words)
    eff_edits = {**edits, "cutRanges": eff_cuts}
    if output_duration_ms(eff_edits) < int(0.6 * editor_edits_ms):
        print(
            f"[clipper:silence] guard_skipped editor_ms={editor_edits_ms} "
            f"effective_ms={output_duration_ms(eff_edits)}",
            flush=True,
        )
        eff_cuts = list(edits.get("cutRanges") or [])
    edits = {**edits, "cutRanges": eff_cuts}
    from clips_worker.loop_friendly_trim import apply_loop_friendly_trim

    plat = None
    tpl = edits.get("exportTemplate")
    if isinstance(tpl, dict) and tpl.get("exportPlatformId"):
        plat = str(tpl.get("exportPlatformId"))
    if normalize_section_order(
        edits.get("sectionOrder"), int(edits["trim"]["in"]), int(edits["trim"]["out"])
    ):
        print("[clipper:reorder] loop_trim_skipped", flush=True)
    else:
        edits = apply_loop_friendly_trim(edits, source_words, export_platform=plat)
    if render_meta is not None:
        render_meta["effective_edits_ms"] = output_duration_ms(edits)
    shot_overrides = (edits.get("layout") or {}).get("shotOverrides") or []
    src_words = ensure_word_i(source_words)
    sc_settings = speakercrop_settings_from_edits(settings, edits)

    from clips_worker.compose_spec_render import spec_active

    from clips_worker.preview_edits_match import preview_export_matches

    use_spec = spec_active(compose_spec)
    preview_fast = preview_export_matches(edits, clip_start_ms, clip_end_ms) if not use_spec else False
    stage(
        "path",
        path=(
            "compose_spec_stream_band"
            if use_spec
            else ("preview_fast" if preview_fast else "full_cut_pipeline")
        ),
    )
    if preview_fast and preview_crop_track is not None and preview_crop_track.is_file():
        stage("preview_crop_track", bytes=preview_crop_track.stat().st_size)
    if preview_fast:
        remapped, _ = words_after_edits(src_words, edits)
        export_settings = dict(sc_settings)
        if settings.get("aiMeta"):
            export_settings["aiMeta"] = settings.get("aiMeta")
        if (export_settings.get("layout") or "").strip() == "auto":
            resolved = (export_settings.get("aiMeta") or {}).get("layoutResolved")
            if resolved:
                export_settings["layout"] = resolved
            else:
                from clips_worker.render_clip import resolve_clip_layout

                export_settings["layout"] = resolve_clip_layout(export_settings, 0)
        w_reframe = words_for_reframe(source_words, edits, clip_start_ms, clip_end_ms)
        run_speakercrop_layout_timeline(
            clip_src,
            out_mp4,
            w_reframe,
            export_settings,
            edits,
            work_dir,
            clip_start_ms,
            clip_end_ms,
            shot_overrides=shot_overrides,
            render_id=render_id,
            render_meta=render_meta,
            conn=conn,
            workspace_id=workspace_id,
            project_id=project_id,
            clip_id=clip_id,
            preview_crop_track=_preview_crop_track_for_export(edits, preview_crop_track),
        )
        stage("speakercrop_fast_done")
        if render_meta is not None:
            render_meta["effective_edits_ms"] = output_duration_ms(edits)

        from clips_worker.render_clip import aspect_size

        aspect = settings.get("aspectRatio", "9:16")
        resolution = settings.get("exportResolution", "720p")
        play_w, play_h = aspect_size(aspect, resolution)
        segs = ordered_keep_segments(edits)
        length_s = sum((b - a) for a, b in segs) / 1000.0
        ctx = {
            "work_dir": work_dir,
            "play_w": play_w,
            "play_h": play_h,
            "length_s": length_s,
            "settings": settings,
            "conn": conn,
            "project_id": project_id,
            "clip_id": clip_id,
            "clip_start_ms": clip_start_ms,
            "clip_end_ms": clip_end_ms,
            "render_id": rid,
            "stage": stage,
            "compose_spec": compose_spec if use_spec else None,
        }
        compositor_off = __import__("os").environ.get("COMPOSITOR_V3", "1") == "0"
        if compositor_off:
            out_mp4, remapped = _legacy_compose(out_mp4, remapped, out_mp4, edits, ctx)
        else:
            try:
                out_mp4, remapped = compose_export(out_mp4, remapped, out_mp4, edits, ctx)
            except Exception as e:
                print(
                    f"[clipper:compositor] preview_fast_fallback err={type(e).__name__}:{str(e)[:160]}",
                    flush=True,
                )
                lw = work_dir / "legacy_preview_fast"
                lw.mkdir(exist_ok=True)
                legacy_ctx = {**ctx, "work_dir": lw}
                out_mp4, remapped = _legacy_compose(out_mp4, remapped, out_mp4, edits, legacy_ctx)
        stage("preview_fast_compose_done")
        return out_mp4, remapped, build_srt(remapped)

    segs_ms = ordered_keep_segments(edits)
    segs_sec = [
        ((max(a, clip_start_ms) - clip_start_ms) / 1000.0, (min(b, clip_end_ms) - clip_start_ms) / 1000.0)
        for a, b in segs_ms
    ]
    segs_sec = [(a, b) for a, b in segs_sec if b - a >= 0.08]

    w_reframe = words_for_reframe(source_words, edits, clip_start_ms, clip_end_ms)
    wpath = work_dir / "words_reframe.json"
    wpath.write_text(json.dumps(w_reframe))

    from clips_worker.render_clip import aspect_size

    aspect = settings.get("aspectRatio", "9:16")
    resolution = settings.get("exportResolution", "720p")
    play_w, play_h = aspect_size(aspect, resolution)
    clip_src, facecam_applied, layout_meta = _apply_facecam_or_pip_layout(
        clip_src,
        work_dir,
        edits,
        settings,
        play_w=play_w,
        play_h=play_h,
    )

    full_render = work_dir / "full_render.mp4"
    settings_nc = json.loads(json.dumps(sc_settings))
    if not isinstance(settings_nc, dict):
        settings_nc = {}
    if settings.get("aiMeta"):
        settings_nc["aiMeta"] = settings.get("aiMeta")
    settings_nc["captions"] = {**(settings_nc.get("captions") or {}), "enabled": False}
    if (settings_nc.get("layout") or "").strip() == "auto":
        resolved = (settings_nc.get("aiMeta") or {}).get("layoutResolved")
        if resolved:
            settings_nc["layout"] = resolved
        else:
            from clips_worker.render_clip import resolve_clip_layout

            settings_nc["layout"] = resolve_clip_layout(settings_nc, 0)
    from clips_worker.clip_layout_render import speakercrop_settings_band_height

    settings_nc = speakercrop_settings_band_height(settings_nc, edits, play_w=play_w, play_h=play_h)
    if use_spec:
        shutil.copy(clip_src, full_render)
        stage("compose_spec_skip_speakercrop")
    elif facecam_applied:
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-i",
                str(clip_src),
                "-c",
                "copy",
                str(full_render),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        stage("facecam_layout_skip_speakercrop")
    else:
        run_speakercrop_layout_timeline(
            clip_src,
            full_render,
            w_reframe,
            settings_nc,
            edits,
            work_dir,
            clip_start_ms,
            clip_end_ms,
            shot_overrides=shot_overrides,
            render_id=render_id,
            render_meta=render_meta,
            conn=conn,
            workspace_id=workspace_id,
            project_id=project_id,
            clip_id=clip_id,
            preview_crop_track=_preview_crop_track_for_export(edits, preview_crop_track),
        )
        stage("speakercrop_nc_done")

    cut_mp4 = work_dir / "cut.mp4"
    if len(segs_sec) == 1 and segs_sec[0][0] <= 0.01 and abs(segs_sec[0][1] - (clip_end_ms - clip_start_ms) / 1000) < 0.1:
        shutil.copy(full_render, cut_mp4)
    else:
        ffmpeg_concat_segments(full_render, cut_mp4, segs_sec)

    remapped, _ = words_after_edits(src_words, edits)
    caption_words = remapped
    dub_assets = (audio_assets or {}).get("dub_assets") if audio_assets else None
    if dub_assets and dub_assets.get("dub_words"):
        caption_words = dub_assets["dub_words"]
    caption_src = cut_mp4
    if broll_specs:
        from clips_worker.broll_render import apply_broll_overlays

        w, h = probe_video_size(cut_mp4)
        broll_out = work_dir / "with_broll.mp4"
        apply_broll_overlays(cut_mp4, broll_out, broll_specs, w, h)
        caption_src = broll_out

    segs = ordered_keep_segments(edits)
    length_s = sum((b - a) for a, b in segs) / 1000.0
    meta = (audio_assets or {}).get("music_meta") or {}
    music_path = (audio_assets or {}).get("music_path") if audio_assets else None
    sfx_paths = (audio_assets or {}).get("sfx_paths") or [] if audio_assets else []
    studio_path = (audio_assets or {}).get("studio_path") if audio_assets else None
    studio_mix = (audio_assets or {}).get("studio_mix") if audio_assets else None
    if studio_path and studio_path.is_file() and studio_mix is not None:
        from clips_worker.audio_render import apply_studio_sound_mix_aligned

        offset_ms = (audio_assets or {}).get("studio_source_offset_ms")
        if offset_ms is None:
            offset_ms = 0
        track_start = max(0.0, (clip_start_ms - int(offset_ms)) / 1000.0)
        studio_out = work_dir / "studio_mix.mp4"
        apply_studio_sound_mix_aligned(
            caption_src,
            studio_path,
            studio_out,
            float(studio_mix),
            segs_sec,
            track_start_sec=track_start,
            work_dir=work_dir,
        )
        caption_src = studio_out
    if dub_assets and dub_assets.get("dub_audio_path"):
        from clips_worker.audio_render import apply_dub_speech_mix

        mixed = work_dir / "mixed_dub.mp4"
        apply_dub_speech_mix(
            caption_src,
            dub_assets["dub_audio_path"],
            mixed,
            music_path,
            sfx_paths,
            length_s=length_s,
            volume=float(meta.get("volume", 0.25)),
            duck_depth=float(meta.get("duckDepth", 0.7)),
            fade_in_s=int(meta.get("fadeInMs", 500)) / 1000.0,
            fade_out_s=int(meta.get("fadeOutMs", 1000)) / 1000.0,
        )
        caption_src = mixed
    elif audio_assets and (music_path or sfx_paths):
        from clips_worker.audio_render import apply_audio_mix

        mixed = work_dir / "mixed_audio.mp4"
        apply_audio_mix(
            caption_src,
            mixed,
            music_path,
            sfx_paths,
            length_s=length_s,
            volume=float(meta.get("volume", 0.25)),
            duck_depth=float(meta.get("duckDepth", 0.7)),
            fade_in_s=int(meta.get("fadeInMs", 500)) / 1000.0,
            fade_out_s=int(meta.get("fadeOutMs", 1000)) / 1000.0,
        )
        caption_src = mixed

    loud_lufs = edits.get("loudnessLufs")
    if edits.get("speechLevelingEnabled") is True and loud_lufs is not None:
        try:
            from clips_worker.audio_render import apply_loudnorm

            ln_out = work_dir / "loudnorm.mp4"
            apply_loudnorm(caption_src, ln_out, int(loud_lufs))
            caption_src = ln_out
            if render_meta is not None:
                render_meta["loudnorm_applied"] = True
            print(f"[clipper:loudnorm] applied lufs={int(loud_lufs)}", flush=True)
        except Exception as e:
            print(f"[clipper:loudnorm] skipped reason={type(e).__name__}", flush=True)

    from clips_worker.render_clip import aspect_size

    aspect = settings.get("aspectRatio", "9:16")
    resolution = settings.get("exportResolution", "720p")
    play_w, play_h = aspect_size(aspect, resolution)

    ctx = {
        "work_dir": work_dir,
        "play_w": play_w,
        "play_h": play_h,
        "length_s": length_s,
        "settings": settings,
        "conn": conn,
        "project_id": project_id,
        "clip_id": clip_id,
        "clip_start_ms": clip_start_ms,
        "clip_end_ms": clip_end_ms,
        "render_id": rid,
        "stage": stage,
        "compose_spec": compose_spec if use_spec else None,
        "facecam_seam_captions": bool(layout_meta.get("seam_captions")),
        "facecam_stack_split": layout_meta.get("stack_split"),
        "facecam_position": layout_meta.get("facecam_position"),
        "per_clip_layout_applied": bool(facecam_applied),
    }
    compositor_off = __import__("os").environ.get("COMPOSITOR_V3", "1") == "0"
    if compositor_off:
        out_mp4, caption_words = _legacy_compose(caption_src, caption_words, out_mp4, edits, ctx)
    else:
        try:
            out_mp4, caption_words = compose_export(caption_src, caption_words, out_mp4, edits, ctx)
        except Exception as e:
            if use_spec:
                if render_meta is not None:
                    render_meta["compose_fallback"] = f"{type(e).__name__}:{e}"[:200]
                print(f"[clipper:compose_spec] fallback err={type(e).__name__}:{str(e)[:160]}", flush=True)
                if __import__("os").environ.get("CLIPS_STRICT_COMPOSE", "0") == "1":
                    raise
            print(f"[clipper:compositor] fallback err={type(e).__name__}:{str(e)[:160]}", flush=True)
            lw = work_dir / "legacy"
            lw.mkdir(exist_ok=True)
            legacy_ctx = {**ctx, "work_dir": lw}
            out_mp4, caption_words = _legacy_compose(caption_src, caption_words, out_mp4, edits, legacy_ctx)

    stage("full_pipeline_done")
    if render_meta is not None and "effective_edits_ms" not in render_meta:
        render_meta["effective_edits_ms"] = output_duration_ms(edits)
    return out_mp4, caption_words, build_srt(caption_words)
