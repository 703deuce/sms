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


def default_edits(clip_start_ms: int, clip_end_ms: int) -> dict:
    return {
        "v": 2,
        "trim": {"in": clip_start_ms, "out": clip_end_ms},
        "cutRanges": [],
        "wordFixes": {},
        "captions": {"enabled": True, "presetId": "bold_pop"},
        "layout": {"mode": "speaker_follow", "shotOverrides": []},
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
) -> tuple[Path, list[dict], str]:
    shot_overrides = (edits.get("layout") or {}).get("shotOverrides") or []
    src_words = ensure_word_i(source_words)

    if is_default_edits(edits, clip_start_ms, clip_end_ms):
        remapped, _ = words_after_edits(src_words, edits)
        wpath = work_dir / "words.json"
        wpath.write_text(json.dumps(remapped))
        run_speakercrop(
            clip_src,
            out_mp4,
            wpath,
            settings,
            work_dir,
            clip_start_ms=clip_start_ms,
            shot_overrides=shot_overrides,
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
    settings_nc = json.loads(json.dumps(settings))
    if not isinstance(settings_nc, dict):
        settings_nc = {}
    settings_nc["captions"] = {**(settings_nc.get("captions") or {}), "enabled": False}
    run_speakercrop(
        clip_src,
        full_render,
        wpath,
        settings_nc,
        work_dir,
        clip_start_ms=clip_start_ms,
        shot_overrides=shot_overrides,
    )

    cut_mp4 = work_dir / "cut.mp4"
    if len(segs_sec) == 1 and segs_sec[0][0] <= 0.01 and abs(segs_sec[0][1] - (clip_end_ms - clip_start_ms) / 1000) < 0.1:
        shutil.copy(full_render, cut_mp4)
    else:
        ffmpeg_concat_segments(full_render, cut_mp4, segs_sec)

    remapped, _ = words_after_edits(src_words, edits)
    final = work_dir / "final.mp4"
    if int(edits.get("captions", {}).get("enabled", True)):
        burn_captions(cut_mp4, remapped, final, work_dir, edits.get("captions") or {})
        shutil.copy(final, out_mp4)
    else:
        shutil.copy(cut_mp4, out_mp4)

    return out_mp4, remapped, build_srt(remapped)
