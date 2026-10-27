"""Apply clip edits on source timeline (ms), then reframe, cut, and caption."""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from clips_worker.caption_words import build_caption_words, caption_words_to_render
from clips_worker.layout_router import (
    needs_per_segment_layout_export,
    speakercrop_settings_for_layout_mode,
    speakercrop_settings_from_edits,
)
from clips_worker.render_clip import run_speakercrop

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
    """Pick word indexes for auto-zoom when emphasis list is empty."""
    explicit = cap_edits.get("emphasis") if isinstance(cap_edits.get("emphasis"), list) else []
    if explicit:
        return [int(x) for x in explicit]
    if not cap_edits.get("keywordHighlight") and not cap_edits.get("autoEmojis"):
        return []
    out: list[int] = []
    for w in words:
        text = str(w.get("w", "")).strip()
        if len(text) < 4:
            continue
        idx = w.get("i", w.get("idx"))
        if idx is None:
            continue
        out.append(int(idx))
        if len(out) >= 10:
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
        "layout": {
            "mode": layout.get("mode") or base["layout"]["mode"],
            "shotOverrides": list(layout.get("shotOverrides") or []),
            "layoutSegments": list(layout.get("layoutSegments") or []),
        },
    }


def is_default_edits(edits: dict, clip_start_ms: int, clip_end_ms: int) -> bool:
    d = default_edits(clip_start_ms, clip_end_ms)
    return (
        edits["trim"]["in"] == d["trim"]["in"]
        and edits["trim"]["out"] == d["trim"]["out"]
        and not edits["cutRanges"]
        and not edits["wordFixes"]
        and not (edits.get("layout") or {}).get("shotOverrides")
    )


def keep_segments(trim_in: int, trim_out: int, cut_ranges: list) -> list[tuple[int, int]]:
    segs: list[tuple[int, int]] = []
    t = trim_in
    for s, e in sorted(cut_ranges, key=lambda x: x[0]):
        s, e = max(int(s), trim_in), min(int(e), trim_out)
        if e <= t:
            continue
        if s > t:
            segs.append((t, s))
        t = max(t, e)
    if t < trim_out:
        segs.append((t, trim_out))
    return [(a, b) for a, b in segs if b - a >= 80]


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
    segs = keep_segments(int(edits["trim"]["in"]), int(edits["trim"]["out"]), edits.get("cutRanges") or [])
    capped = build_caption_words(ensure_word_i(words), edits)
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
) -> Path:
    """Export speakercrop honoring per-segment layout modes when they differ."""
    if not needs_per_segment_layout_export(edits):
        sc_settings = speakercrop_settings_from_edits(settings, edits)
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
        seg_settings = speakercrop_settings_for_layout_mode(settings, str(seg["mode"]))
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
        )
        part_paths.append(part_out)

    if not part_paths:
        sc_settings = speakercrop_settings_from_edits(settings, edits)
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
    from clips_worker.captions_ass import build_ass

    if play_w is None or play_h is None:
        play_w, play_h = probe_video_size(video)

    ass = work_dir / "cap.ass"
    cap = edits_captions if isinstance(edits_captions, dict) else {}
    if not cap.get("presetId") and not cap.get("preset"):
        cap = {**cap, "presetId": "bold_pop", "animation": "pop"}
    build_ass(words, cap, ass, play_w=play_w, play_h=play_h)
    fontsdir = V3 / "fonts"
    vf = f"ass={ass}:fontsdir={fontsdir}".replace(",", r"\,")
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vf", vf, "-c:a", "copy", str(out)],
    )


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
) -> tuple[Path, list[dict], str]:
    from clips_worker.silence_trim import effective_cut_ranges

    edits = {**edits, "cutRanges": effective_cut_ranges(edits, source_words)}
    shot_overrides = (edits.get("layout") or {}).get("shotOverrides") or []
    src_words = ensure_word_i(source_words)
    sc_settings = speakercrop_settings_from_edits(settings, edits)

    from clips_worker.preview_edits_match import preview_export_matches

    if preview_export_matches(edits, clip_start_ms, clip_end_ms):
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
        )
        return out_mp4, remapped, build_srt(remapped)

    segs_ms = keep_segments(int(edits["trim"]["in"]), int(edits["trim"]["out"]), edits.get("cutRanges") or [])
    segs_sec = [
        ((max(a, clip_start_ms) - clip_start_ms) / 1000.0, (min(b, clip_end_ms) - clip_start_ms) / 1000.0)
        for a, b in segs_ms
    ]
    segs_sec = [(a, b) for a, b in segs_sec if b - a >= 0.08]

    w_reframe = words_for_reframe(source_words, edits, clip_start_ms, clip_end_ms)
    wpath = work_dir / "words_reframe.json"
    wpath.write_text(json.dumps(w_reframe))

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
    )

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

    segs = keep_segments(int(edits["trim"]["in"]), int(edits["trim"]["out"]), edits.get("cutRanges") or [])
    length_s = sum((b - a) for a, b in segs) / 1000.0
    meta = (audio_assets or {}).get("music_meta") or {}
    music_path = (audio_assets or {}).get("music_path") if audio_assets else None
    sfx_paths = (audio_assets or {}).get("sfx_paths") or [] if audio_assets else []
    studio_path = (audio_assets or {}).get("studio_path") if audio_assets else None
    studio_mix = (audio_assets or {}).get("studio_mix") if audio_assets else None
    if studio_path and studio_path.is_file() and studio_mix is not None:
        from clips_worker.audio_render import apply_studio_sound_mix

        studio_out = work_dir / "studio_mix.mp4"
        apply_studio_sound_mix(caption_src, studio_path, studio_out, float(studio_mix))
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
    if loud_lufs is not None:
        try:
            from clips_worker.audio_render import apply_loudnorm

            ln_out = work_dir / "loudnorm.mp4"
            apply_loudnorm(caption_src, ln_out, int(loud_lufs))
            caption_src = ln_out
        except Exception:
            pass

    from clips_worker.render_clip import aspect_size

    aspect = settings.get("aspectRatio", "9:16")
    resolution = settings.get("exportResolution", "720p")
    play_w, play_h = aspect_size(aspect, resolution)

    final = work_dir / "final.mp4"
    cap_edits = edits.get("captions") or {}
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
    if zoom_cfg.get("enabled"):
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
        apply_zoom(out_mp4, zoomed, kf, length_s, play_w, play_h)
        shutil.copy(zoomed, out_mp4)

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

    return out_mp4, caption_words, build_srt(caption_words)
