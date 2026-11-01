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
    from clips_worker.filtergraph import canvas_bg_changes_frames

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
        and not _timeline_voice_muted(edits)
        # E3: keyframes / cut transitions change the frames — never reuse preview.mp4.
        and not edits.get("keyframes")
        and not edits.get("transitions")
        # G1a: flip / stacking order change the frames.
        and not edits.get("layerProps")
        # G1b: track order / hidden tracks change the frames.
        and not edits.get("tracks")
        # G1b3: J / L cuts change the sound.
        and not edits.get("splitEdits")
        # G1c: track effects / takes change the sound or the frames.
        and not edits.get("trackFx")
        and not edits.get("takes")
        and not edits.get("trackMotion")
        # E4: text items / color looks / per-item speed change the frames or the length.
        and not edits.get("textItems")
        # G3a: manual caption lines replace the preview's transcript captions.
        and not edits.get("captionLines")
        and not _e4_color(edits)
        # G4a: adjustment layers grade the frames.
        and not edits.get("adjustLayers")
        and not edits.get("segmentSpeeds")
        # G4c: stabilize / blur regions change the frames; G4b layer effects too.
        and not edits.get("stabilize")
        and not edits.get("videoReverse")
        and not edits.get("blurRegions")
        and not edits.get("layerFx")
        # E5: source segments replace frames / sound.
        and not edits.get("sourceSegments")
        # E5b: inserts lengthen the export.
        and not edits.get("inserts")
        and not canvas_bg_changes_frames(edits)
    )


def _e4_color(edits: dict) -> bool:
    from clips_worker.color import has_color

    return has_color(edits)


def _timeline_voice_muted(edits: dict) -> bool:
    """E2: a muted Voice lane must never reuse the (voiced) preview render."""
    from clips_worker.timeline_lanes import voice_muted

    return voice_muted(edits)


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


def export_srt(edits: dict, words: list[dict]) -> str:
    """G3a: the export .srt — one cue per manual caption line when set, else per word (as before)."""
    if edits.get("captionLines"):
        from clips_worker.caption_lines import build_line_srt

        body = build_line_srt(edits)
        if body:
            return body
    return build_srt(words)


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
    elif isinstance(ctx.get("t6_spec"), dict) and isinstance(cap_edits, dict):
        cap_edits = _t6_caption_edits(cap_edits, ctx["t6_spec"], play_h)
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
    burn_words = caption_words
    if edits.get("captionLines"):
        # G3a: manual caption lines replace the transcript words for the burned captions (and the
        # hook-duplicate check, like the editor preview); zoom / censor keep the transcript.
        from clips_worker.caption_lines import caption_line_render_words

        burn_words = caption_line_render_words(edits) or caption_words
    if int(cap_edits.get("enabled", True)):
        burn_captions(caption_src, burn_words, final, work_dir, cap_edits, play_w=play_w, play_h=play_h)
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
    if ho and ho.get("enabled") and isinstance(ctx.get("t6_spec"), dict) and _t6_headline_on(edits):
        # T6.2: the template title already shows the hook line; a second DejaVu line under it
        # reads as a broken caption.
        print("[t6:hook_skip] reason=title_on", flush=True)
        ho = None
    from clips_worker.hook_duplicate import hook_text_duplicates_captions as _hook_dup

    if (
        ho
        and ho.get("enabled")
        and int(cap_edits.get("enabled", True))
        and _hook_dup(str(ho.get("text") or ""), burn_words, int(ho.get("durationMs") or 2500))
    ):
        # E6: the auto hook is often the clip's first spoken line; with captions on it burned the
        # same words twice (most visible on stacked/split templates, where the title is off).
        print("[clipper:hook_skip] reason=duplicates_captions", flush=True)
        ho = None
    if ho and ho.get("enabled") and str(ho.get("text") or "").strip():
        from clips_worker.hook_overlay import apply_hook_overlay

        hooked = work_dir / "hooked.mp4"
        apply_hook_overlay(out_mp4, hooked, edits, play_w=play_w, play_h=play_h)
        shutil.copy(hooked, out_mp4)

    from clips_worker.text_items import apply_text_items, has_text_items

    # G1b: text items already burned under an overlay track (B-roll stage) are not burned again.
    under = set(ctx.get("under_text_ids") or [])
    top_edits = (
        {**edits, "textItems": [t for t in (edits.get("textItems") or []) if str(t.get("id")) not in under] or None}
        if under
        else edits
    )
    if has_text_items(top_edits):
        # E4: Text-lane items, burned in the same stage as the hook title (output ms).
        texted = work_dir / "text_items.mp4"
        apply_text_items(out_mp4, texted, top_edits, play_w=play_w, play_h=play_h)
        shutil.copy(texted, out_mp4)

    zoom_cfg = edits.get("zoom") if isinstance(edits.get("zoom"), dict) else {}
    if zoom_cfg.get("enabled") and not zoom_done and isinstance(ctx.get("t6_spec"), dict):
        # T6.3: a whole-frame zoom over a finished T6 composite scales the captions out of
        # captionRect, pushes the PiP / title off-frame and shifts panel seams. Skip it.
        print("[t6:zoom_skip] reason=t6_composite", flush=True)
        zoom_done = True
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
    t6_spec = ctx.get("t6_spec") if isinstance(ctx.get("t6_spec"), dict) else None
    if tpl and (t6_spec or (not stream_frame_applied and not editor_mode_uses_stream_frame(layout_mode))):
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
            t6_spec=t6_spec,
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


