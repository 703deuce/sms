"""E5b insert / append: footage that LENGTHENS the export (ripple).

Mirror of new-app/lib/clips/editor/inserts.ts (parity: tests/fixtures/e5b_parity.json).

``edits.inserts[]``: ``{id, sourceId, atSrcMs, append?, inMs, durMs, audio?: 'source'|'mute', fit?}``.
Each insert is anchored at a MAIN SOURCE ms point (or the end). The base edit is rendered exactly as
before. Once the export post-step is done (speed, loudnorm), each insert is spliced into the finished file at
its point, so everything after it moves right (video, captions, B-roll, text, music, SFX). Inserts play
at 1x with their own sound (or silence), conformed to the export size / fps (cover = fill + crop,
contain = fit + pad). Stills loop for the insert length.

The SRT is shifted the same way, and the words of a transcribed insert (E5b on-demand transcripts) are
added as their own cues.
"""
from __future__ import annotations

import json
import math
import re
import subprocess
from pathlib import Path

INSERT_MIN_MS = 200
INSERT_MAX_MS = 10 * 60 * 1000
MAX_INSERTS = 50
_ID_RE = re.compile(r"^[A-Za-z0-9_:.~-]{1,120}$")


def _int(v) -> int | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f or f in (float("inf"), float("-inf")):
        return None
    return int(math.floor(f + 0.5))


def _safe_id(v) -> str:
    s = str(v if v is not None else "").strip()
    return s if _ID_RE.match(s) else ""


def normalize_inserts(raw, sources: list[dict] | None) -> list[dict] | None:
    if not isinstance(raw, list):
        return None
    by_id = {s["id"]: s for s in (sources or [])}
    out: list[dict] = []
    seen: set[str] = set()
    for r in raw:
        if not isinstance(r, dict):
            continue
        iid = _safe_id(r.get("id"))
        src = by_id.get(_safe_id(r.get("sourceId")))
        at = _int(r.get("atSrcMs"))
        dur = _int(r.get("durMs"))
        if not iid or iid in seen or not src or src["mediaType"] == "audio" or at is None or dur is None:
            continue
        if dur < INSERT_MIN_MS:
            continue
        seen.add(iid)
        in_ms = max(0, _int(r.get("inMs")) or 0) if src["mediaType"] == "video" else 0
        dur_ms = min(dur, INSERT_MAX_MS)
        if src["mediaType"] == "video" and src.get("durationMs"):
            dur_ms = min(dur_ms, max(INSERT_MIN_MS, int(src["durationMs"]) - in_ms))
        item = {"id": iid, "sourceId": src["id"], "atSrcMs": max(0, at)}
        if r.get("append") is True:
            item["append"] = True
        item["inMs"] = in_ms
        item["durMs"] = dur_ms
        if r.get("audio") == "mute" or src["mediaType"] == "image":
            item["audio"] = "mute"
        if r.get("fit") == "contain":
            item["fit"] = "contain"
        out.append(item)
        if len(out) >= MAX_INSERTS:
            break
    return out or None


def base_ms_for_source_point(segs, src_ms: int) -> int:
    acc = 0
    for a, b in segs:
        if src_ms < a:
            return acc
        if src_ms < b:
            return acc + (src_ms - a)
        acc += b - a
    return acc


def insert_windows(segs, inserts: list[dict] | None) -> list[dict]:
    if not inserts:
        return []
    segs = [(int(a), int(b)) for a, b in segs]
    total = sum(b - a for a, b in segs)
    placed = []
    for order, ins in enumerate(inserts):
        base = total if ins.get("append") else min(total, base_ms_for_source_point(segs, int(ins["atSrcMs"])))
        placed.append((base, 1 if ins.get("append") else 0, order, ins))
    placed.sort(key=lambda p: (p[0], p[1], p[2]))
    out: list[dict] = []
    shift = 0
    for base, _app, _order, ins in placed:
        start = base + shift
        out.append(
            {
                "id": ins["id"],
                "sourceId": ins["sourceId"],
                "baseMs": base,
                "startMs": start,
                "endMs": start + ins["durMs"],
                "inMs": ins["inMs"],
                "durMs": ins["durMs"],
                "audio": "mute" if ins.get("audio") == "mute" else "source",
                "fit": ins.get("fit") or "cover",
            }
        )
        shift += ins["durMs"]
    return out


def edits_insert_windows(edits: dict, keep_segs=None) -> list[dict]:
    from clips_worker.media_sources import normalize_media_sources

    sources = normalize_media_sources(edits.get("sources")) or []
    inserts = normalize_inserts(edits.get("inserts"), sources)
    if not inserts:
        return []
    if keep_segs is None:
        from clips_worker.clip_keep_segments import ordered_keep_segments

        keep_segs = ordered_keep_segments(edits)
    return insert_windows(keep_segs, inserts)


def has_inserts(edits: dict) -> bool:
    return bool(edits.get("inserts"))


def base_to_display_ms(windows: list[dict], base_ms: float) -> float:
    return base_ms + sum(w["durMs"] for w in windows if w["baseMs"] <= base_ms)


