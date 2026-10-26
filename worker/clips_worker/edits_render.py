"""Apply clip edits (trim, cuts) then speakercrop + captions for RENDER_CLIP jobs."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

from clips_worker.render_clip import layout_env, poster_jpg, run_speakercrop, slice_words

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


def default_edits(duration_ms: int) -> dict:
    return {
        "v": 2,
        "trim": {"in": 0, "out": duration_ms},
        "cutRanges": [],
        "wordFixes": {},
        "captions": {"enabled": True, "presetId": "bold_pop"},
        "layout": {"mode": "speaker_follow", "shotOverrides": []},
    }


def normalize_edits(raw, duration_ms: int) -> dict:
    base = default_edits(duration_ms)
    if not raw or not isinstance(raw, dict):
        return base
    trim = raw.get("trim") or {}
    out = {**base, **raw, "v": 2}
    out["trim"] = {
        "in": max(0, int(trim.get("in", base["trim"]["in"]))),
        "out": min(duration_ms, int(trim.get("out", base["trim"]["out"]))),
    }
    out["cutRanges"] = list(raw.get("cutRanges") or [])
    out["wordFixes"] = dict(raw.get("wordFixes") or {})
    layout = raw.get("layout") or {}
    out["layout"] = {
        "mode": layout.get("mode") or base["layout"]["mode"],
        "shotOverrides": list(layout.get("shotOverrides") or []),
    }
    return out


def is_default_edits(edits: dict, duration_ms: int) -> bool:
    d = default_edits(duration_ms)
    return (
        edits["trim"]["in"] == d["trim"]["in"]
        and edits["trim"]["out"] == d["trim"]["out"]
        and not edits["cutRanges"]
        and not edits["wordFixes"]
        and not (edits.get("layout") or {}).get("shotOverrides")
    )


def keep_segments(trim_in: float, trim_out: float, cut_ranges: list) -> list[tuple[float, float]]:
    """Times in seconds."""
    segs: list[tuple[float, float]] = []
    t = trim_in
    for s, e in sorted(cut_ranges, key=lambda x: x[0]):
        s, e = max(s, trim_in), min(e, trim_out)
        if e <= t:
            continue
        if s > t:
            segs.append((t, s))
        t = max(t, e)
    if t < trim_out:
        segs.append((t, trim_out))
    return [(a, b) for a, b in segs if b - a >= 0.08]


def remap(t: float, segs: list[tuple[float, float]]) -> float | None:
    acc = 0.0
    for a, b in segs:
        if a <= t < b:
            return acc + (t - a)
        acc += b - a
    return None


def ffmpeg_concat_segments(src: Path, dest: Path, segs: list[tuple[float, float]]) -> None:
    if not segs:
        raise RuntimeError("no segments to render")
    if len(segs) == 1:
        a, b = segs[0]
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-ss",
                f"{a:.3f}",
                "-to",
                f"{b:.3f}",
                "-i",
                str(src),
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
        return
    parts: list[str] = []
    for i, (a, b) in enumerate(segs):
        dur = b - a
        parts.append(f"[0:v]trim=start={a}:end={b},setpts=PTS-STARTPTS[v{i}]")
        parts.append(
            f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,"
            f"afade=t=in:d=0.01,afade=t=out:st={max(0, dur - 0.01):.3f}:d=0.01[a{i}]"
        )
    concat_in = "".join(f"[v{i}][a{i}]" for i in range(len(segs)))
    fc = ";".join(parts) + f";{concat_in}concat=n={len(segs)}:v=1:a=1[v][a]"
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


def apply_word_fixes(words: list[dict], fixes: dict) -> list[dict]:
    out = []
    for i, w in enumerate(words):
        key = str(i)
        if key in fixes:
            out.append({**w, "w": fixes[key]})
        else:
            out.append(w)
    return out


def words_after_edits(words: list[dict], edits: dict) -> tuple[list[dict], list[tuple[float, float]]]:
    trim_in = edits["trim"]["in"] / 1000.0
    trim_out = edits["trim"]["out"] / 1000.0
    cuts = [[c[0] / 1000.0, c[1] / 1000.0] for c in edits.get("cutRanges") or []]
    segs = keep_segments(trim_in, trim_out, cuts)
    out_words: list[dict] = []
    for w in words:
        mid = (w["s"] + w["e"]) / 2.0
        mapped = remap(mid, segs)
        if mapped is None:
            continue
        seg = next((s for s in segs if s[0] <= mid < s[1]), None)
        if not seg:
            continue
        a = seg[0]
        out_words.append(
            {
                "w": w["w"],
                "s": round(mapped - (mid - w["s"] - a), 3),
                "e": round(mapped + (w["e"] - mid), 3),
                "p": w.get("p", 1),
                "spk": w.get("spk"),
            }
        )
    return apply_word_fixes(out_words, edits.get("wordFixes") or {}), segs


def build_srt(words: list[dict]) -> str:
    lines: list[str] = []
    idx = 1
    for w in words:
        if not str(w.get("w", "")).strip():
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


def render_edited_clip(
    clip_src: Path,
    out_mp4: Path,
    words: list[dict],
    edits: dict,
    settings: dict,
    work_dir: Path,
) -> tuple[Path, list[dict], str]:
    duration_ms = int(edits["trim"]["out"] - edits["trim"]["in"]) + 1000
    duration_ms = max(duration_ms, int((edits["trim"]["out"])))
    clip_duration_ms = int(edits["trim"]["out"])
    if is_default_edits(edits, clip_duration_ms):
        edited_words, _ = words_after_edits(words, edits)
        words_path = work_dir / "words.json"
        words_path.write_text(json.dumps(edited_words))
        run_speakercrop(clip_src, out_mp4, words_path, settings, work_dir)
        return out_mp4, edited_words, build_srt(edited_words)

    trim_in = edits["trim"]["in"] / 1000.0
    trim_out = edits["trim"]["out"] / 1000.0
    cuts = [[c[0] / 1000.0, c[1] / 1000.0] for c in edits.get("cutRanges") or []]
    segs = keep_segments(trim_in, trim_out, cuts)
    cut_path = work_dir / "cut.mp4"
    ffmpeg_concat_segments(clip_src, cut_path, segs)
    edited_words, _ = words_after_edits(words, edits)
    words_path = work_dir / "words.json"
    words_path.write_text(json.dumps(edited_words))
    run_speakercrop(cut_path, out_mp4, words_path, settings, work_dir)
    return out_mp4, edited_words, build_srt(edited_words)