def _t6_headline_on(edits: dict) -> bool:
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
    hb = tpl.get("headlineBar") if isinstance(tpl.get("headlineBar"), dict) else {}
    return bool(hb.get("enabled") and str(hb.get("text") or tpl.get("suggestedHeadline") or "").strip())


def _t6_caption_edits(cap_edits: dict, spec: dict, play_h: int) -> dict:
    """T6.2: bottom-anchor captions inside the template captionRect (export px space)."""
    rect = spec.get("captionRect") if isinstance(spec.get("captionRect"), dict) else None
    if not rect:
        return cap_edits
    bottom = int(rect.get("y") or 0) + int(rect.get("h") or 0)
    margin_v = max(0, int(play_h) - bottom)
    return {**cap_edits, "position": "bottom", "_assAlignment": 2, "_assMarginV": margin_v}


def _merge_headline_style_burn(burn_edits: dict, layers: list[dict], edits: dict | None = None) -> dict:
    from clips_worker.layers_spec import _layer_by_id

    src_tpl = (edits or {}).get("exportTemplate") if isinstance((edits or {}).get("exportTemplate"), dict) else {}
    src_style = src_tpl.get("headlineStyle") if isinstance(src_tpl.get("headlineStyle"), dict) else {}
    if src_style.get("t6Id"):
        # T6.2: a T6 title chip is the user's explicit choice — the derived headline layer
        # (legacy export_bar / bold_news white box) must not overwrite it.
        out = {**burn_edits}
        tpl = out.get("exportTemplate") if isinstance(out.get("exportTemplate"), dict) else {}
        out["exportTemplate"] = {**tpl, "headlineStyle": {"t6Id": str(src_style["t6Id"])}}
        return out
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