# ---------------------------------------------------------------------------
# Splice into the finished export
# ---------------------------------------------------------------------------


def _probe_json(path: Path) -> dict:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate,sample_rate,channels:format=duration",
         "-of", "json", str(path)],
        text=True,
    )
    return json.loads(out or "{}")


def _final_ms(edits: dict, render_meta: dict | None, base_ms: float) -> float:
    """Edit-timeline ms → time in the post-processed file (E4 per-item warp, then global speed)."""
    from clips_worker.export_post import _edit_speed, speed_warp_for
    from clips_worker.speed import warp_ms

    pieces = speed_warp_for(edits, render_meta or {})
    real = warp_ms(pieces, base_ms) if pieces else base_ms
    return real / _edit_speed(edits)


def _fmt_srt(ms: float) -> str:
    ms = max(0, int(round(ms)))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


_SRT_TIME = re.compile(r"(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})")


def shift_srt(srt_body: str, points: list[tuple[float, float]], extra_cues: list[tuple[float, float, str]] | None = None) -> str:
    """Shift cues by the inserts before them (points = [(final_ms, dur_ms)]) and add insert cues."""
    cues: list[tuple[float, float, str]] = []
    for block in re.split(r"\n\s*\n", (srt_body or "").strip()):
        lines = block.strip().splitlines()
        m = next((_SRT_TIME.search(l) for l in lines if _SRT_TIME.search(l)), None)
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        a = ((g[0] * 60 + g[1]) * 60 + g[2]) * 1000 + g[3]
        b = ((g[4] * 60 + g[5]) * 60 + g[6]) * 1000 + g[7]
        text_i = next(i for i, l in enumerate(lines) if _SRT_TIME.search(l)) + 1
        text = "\n".join(lines[text_i:]).strip()
        sa = a + sum(d for p, d in points if p <= a)
        sb = b + sum(d for p, d in points if p < b)
        cues.append((sa, max(sa + 1, sb), text))
    cues.extend(extra_cues or [])
    cues.sort(key=lambda c: (c[0], c[1]))
    return "".join(f"{i}\n{_fmt_srt(a)} --> {_fmt_srt(b)}\n{t}\n\n" for i, (a, b, t) in enumerate(cues, 1) if t)


def insert_word_cues(words: list[dict], max_words: int = 4, max_ms: int = 1800) -> list[tuple[float, float, str]]:
    """Group display-time insert words [{w, startMs, endMs}] into short caption cues."""
    cues: list[tuple[float, float, str]] = []
    cur: list[dict] = []
    for w in sorted(words, key=lambda x: x["startMs"]):
        if cur and (len(cur) >= max_words or w["endMs"] - cur[0]["startMs"] > max_ms or w.get("insertId") != cur[0].get("insertId")):
            cues.append((cur[0]["startMs"], cur[-1]["endMs"], " ".join(x["w"] for x in cur)))
            cur = []
        cur.append(w)
    if cur:
        cues.append((cur[0]["startMs"], cur[-1]["endMs"], " ".join(x["w"] for x in cur)))
    return cues


def build_splice_graph(
    main_has_audio: bool,
    w: int,
    h: int,
    fps: float,
    sr: int,
    pieces: list[dict],
) -> tuple[list[str], str]:
    """filter_complex + extra inputs. pieces = [{kind:'main', t0, t1} | {kind:'insert', input, still, durS, inS, audio, fit, hasAudio}]."""
    from clips_worker.media_sources import fit_filter

    parts: list[str] = []
    labels: list[str] = []
    fps_s = f"{fps:.6g}"
    for k, p in enumerate(pieces):
        v, a = f"v{k}", f"a{k}"
        if p["kind"] == "main":
            t0, t1 = p["t0"], p["t1"]
            parts.append(f"[0:v]trim=start={t0:.6f}:end={t1:.6f},setpts=PTS-STARTPTS,fps={fps_s},format=yuv420p,setsar=1[{v}]")
            if main_has_audio:
                parts.append(f"[0:a]atrim=start={t0:.6f}:end={t1:.6f},asetpts=PTS-STARTPTS,aresample={sr},aformat=channel_layouts=stereo[{a}]")
            else:
                parts.append(f"anullsrc=r={sr}:cl=stereo,atrim=duration={t1 - t0:.6f}[{a}]")
        else:
            i, d = p["input"], p["durS"]
            vf = fit_filter(p["fit"], w, h)
            if p["still"]:
                parts.append(f"[{i}:v]{vf},fps={fps_s},format=yuv420p,trim=duration={d:.6f},setpts=PTS-STARTPTS[{v}]")
            else:
                parts.append(f"[{i}:v]{vf},fps={fps_s},format=yuv420p,tpad=stop_mode=clone:stop_duration={d:.6f},trim=duration={d:.6f},setpts=PTS-STARTPTS[{v}]")
            if p["audio"] == "source" and p["hasAudio"]:
                parts.append(f"[{i}:a]aresample={sr},aformat=channel_layouts=stereo,apad,atrim=duration={d:.6f},asetpts=PTS-STARTPTS[{a}]")
            else:
                parts.append(f"anullsrc=r={sr}:cl=stereo,atrim=duration={d:.6f}[{a}]")
        labels.append(f"[{v}][{a}]")
    parts.append(f"{''.join(labels)}concat=n={len(pieces)}:v=1:a=1[vout][aout]")
    return parts, "[vout]"