def _t6_backfill_faces(clip_src: Path, signals: dict, *, conn=None, clip_id: str | None = None) -> dict:
    """T6.3: clips created before T6.3 have no ``signals.faces``. Detect them once on the clip
    source (YuNet, ~10 frames) so face/person panels centre on the real face, and persist them
    (additive jsonb_set on "aiMeta".signals.faces) so the editor preview uses the same faces."""
    try:
        from clips_worker.t6_cv import detect_faces

        faces = detect_faces(clip_src)
    except Exception as exc:  # pragma: no cover - detector failure keeps legacy geometry
        print(f"[t6:faces] detect_failed err={type(exc).__name__}", flush=True)
        return signals
    if faces is None:
        return signals
    out = {**signals, "faces": faces}
    print(f"[t6:faces] backfill n={len(faces)} clip={clip_id or '-'}", flush=True)
    if conn is not None and clip_id:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE clips
                    SET "aiMeta" = jsonb_set("aiMeta", '{signals,faces}', %s::jsonb, true)
                    WHERE id = %s AND jsonb_typeof("aiMeta"->'signals') = 'object'
                    """,
                    (json.dumps(faces), clip_id),
                )
            conn.commit()
        except Exception as exc:
            print(f"[t6:faces] persist_failed err={type(exc).__name__}", flush=True)
            try:
                conn.rollback()
            except Exception:
                pass
    return out


def _t6_scene_parts(
    tmpl: dict, signals: dict, edits: dict, *, play_w: int, play_h: int, clip_start_ms: int = 0
) -> list[tuple]:
    """T6.7: ``layout.template.segments`` -> [(start_s, end_s, spec)], or [] for one template.

    Segments are only used while the pick is automatic: a user who picks a template in the
    editor (template-layout-panel writes a template without segments) or drags a box
    (template.boxes) gets that one template for the whole clip."""
    from clips_worker.t6_scenes import scene_spec_for_segment

    segs = tmpl.get("segments") if isinstance(tmpl.get("segments"), list) else None
    scenes = signals.get("scenes") if isinstance(signals.get("scenes"), list) else None
    if not segs or len(segs) < 2 or not scenes or tmpl.get("boxes") or tmpl.get("auto") is False:
        return []
    # clip_src starts at clip_start_ms (the export cut may start before/after clips.startMs).
    off_s = (int(tmpl.get("segmentsBaseMs") or clip_start_ms) - int(clip_start_ms)) / 1000.0
    parts = []
    for i, sg in enumerate(segs):
        spec = scene_spec_for_segment(sg, signals, edits, play_w=play_w, play_h=play_h)
        if spec is None:
            return []
        a = 0.0 if i == 0 else float(sg.get("startS") or 0) + off_s
        b = 1e9 if i == len(segs) - 1 else float(sg.get("endS") or 0) + off_s
        if b > a:
            parts.append((max(0.0, a), b, spec))
    return parts if len(parts) >= 2 else []


def _apply_facecam_or_pip_layout(
    clip_src: Path,
    work_dir: Path,
    edits: dict,
    settings: dict,
    *,
    play_w: int,
    play_h: int,
    conn=None,
    clip_id: str | None = None,
    clip_start_ms: int = 0,
) -> tuple[Path, bool, dict]:
    from clips_worker.t6_flags import t6_log_fallback, t6_templates_enabled

    layout_ed = edits.get("layout") if isinstance(edits.get("layout"), dict) else {}
    tmpl = layout_ed.get("template") if isinstance(layout_ed.get("template"), dict) else {}
    tmpl_id = str(tmpl.get("id") or "").strip()
    if t6_templates_enabled(settings) and tmpl_id:
        try:
            from clips_worker.t6_geometry import resolve_template_geometry
            from clips_worker.t6_registry import TEMPLATES
            from clips_worker.t6_render import probe_duration_s, render_template
            from clips_worker.t6_signals import signals_or_defaults

            ai_meta = settings.get("aiMeta") if isinstance(settings.get("aiMeta"), dict) else {}
            signals = signals_or_defaults({**ai_meta, "signals": ai_meta.get("signals")})
            tdef = TEMPLATES.get(tmpl_id)
            if tdef and not isinstance(signals.get("faces"), list):
                signals = _t6_backfill_faces(clip_src, signals, conn=conn, clip_id=clip_id)
            if tdef:
                spec = resolve_template_geometry(tdef, signals, edits, play_w=play_w, play_h=play_h)
                out = work_dir / f"t6_{tmpl_id}.mp4"
                scene_parts = _t6_scene_parts(
                    tmpl, signals, edits, play_w=play_w, play_h=play_h, clip_start_ms=clip_start_ms
                )
                # E6: editor blur strength for blurred bands / contain_blur panels (render-only key).
                from clips_worker.filtergraph import canvas_bg, fit_blur_strength

                spec = {**spec, "blurStrength": fit_blur_strength(edits), "canvasBg": canvas_bg(edits)}
                for _part in scene_parts or []:
                    if isinstance(_part[2], dict):
                        _part[2]["blurStrength"] = spec["blurStrength"]
                if scene_parts:
                    # T6.7: one template per scene of the close look's scene map.
                    from clips_worker.t6_render import render_template_segments

                    render_template_segments(
                        clip_src, out, scene_parts, work_dir / "t6_scenes", duration_s=probe_duration_s(clip_src)
                    )
                    print(f"[t6:render] scenes={len(scene_parts)} ids={[p[2].get('templateId') for p in scene_parts]}", flush=True)
                else:
                    render_template(clip_src, out, spec, work_dir, duration_s=probe_duration_s(clip_src))
                meta = {
                    # T6.2: captions follow spec.captionRect, not the facecam-stack seam.
                    "seam_captions": False,
                    "stack_split": float((tdef.get("panels") or [{}])[0].get("h") or 0.35),
                    "facecam_position": "top",
                    "t6_spec": spec,
                }
                ctx_spec = spec
                print(f"[t6:render] template={tmpl_id} panels={len(spec.get('panels') or [])}", flush=True)
                return out, True, meta
        except Exception as exc:
            t6_log_fallback("render", exc)
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
    burn_edits = _merge_headline_style_burn(burn_edits, layers, edits)
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


def _under_text_passes(
    edits: dict, broll_specs: list[dict], w: int, h: int, settings: dict, *, use_spec: bool, layout_meta: dict
) -> list[dict]:
    """G1b: B-roll stage passes when a text track sits under an overlay track, else [].

    Only when the B-roll stage frame IS the final frame (no compose spec / T6 template / stream
    headline compose, same size as the export) — the editor preview applies the same rule
    (B-roll region = full frame); otherwise those text items burn on top as before.
    """
    from clips_worker.tracks import under_passes

    ids = [str(sp.get("id")) for sp in broll_specs if sp.get("id") is not None]
    passes = under_passes(edits, ids)
    if not passes:
        return []
    from clips_worker.layout_router import export_stream_headline_compose_active
    from clips_worker.render_clip import aspect_size

    pw, ph = aspect_size(settings.get("aspectRatio", "9:16"), settings.get("exportResolution", "720p"))
    if use_spec or layout_meta.get("t6_spec") or export_stream_headline_compose_active(edits) or (w, h) != (pw, ph):
        print(f"[g1b:under_text] fallback=top frame={w}x{h} play={pw}x{ph} spec={bool(use_spec)}", flush=True)
        return []
    return passes


def _apply_under_text_passes(
    src: Path, out: Path, passes: list[dict], broll_specs: list[dict], edits: dict, w: int, h: int, work_dir: Path
) -> list[str]:
    from clips_worker.broll_render import apply_broll_overlays
    from clips_worker.text_items import apply_text_items

    cur = src
    burned: list[str] = []
    for i, p in enumerate(passes):
        step = work_dir / f"layer_pass_{i}.mp4"
        ids = set(p["ids"])
        if p["kind"] == "overlay":
            apply_broll_overlays(cur, step, [sp for sp in broll_specs if str(sp.get("id")) in ids], w, h, edits=edits)
        else:
            sub = {**edits, "textItems": [t for t in (edits.get("textItems") or []) if str(t.get("id")) in ids]}
            if apply_text_items(cur, step, sub, play_w=w, play_h=h) != step:
                shutil.copy(cur, step)
            burned.extend(p["ids"])
        cur = step
    shutil.copy(cur, out)
    print(f"[g1b:under_text] passes={[p['kind'] for p in passes]} text={len(burned)}", flush=True)
    return burned


def _split_audio_secs(edits: dict, segs_sec, clip_start_ms: int, clip_end_ms: int):
    """G1b3: audio pieces (clip-relative s) when the clip has J / L cuts, else None."""
    if not edits.get("splitEdits") or len(segs_sec) < 2:
        return None
    from clips_worker.split_edits import audio_segments, edits_split_offsets

    segs = [(clip_start_ms + int(round(a * 1000)), clip_start_ms + int(round(b * 1000))) for a, b in segs_sec]
    offs = edits_split_offsets(edits, segs)
    if not any(offs):
        return None
    span = (clip_end_ms - clip_start_ms) / 1000.0
    return [
        (max(0.0, (a - clip_start_ms) / 1000.0), min(span, (b - clip_start_ms) / 1000.0))
        for a, b in audio_segments(segs, offs)
    ]


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
    if conn is not None and workspace_id and edits.get("textItems"):
        # G3b: workspace fonts used by text items (downloaded once; merged fontsdir for the burn).
        from clips_worker.user_fonts import prepare_user_fonts

        edits = prepare_user_fonts(conn, workspace_id, edits, work_dir)
    if conn is not None and workspace_id and edits.get("color"):
        # G4a: imported .cube LUTs the color looks use (parsed once; baked into each look's cube).
        from clips_worker.user_luts import prepare_user_luts

        edits = prepare_user_luts(conn, workspace_id, edits, work_dir)

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
        # E6: compose writes its result over out_mp4. Its input was out_mp4 too, so when the v3
        # sprite stage failed after captions were burned, the legacy fallback re-read the already
        # captioned file and burned captions a second time. Compose from an untouched copy.
        compose_in = work_dir / "preview_fast_compose_in.mp4"
        shutil.copy(out_mp4, compose_in)
        if compositor_off:
            out_mp4, remapped = _legacy_compose(compose_in, remapped, out_mp4, edits, ctx)
        else:
            try:
                out_mp4, remapped = compose_export(compose_in, remapped, out_mp4, edits, ctx)
            except Exception as e:
                print(
                    f"[clipper:compositor] preview_fast_fallback err={type(e).__name__}:{str(e)[:160]}",
                    flush=True,
                )
                lw = work_dir / "legacy_preview_fast"
                lw.mkdir(exist_ok=True)
                legacy_ctx = {**ctx, "work_dir": lw}
                out_mp4, remapped = _legacy_compose(compose_in, remapped, out_mp4, edits, legacy_ctx)
        stage("preview_fast_compose_done")
        return out_mp4, remapped, export_srt(edits, remapped)

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
        conn=conn,
        clip_id=clip_id,
        clip_start_ms=clip_start_ms,
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

    from clips_worker.media_sources import apply_full_render_sources

    # E5: other sources (uploads / Rooms angles / multicam) over source-time spans, before the E4
    # color pass and the cut so color, cuts, transitions, keyframes and speed all apply to them.
    full_render = apply_full_render_sources(
        full_render, edits, clip_start_ms, clip_end_ms, work_dir, (audio_assets or {}).get("media_paths")
    )

    if edits.get("stabilize"):
        # G4c: stabilize source-time ranges first, so color, cuts, transitions and keyframes all
        # work on the steadied picture (vidstab two-pass, else deshake — probed at runtime).
        from clips_worker.stabilize import apply_full_render_stabilize

        full_render = apply_full_render_stabilize(full_render, edits, clip_start_ms, clip_end_ms, work_dir)
        stage("stabilize_done")

    if edits.get("videoReverse"):
        from clips_worker.video_reverse import apply_full_render_reverse

        full_render = apply_full_render_reverse(full_render, edits, clip_start_ms, clip_end_ms, work_dir)
        stage("reverse_done")

    from clips_worker.color import apply_full_render_color

    # E4: source-anchored color looks on full_render (source time) → cut.mp4 and the E3 transition
    # handles (both cut from full_render) carry the right look per side.
    pre_color = full_render
    full_render = apply_full_render_color(full_render, edits, clip_start_ms, clip_end_ms, work_dir)

    from clips_worker.main_fx import apply_full_render_key, main_key_allowed
    from clips_worker.layer_fx import layer_fx_for

    if layer_fx_for(edits, "video").get("key") and main_key_allowed(edits):
        keyed = work_dir / "keyed.mp4"
        full_render = apply_full_render_key(pre_color, full_render, keyed, edits)
        stage("main_key_done")

    if render_meta is not None:
        # E5b: exact keep segments (source ms) for the insert splice after the export post-step.
        render_meta["keep_segs_src"] = [
            (clip_start_ms + int(round(a * 1000)), clip_start_ms + int(round(b * 1000))) for a, b in segs_sec
        ]
    cut_mp4 = work_dir / "cut.mp4"
    if len(segs_sec) == 1 and segs_sec[0][0] <= 0.01 and abs(segs_sec[0][1] - (clip_end_ms - clip_start_ms) / 1000) < 0.1:
        shutil.copy(full_render, cut_mp4)
    else:
        ffmpeg_concat_segments(full_render, cut_mp4, segs_sec)
    # G1b3: J / L cuts — same picture, the sound switches before / after each cut.
    audio_secs = _split_audio_secs(edits, segs_sec, clip_start_ms, clip_end_ms)
    if audio_secs:
        from clips_worker.media_sources import has_audio_stream
        from clips_worker.split_edits import apply_split_audio

        if has_audio_stream(full_render):
            cut_mp4 = apply_split_audio(cut_mp4, full_render, work_dir / "cut_split.mp4", audio_secs)
            stage("split_audio_done", n=sum(1 for a, s in zip(audio_secs, segs_sec) if a != s))

    if edits.get("transitions") or edits.get("keyframes") or edits.get("layerProps"):
        # E3: cut transitions (centred on the cut, video only → length / audio unchanged) and
        # Video-lane keyframes, on the same segments that were just concatenated.
        from clips_worker.motion_render import apply_motion_after_cut

        concat_ms = [
            (clip_start_ms + int(round(a * 1000)), clip_start_ms + int(round(b * 1000))) for a, b in segs_sec
        ]
        cut_mp4 = apply_motion_after_cut(cut_mp4, full_render, edits, concat_ms, clip_start_ms, work_dir)
        stage("motion_done")

    if render_meta is not None and edits.get("segmentSpeeds"):
        # E4: per-item speed warp map in edit ms, applied by export_post after the full render.
        from clips_worker.speed import normalize_segment_speeds, speed_warp_pieces

        concat_src = [
            (clip_start_ms + int(round(a * 1000)), clip_start_ms + int(round(b * 1000))) for a, b in segs_sec
        ]
        render_meta["speed_warp"] = speed_warp_pieces(concat_src, normalize_segment_speeds(edits.get("segmentSpeeds")))

    from clips_worker.video_reverse import drop_reversed_words

    remapped, _ = words_after_edits(drop_reversed_words(ensure_word_i(src_words), edits), edits)
    caption_words = remapped
    dub_assets = (audio_assets or {}).get("dub_assets") if audio_assets else None
    if dub_assets and dub_assets.get("dub_words"):
        caption_words = dub_assets["dub_words"]
    if edits.get("blurRegions"):
        # G4c: blur regions (manual keyframed mask or auto faces) on the main video in output ms,
        # after cut / motion and under B-roll, text and captions.
        from clips_worker.blur_regions import apply_blur_regions

        bw, bh = probe_video_size(cut_mp4)
        blur_out = work_dir / "with_blur.mp4"
        if apply_blur_regions(cut_mp4, blur_out, edits, bw, bh, work_dir):
            cut_mp4 = blur_out
            stage("blur_regions_done")
    from clips_worker.main_fx import apply_main_mask
    from clips_worker.layer_fx import layer_fx_for

    if layer_fx_for(edits, "video").get("mask"):
        mw, mh = probe_video_size(cut_mp4)
        mask_out = work_dir / "with_main_mask.mp4"
        if apply_main_mask(cut_mp4, mask_out, edits, mw, mh, work_dir):
            cut_mp4 = mask_out
            stage("main_mask_done")
    caption_src = cut_mp4
    under_text_ids: list[str] = []
    if broll_specs:
        from clips_worker.broll_render import apply_broll_overlays

        w, h = probe_video_size(cut_mp4)
        broll_out = work_dir / "with_broll.mp4"
        passes = _under_text_passes(edits, broll_specs, w, h, settings, use_spec=use_spec, layout_meta=layout_meta)
        if passes:
            # G1b: a text track under an overlay track — burn bottom -> top in the B-roll stage.
            under_text_ids = _apply_under_text_passes(cut_mp4, broll_out, passes, broll_specs, edits, w, h, work_dir)
            stage("under_text_done", passes=len(passes), n=len(under_text_ids))
        else:
            apply_broll_overlays(cut_mp4, broll_out, broll_specs, w, h, edits=edits)
        caption_src = broll_out
    if edits.get("adjustLayers"):
        # G4a: adjustment layers grade everything below them (main video + overlays), under the text.
        from clips_worker.adjust_layers import apply_adjust_layers

        aw, ah = probe_video_size(caption_src)
        adj_out = work_dir / "with_adjust.mp4"
        if apply_adjust_layers(caption_src, adj_out, edits, aw, ah, work_dir):
            caption_src = adj_out
            stage("adjust_layers_done")

    segs = ordered_keep_segments(edits)
    length_s = sum((b - a) for a, b in segs) / 1000.0
    from clips_worker.timeline_lanes import music_window as _music_window
    from clips_worker.timeline_lanes import voice_muted as _voice_muted

    if _voice_muted(edits):
        from clips_worker.audio_render import apply_voice_mute

        muted_out = work_dir / "voice_muted.mp4"
        apply_voice_mute(caption_src, muted_out)
        caption_src = muted_out
        print("[clipper:timeline] voice_muted", flush=True)
    meta = (audio_assets or {}).get("music_meta") or {}
    music_win = _music_window(meta, int(round(length_s * 1000))) if meta else None
    from clips_worker.motion import volume_expr as _volume_expr

    music_env = _volume_expr(edits, "music", origin_s=(music_win or {}).get("startMs", 0) / 1000.0)
    voice_env = None if _voice_muted(edits) else _volume_expr(edits, "voice")
    music_path = (audio_assets or {}).get("music_path") if audio_assets else None
    sfx_paths = (audio_assets or {}).get("sfx_paths") or [] if audio_assets else []
    # G1b3: per-SFX volume envelopes (`sfx:<id>` keyframes, local ms from the SFX start).
    sfx_ids = (audio_assets or {}).get("sfx_ids") or [] if audio_assets else []
    sfx_envs = [
        _volume_expr(edits, f"sfx:{sid}", origin_s=at / 1000.0) if sid else None
        for (_p, at, _v), sid in zip(sfx_paths, sfx_ids)
    ] if len(sfx_ids) == len(sfx_paths) else None
    sfx_trims = (audio_assets or {}).get("sfx_trims") if audio_assets else None
    if sfx_trims is not None and len(sfx_trims) != len(sfx_paths):
        sfx_trims = None
    # G2: per-clip fades / ducking (parallel to sfx_paths) and the looping music bed.
    sfx_fx = (audio_assets or {}).get("sfx_fx") if audio_assets else None
    if sfx_fx is not None and len(sfx_fx) != len(sfx_paths):
        sfx_fx = None
    music_loop = bool(meta.get("loop"))
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
            audio_secs or segs_sec,
            track_start_sec=track_start,
            work_dir=work_dir,
        )
        caption_src = studio_out
    if voice_env and not (dub_assets and dub_assets.get("dub_audio_path")):
        from clips_worker.motion_render import apply_voice_volume

        vol_out = work_dir / "voice_volume.mp4"
        if apply_voice_volume(caption_src, vol_out, edits):
            caption_src = vol_out
    # G1c: track FX — the Voice chain on the main sound, music / audio-track chains in the mix.
    from clips_worker.track_fx import apply_voice_fx, mix_track_fx, track_fx_for

    voice_fx = track_fx_for(edits, "voice")
    if voice_fx and not _voice_muted(edits) and not (dub_assets and dub_assets.get("dub_audio_path")):
        vfx_out = work_dir / "voice_fx.mp4"
        try:
            if apply_voice_fx(caption_src, vfx_out, voice_fx):
                caption_src = vfx_out
                stage("voice_fx_done")
        except Exception as e:  # never fail an export on a track effect
            print(f"[clipper:track_fx] voice skipped reason={type(e).__name__}", flush=True)
    track_fx = None
    try:
        track_fx = mix_track_fx(
            edits,
            sfx_paths=sfx_paths,
            sfx_ids=sfx_ids,
            sfx_trims=sfx_trims,
            sfx_envs=sfx_envs,
            sfx_channels=(audio_assets or {}).get("sfx_channels") if audio_assets else None,
            music_path=music_path if music_path is not None and Path(music_path).is_file() else None,
            music_args=(
                length_s,
                float(meta.get("volume", 0.25)),
                int(meta.get("fadeInMs", 500)) / 1000.0,
                int(meta.get("fadeOutMs", 1000)) / 1000.0,
                music_win,
                music_env,
            ),
        )
    except Exception as e:
        print(f"[clipper:track_fx] mix skipped reason={type(e).__name__}", flush=True)
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
            music_window=music_win,
            music_volume_expr=music_env,
            speech_volume_expr=voice_env,
            sfx_volume_exprs=sfx_envs,
            sfx_trims=sfx_trims,
            track_fx=track_fx,
            sfx_fx=sfx_fx,
            music_loop=music_loop,
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
            music_window=music_win,
            music_volume_expr=music_env,
            sfx_volume_exprs=sfx_envs,
            sfx_trims=sfx_trims,
            track_fx=track_fx,
            sfx_fx=sfx_fx,
            music_loop=music_loop,
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
        "t6_spec": layout_meta.get("t6_spec") if isinstance(layout_meta.get("t6_spec"), dict) else None,
        "under_text_ids": under_text_ids,
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
    return out_mp4, caption_words, export_srt(edits, caption_words)