def splice_inserts(
    out_mp4: Path,
    work_dir: Path,
    edits: dict,
    render_meta: dict | None,
    media_paths: dict[str, Path] | None,
    srt_body: str,
    insert_words: list[dict] | None = None,
) -> tuple[Path, str, int]:
    """Returns (new mp4, new srt, added ms). No inserts / no media → unchanged."""
    from clips_worker.media_sources import has_audio_stream, media_path_for, normalize_media_sources

    keep = (render_meta or {}).get("keep_segs_src")
    windows = edits_insert_windows(edits, keep)
    if not windows:
        return out_mp4, srt_body, 0
    sources = {s["id"]: s for s in (normalize_media_sources(edits.get("sources")) or [])}
    usable = []
    for win in windows:
        path = media_path_for(edits, win["sourceId"], media_paths or {})
        if not path or not Path(path).is_file():
            print(f"[clipper:inserts] skip {win['id']} (media missing)", flush=True)
            continue
        usable.append((win, Path(path)))
    if not usable:
        return out_mp4, srt_body, 0

    info = _probe_json(out_mp4)
    streams = info.get("streams") or []
    vs = next((s for s in streams if s.get("codec_type") == "video"), {})
    aus = next((s for s in streams if s.get("codec_type") == "audio"), None)
    w, h = int(vs.get("width") or 720), int(vs.get("height") or 1280)
    num, _, den = str(vs.get("r_frame_rate") or "30/1").partition("/")
    fps = float(num) / max(1.0, float(den or 1)) if num else 30.0
    fps = fps if 1 <= fps <= 120 else 30.0
    sr = int((aus or {}).get("sample_rate") or 48000)
    total_s = float((info.get("format") or {}).get("duration") or 0.0)

    inputs: list[str] = ["-i", str(out_mp4)]
    pieces: list[dict] = []
    t = 0.0
    points: list[tuple[float, float]] = []
    for idx, (win, path) in enumerate(usable, start=1):
        at_s = min(total_s, max(0.0, _final_ms(edits, render_meta, win["baseMs"]) / 1000.0))
        if at_s - t > 0.02:
            pieces.append({"kind": "main", "t0": t, "t1": at_s})
        t = max(t, at_s)
        src = sources.get(win["sourceId"]) or {}
        still = src.get("mediaType") == "image"
        d = win["durMs"] / 1000.0
        if still:
            inputs += ["-loop", "1", "-framerate", f"{fps:.6g}", "-t", f"{d:.3f}", "-i", str(path)]
        else:
            inputs += ["-ss", f"{win['inMs'] / 1000.0:.3f}", "-t", f"{d + 0.5:.3f}", "-i", str(path)]
        pieces.append(
            {
                "kind": "insert",
                "input": idx,
                "still": still,
                "durS": d,
                "audio": win["audio"],
                "fit": win["fit"],
                "hasAudio": (not still) and has_audio_stream(path),
            }
        )
        points.append((at_s * 1000.0, float(win["durMs"])))
    if total_s - t > 0.02:
        pieces.append({"kind": "main", "t0": t, "t1": total_s})

    parts, vout = build_splice_graph(aus is not None, w, h, fps, sr, pieces)
    dest = Path(work_dir) / "with_inserts.mp4"
    cmd = [
        "ffmpeg", "-y", "-v", "error", *inputs,
        "-filter_complex", ";".join(parts),
        "-map", vout, "-map", "[aout]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dest),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"insert splice failed: {(proc.stderr or '')[-800:]}")
    added = int(round(sum(p["durS"] for p in pieces if p["kind"] == "insert") * 1000))
    # Insert words: display ms on the edit timeline → the post-processed file.
    extra = []
    if insert_words:
        by_id = {}
        prior_ms = 0.0
        for (wn, _), (at_ms, d_ms) in zip(usable, points):
            by_id[wn["id"]] = (wn, at_ms, prior_ms)  # prior = every insert spliced before this one
            prior_ms += d_ms
        moved = []
        for word in insert_words:
            hit = by_id.get(word.get("insertId"))
            if not hit:
                continue
            wn, at_ms, prior = hit
            off0 = word["startMs"] - wn["startMs"]
            off1 = word["endMs"] - wn["startMs"]
            moved.append({**word, "startMs": at_ms + prior + off0, "endMs": at_ms + prior + off1})
        extra = insert_word_cues(moved)
    new_srt = shift_srt(srt_body, points, extra)
    print(f"[clipper:inserts] {json.dumps({'inserts': len(usable), 'added_ms': added})}", flush=True)
    return dest, new_srt, added
