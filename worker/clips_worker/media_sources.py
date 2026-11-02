"""E5 multiple sources: user uploads (project media library), Rooms angles, multicam.

Mirror of new-app/lib/clips/editor/sources.ts (parity: tests/fixtures/e5_parity.json).

* ``edits.sources``        media referenced by the clip: ref 'upload' (ClipUpload registered in the
  project's ``clip_project_media``) or 'take' (Rooms ``recording_tracks`` row of the project).
* ``edits.sourceSegments`` Video-lane segments from another source over MAIN SOURCE ms spans.
  Rendered on ``full_render`` (source time, already reframed to the output size) BEFORE the E4
  color pass and the cut, so cuts / transitions / keyframes / speed / color all apply unchanged and
  the output timeline never moves. Mixed sizes: cover (scale+crop) or contain (scale+pad), every
  source conformed to the main fps / SAR / yuv420p. Stills loop for the span.
* Audio per segment: 'main' (keep), 'source' (main muted in the span, source audio in), 'mix'.
* B-roll ``source: 'upload'`` and music / SFX ``uploadId`` resolve through the same loader.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

SOURCE_SEG_MIN_MS = 100
MAX_SOURCES = 50
MAX_SOURCE_SEGMENTS = 500
_ID_RE = re.compile(r"^[A-Za-z0-9_:.~-]{1,120}$")
_UPLOAD_RE = re.compile(r"^[A-Za-z0-9_-]{1,120}$")
_MEDIA_TYPES = ("video", "image", "audio")
_AUDIO_MODES = ("main", "source", "mix")
_LAYOUT_KINDS = frozenset({"side_by_side", "stack", "pip", "grid"})
_PIP_CORNERS = frozenset({"TL", "TR", "BL", "BR"})


def _clamp(v: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, v))


def _resolve_with_id(raw, sources: dict, own_id: str) -> str | None:
    if raw in ("main", MAIN_ANGLE):
        return "main"
    s = _safe_id(raw)
    if not s or s == own_id:
        return None
    return s if s in sources else None


MAIN_ANGLE = "main"


def _normalize_segment_layout(raw, sources: dict, own_source_id: str) -> dict | None:
    if not isinstance(raw, dict):
        return None
    kind = raw.get("kind")
    if kind not in _LAYOUT_KINDS:
        return None
    with_id = raw.get("withSourceId")
    if with_id == MAIN_ANGLE:
        with_res = "main"
    else:
        with_res = _resolve_with_id(with_id, sources, own_source_id)
    if not with_res:
        return None
    split = _clamp(float(raw.get("split") if raw.get("split") is not None else 0.5), 0.3, 0.7)
    pip_scale = _clamp(float(raw.get("pipScale") if raw.get("pipScale") is not None else 0.3), 0.2, 0.45)
    corner = raw.get("pipCorner") if raw.get("pipCorner") in _PIP_CORNERS else "BR"
    out: dict = {"kind": kind, "withSourceId": with_res, "split": split}
    w2 = _resolve_with_id(raw.get("withSourceId2"), sources, own_source_id) if raw.get("withSourceId2") is not None else None
    if raw.get("withSourceId2") == MAIN_ANGLE:
        w2 = "main"
    w3 = _resolve_with_id(raw.get("withSourceId3"), sources, own_source_id) if raw.get("withSourceId3") is not None else None
    if raw.get("withSourceId3") == MAIN_ANGLE:
        w3 = "main"
    if kind == "grid" and not w2:
        return None
    if w2:
        out["withSourceId2"] = w2
    if w3:
        out["withSourceId3"] = w3
    if kind == "pip":
        out["pipCorner"] = corner
        out["pipScale"] = pip_scale
    return out


def _layout_extra_source_ids(layout: dict | None) -> list[str]:
    if not layout:
        return []
    ids: list[str] = []
    for key in ("withSourceId", "withSourceId2", "withSourceId3"):
        v = layout.get(key)
        if v and v != "main":
            ids.append(str(v))
    return ids


def _int(v) -> int | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f or f in (float("inf"), float("-inf")):
        return None
    # JS Math.round: half up.
    import math

    return int(math.floor(f + 0.5))


def _safe_id(v) -> str:
    s = str(v if v is not None else "").strip()
    return s if _ID_RE.match(s) else ""


def normalize_media_sources(raw) -> list[dict] | None:
    if not isinstance(raw, list):
        return None
    out: list[dict] = []
    seen: set[str] = set()
    for r in raw:
        if not isinstance(r, dict):
            continue
        ref_id = _safe_id(r.get("refId"))
        sid = _safe_id(r.get("id")) or ref_id
        ref = r.get("ref") if r.get("ref") in ("upload", "take") else None
        mt = r.get("mediaType") if r.get("mediaType") in _MEDIA_TYPES else None
        if not sid or not ref_id or not ref or not mt or sid in seen:
            continue
        seen.add(sid)
        item: dict = {"id": sid, "ref": ref, "refId": ref_id, "mediaType": mt}
        label = r.get("label")
        if isinstance(label, str) and label.strip():
            item["label"] = label.strip()[:120]
        dur = _int(r.get("durationMs"))
        if dur is not None and dur > 0:
            item["durationMs"] = dur
        sync = _int(r.get("syncMs"))
        if sync is not None and mt != "image":
            item["syncMs"] = sync
        out.append(item)
        if len(out) >= MAX_SOURCES:
            break
    return out or None


def normalize_source_segments(raw, sources) -> list[dict] | None:
    if not isinstance(raw, list):
        return None
    by_id = {s["id"]: s for s in (sources or [])}
    out: list[dict] = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        sid = _safe_id(r.get("id"))
        src = by_id.get(_safe_id(r.get("sourceId")))
        a, b = _int(r.get("startMs")), _int(r.get("endMs"))
        if not sid or not src or a is None or b is None:
            continue
        if src["mediaType"] == "audio" and r.get("auto") is True:
            continue
        if b - a < SOURCE_SEG_MIN_MS or a < 0:
            continue
        seg: dict = {"id": sid, "sourceId": src["id"], "startMs": a, "endMs": b}
        in_ms = _int(r.get("inMs"))
        if in_ms is not None and in_ms >= 0 and src["mediaType"] in ("video", "audio"):
            seg["inMs"] = in_ms
        if r.get("audio") in _AUDIO_MODES and src["mediaType"] == "video":
            seg["audio"] = r["audio"]
        if src["mediaType"] == "audio":
            seg["audio"] = "source"
        if r.get("fit") == "contain":
            seg["fit"] = "contain"
        if r.get("auto") is True:
            seg["auto"] = True
        layout = _normalize_segment_layout(r.get("layout"), by_id, src["id"])
        if layout:
            seg["layout"] = layout
        out.append(seg)
    out.sort(key=lambda s: s["startMs"])
    clean: list[dict] = []
    for s in out:
        if clean and clean[-1]["endMs"] > s["startMs"]:
            clean[-1]["endMs"] = s["startMs"]
            if clean[-1]["endMs"] - clean[-1]["startMs"] < SOURCE_SEG_MIN_MS:
                clean.pop()
        clean.append(dict(s))
        if len(clean) >= MAX_SOURCE_SEGMENTS:
            break
    return clean or None


def _is_synced(seg: dict, src: dict | None) -> bool:
    return bool(src and src["mediaType"] == "video" and "syncMs" in src and "inMs" not in seg)


def segment_media_ms(seg: dict, src: dict | None, src_ms: int) -> int:
    if not src or src["mediaType"] == "image":
        return 0
    if _is_synced(seg, src):
        return max(0, src_ms + int(src.get("syncMs") or 0))
    return max(0, int(seg.get("inMs") or 0) + (src_ms - int(seg["startMs"])))


def segment_audio(seg: dict, src: dict | None) -> str:
    if not src:
        return "main"
    if src["mediaType"] == "audio":
        return "source"
    if src["mediaType"] != "video":
        return "main"
    if seg.get("audio"):
        return seg["audio"]
    return "main" if _is_synced(seg, src) else "source"


def source_windows(edits: dict, window_start_ms: int, window_end_ms: int) -> list[dict]:
    """Segments over a source-time render window (ms relative to the window start)."""
    sources = normalize_media_sources(edits.get("sources")) or []
    segs = normalize_source_segments(edits.get("sourceSegments"), sources) or []
    by_id = {s["id"]: s for s in sources}
    out: list[dict] = []
    for s in segs:
        src = by_id.get(s["sourceId"])
        if not src:
            continue
        lo = max(window_start_ms, s["startMs"])
        hi = min(window_end_ms, s["endMs"])
        if hi - lo < 1:
            continue
        row = {
                "id": s["id"],
                "sourceId": s["sourceId"],
                "t0Ms": lo - window_start_ms,
                "t1Ms": hi - window_start_ms,
                "mediaInMs": segment_media_ms(s, src, lo),
                "audio": segment_audio(s, src),
                "fit": s.get("fit") or "cover",
                "mediaType": src["mediaType"],
            }
        if s.get("layout"):
            row["layout"] = s["layout"]
            row["windowStartMs"] = lo
            row["windowEndMs"] = hi
            row["segment"] = s
        out.append(row)
    return out


def has_sources(edits: dict) -> bool:
    return bool(source_windows(edits, 0, 10**12))


# ---------------------------------------------------------------------------
# Loading (scoped to the clip's workspace + project)
# ---------------------------------------------------------------------------

_UPLOAD_SQL = (
    'SELECT u.key, u.mime FROM clip_uploads u JOIN clip_project_media m ON m."uploadId" = u.id '
    'WHERE u.id = %s AND u."workspaceId" = %s AND m."projectId" = %s AND u.status = %s'
)
_TAKE_SQL = (
    'SELECT t."storageKey", t."mimeType" FROM recording_tracks t '
    'JOIN recording_takes k ON k.id = t."takeId" JOIN recording_sessions s ON s.id = k."sessionId" '
    'WHERE t.id = %s AND s."projectId" = %s AND s."workspaceId" = %s AND t."storageKey" IS NOT NULL'
)


def _ext(key: str, mime: str | None) -> str:
    m = re.search(r"\.([A-Za-z0-9]{1,5})$", key or "")
    if m:
        return m.group(1).lower()
    if mime and "/" in mime:
        return re.sub(r"[^a-z0-9]", "", mime.split("/", 1)[1].lower())[:5] or "bin"
    return "bin"


def referenced_media(edits: dict) -> list[tuple[str, str]]:
    """(ref, refId) pairs the export needs: source segments, upload B-roll, upload music / SFX."""
    refs: list[tuple[str, str]] = []
    sources = normalize_media_sources(edits.get("sources")) or []
    by_id = {s["id"]: s for s in sources}
    for s in normalize_source_segments(edits.get("sourceSegments"), sources) or []:
        src = by_id.get(s["sourceId"])
        if src:
            refs.append((src["ref"], src["refId"]))
            for extra_id in _layout_extra_source_ids(s.get("layout")):
                ex = by_id.get(extra_id)
                if ex:
                    refs.append((ex["ref"], ex["refId"]))
    for b in edits.get("broll") or []:
        if isinstance(b, dict) and b.get("source") == "upload" and _UPLOAD_RE.match(str(b.get("uploadId") or "")):
            refs.append(("upload", str(b["uploadId"])))
    audio = edits.get("audio") if isinstance(edits.get("audio"), dict) else {}
    music = audio.get("music") if isinstance(audio.get("music"), dict) else None
    if music and _UPLOAD_RE.match(str(music.get("uploadId") or "")):
        refs.append(("upload", str(music["uploadId"])))
    for sfx in audio.get("sfx") or []:
        if isinstance(sfx, dict) and _UPLOAD_RE.match(str(sfx.get("uploadId") or "")):
            refs.append(("upload", str(sfx["uploadId"])))
    # E5b: inserted clips.
    from clips_worker.media_inserts import normalize_inserts

    for ins in normalize_inserts(edits.get("inserts"), sources) or []:
        src = by_id.get(ins["sourceId"])
        if src:
            refs.append((src["ref"], src["refId"]))
    cb = edits.get("canvasBg") if isinstance(edits.get("canvasBg"), dict) else {}
    if cb.get("type") == "image" and _UPLOAD_RE.match(str(cb.get("imageId") or "")):
        refs.append(("upload", str(cb["imageId"])))
    seen: set[tuple[str, str]] = set()
    return [r for r in refs if not (r in seen or seen.add(r))]


def load_media_assets(conn, edits: dict, work_dir: Path, workspace_id: str, project_id: str) -> dict[str, Path]:
    """refId → local file for every referenced upload / Rooms track (missing rows are skipped)."""
    from clips_worker.storage import download_object

    out: dict[str, Path] = {}
    for i, (ref, ref_id) in enumerate(referenced_media(edits)):
        with conn.cursor() as cur:
            if ref == "upload":
                cur.execute(_UPLOAD_SQL, (ref_id, workspace_id, project_id, "COMPLETE"))
            else:
                cur.execute(_TAKE_SQL, (ref_id, project_id, workspace_id))
            row = cur.fetchone()
        if not row or not row[0]:
            print(f"[clipper:media] missing {ref}:{ref_id}", flush=True)
            continue
        local = Path(work_dir) / f"media_{i}.{_ext(row[0], row[1])}"
        download_object(row[0], local)
        out[ref_id] = local
    return out


def media_path_for(edits: dict, source_id: str, media: dict[str, Path]) -> Path | None:
    for s in normalize_media_sources(edits.get("sources")) or []:
        if s["id"] == source_id:
            return media.get(s["refId"])
    return None


# ---------------------------------------------------------------------------
# Probing / conforming
# ---------------------------------------------------------------------------


def has_audio_stream(path: Path) -> bool:
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
             "-of", "csv=p=0", str(path)],
            text=True,
        )
        return bool(out.strip())
    except (subprocess.CalledProcessError, OSError):
        return False


def probe_size(path: Path) -> tuple[int, int]:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
         "-of", "csv=p=0:s=x", str(path)],
        text=True,
    ).strip()
    w, h = out.split("x")[:2]
    return int(w), int(h)


def probe_fps(path: Path) -> float:
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            text=True,
        ).strip()
        if "/" in out:
            num, den = out.split("/", 1)
            fps = float(num) / max(1.0, float(den))
            if 1 <= fps <= 120:
                return fps
    except (subprocess.CalledProcessError, ValueError, OSError):
        pass
    return 30.0


def fit_filter(fit: str, w: int, h: int) -> str:
    """Scale any size / SAR to exactly w×h: cover = fill + centre crop, contain = fit + black pad."""
    if fit == "contain":
        return (f"scale={w}:{h}:force_original_aspect_ratio=decrease:force_divisible_by=2,"
                f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1")
    return f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1"


def still_to_video(image: Path, out: Path, duration_s: float, fps: float = 30.0) -> Path:
    """Image → short H.264 clip (even size), so B-roll stills reuse the B-roll video path."""
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", f"{fps:g}", "-t", f"{max(0.1, duration_s):.3f}",
         "-i", str(image), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1,format=yuv420p",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-an", str(out)],
        stdout=subprocess.DEVNULL,
    )
    return out


def _layout_pane_chain(
    *,
    label: str,
    width: int,
    height: int,
    pw: int,
    ph: int,
    fit: str,
    fps: float,
    in_idx: int | None,
    main_lo_s: float,
    dur: float,
    media_in_ms: int,
) -> tuple[str, int | None]:
    """Return (filter chain ending in [label], updated in_idx). in_idx None => slice from [0:v]."""
    vf = fit_filter(fit, pw, ph)
    if in_idx is None:
        chain = (
            f"[0:v]trim=start={main_lo_s:.3f}:end={main_lo_s + dur:.3f},setpts=PTS-STARTPTS,"
            f"fps={fps:g},{vf},format=yuv420p[{label}]"
        )
        return chain, in_idx
    chain = (
        f"[{in_idx}:v]trim=0:{dur:.3f},setpts=PTS-STARTPTS,fps={fps:g},{vf},format=yuv420p[{label}]"
    )
    return chain, in_idx


def _append_layout_composite(
    i: int,
    w: dict,
    layout: dict,
    *,
    parts: list[str],
    inputs: list[str],
    in_idx: int,
    width: int,
    height: int,
    fps: float,
    t0: float,
    t1: float,
    dur: float,
    primary_v_in: int,
    edits: dict,
    media: dict[str, Path],
) -> tuple[int, str]:
    """Build composite filter for one window; returns (new_in_idx, s_label)."""
    kind = layout["kind"]
    split = float(layout.get("split") or 0.5)
    lo_s = w["windowStartMs"] / 1000.0
    by_id = {s["id"]: s for s in normalize_media_sources(edits.get("sources")) or []}
    seg = w.get("segment") or {}

    def resolve_pane(source_id: str) -> tuple[int | None, str]:
        nonlocal in_idx
        fit = w.get("fit") or "cover"
        if source_id == "main":
            return None, fit
        src = by_id.get(source_id)
        p = media_path_for(edits, source_id, media)
        if not src or not p:
            return None, fit
        inputs.extend(
            [
                "-ss",
                f"{segment_media_ms(seg, src, w['windowStartMs']) / 1000.0:.3f}",
                "-t",
                f"{dur + 0.25:.3f}",
                "-i",
                str(p),
            ]
        )
        idx = in_idx
        in_idx += 1
        return idx, fit

    s_lbl = f"s{i}"
    if kind == "side_by_side":
        parts.append(
            f"[{primary_v_in}:v]trim=0:{dur:.3f},setpts=PTS-STARTPTS,fps={fps:g},"
            f"{fit_filter(w.get('fit') or 'cover', width // 2, height)},format=yuv420p[p{i}a]"
        )
        v_in_b, fit_b = resolve_pane(layout["withSourceId"])
        chain_b, _ = _layout_pane_chain(
            label=f"p{i}b",
            width=width,
            height=height,
            pw=width // 2,
            ph=height,
            fit=fit_b,
            fps=fps,
            in_idx=v_in_b,
            main_lo_s=lo_s,
            dur=dur,
            media_in_ms=int(w["windowStartMs"]),
        )
        parts.append(chain_b)
        parts.append(f"[p{i}a][p{i}b]hstack=inputs=2[{s_lbl}]")
    elif kind == "stack":
        parts.append(
            f"[{primary_v_in}:v]trim=0:{dur:.3f},setpts=PTS-STARTPTS,fps={fps:g},"
            f"{fit_filter(w.get('fit') or 'cover', width, int(height * split))},format=yuv420p[p{i}t]"
        )
        v_in_b, fit_b = resolve_pane(layout["withSourceId"])
        chain_b, _ = _layout_pane_chain(
            label=f"p{i}b",
            width=width,
            height=height,
            pw=width,
            ph=int(height * (1 - split)),
            fit=fit_b,
            fps=fps,
            in_idx=v_in_b,
            main_lo_s=lo_s,
            dur=dur,
            media_in_ms=int(w["windowStartMs"]),
        )
        parts.append(chain_b)
        parts.append(f"[p{i}t][p{i}b]vstack=inputs=2[{s_lbl}]")
    elif kind == "pip":
        parts.append(
            f"[{primary_v_in}:v]trim=0:{dur:.3f},setpts=PTS-STARTPTS,fps={fps:g},"
            f"{fit_filter(w.get('fit') or 'cover', width, height)},format=yuv420p[p{i}bg]"
        )
        scale = float(layout.get("pipScale") or 0.3)
        corner = layout.get("pipCorner") or "BR"
        v_in_b, fit_b = resolve_pane(layout["withSourceId"])
        pw = max(2, int(width * scale))
        chain_b, _ = _layout_pane_chain(
            label=f"p{i}in",
            width=width,
            height=height,
            pw=pw,
            ph=max(2, int(height * scale)),
            fit=fit_b,
            fps=fps,
            in_idx=v_in_b,
            main_lo_s=lo_s,
            dur=dur,
            media_in_ms=int(w["windowStartMs"]),
        )
        parts.append(chain_b)
        margin = 24
        x = margin if corner in ("TL", "BL") else f"main_w-overlay_w-{margin}"
        y = margin if corner in ("TL", "TR") else f"main_h-overlay_h-{margin}"
        parts.append(f"[p{i}bg][p{i}in]overlay=x={x}:y={y}[{s_lbl}]")
    elif kind == "grid":
        ids = [w["sourceId"], layout["withSourceId"], layout.get("withSourceId2"), layout.get("withSourceId3")]
        cells = [x for x in ids if x][:4]
        while len(cells) < 4:
            cells.append("main")
        for ci, sid in enumerate(cells):
            lbl = f"g{i}{ci}"
            if sid == w["sourceId"]:
                parts.append(
                    f"[{primary_v_in}:v]trim=0:{dur:.3f},setpts=PTS-STARTPTS,fps={fps:g},"
                    f"{fit_filter(w.get('fit') or 'cover', width // 2, height // 2)},format=yuv420p[{lbl}]"
                )
            else:
                v_in_c, fit_c = resolve_pane(sid)
                chain_c, _ = _layout_pane_chain(
                    label=lbl,
                    width=width,
                    height=height,
                    pw=width // 2,
                    ph=height // 2,
                    fit=fit_c,
                    fps=fps,
                    in_idx=v_in_c,
                    main_lo_s=lo_s,
                    dur=dur,
                    media_in_ms=int(w["windowStartMs"]),
                )
                parts.append(chain_c)
        parts.append(f"[g{i}0][g{i}1]hstack=inputs=2[gt{i}0]")
        parts.append(f"[g{i}2][g{i}3]hstack=inputs=2[gt{i}1]")
        parts.append(f"[gt{i}0][gt{i}1]vstack=inputs=2[{s_lbl}]")
    return in_idx, s_lbl


def build_sources_filtergraph(
    windows: list[dict],
    paths: list[Path],
    width: int,
    height: int,
    fps: float,
    *,
    main_has_audio: bool,
    source_has_audio: list[bool],
    base_duration_s: float = 0.0,
    edits: dict | None = None,
    media: dict[str, Path] | None = None,
) -> tuple[list[str], str, str, str | None]:
    """Inputs (after the base at index 0), filter_complex, video label, audio label (None = copy)."""
    inputs: list[str] = []
    parts: list[str] = ["[0:v]setsar=1,format=yuv420p[vb0]"]
    cur = "vb0"
    audio_parts: list[str] = []
    mute: list[str] = []
    a_labels: list[str] = []
    in_idx = 1
    for i, (w, p) in enumerate(zip(windows, paths)):
        t0 = w["t0Ms"] / 1000.0
        t1 = w["t1Ms"] / 1000.0
        dur = max(0.04, t1 - t0)
        if w["mediaType"] == "image":
            inputs += ["-loop", "1", "-framerate", f"{fps:g}", "-t", f"{dur + 0.1:.3f}", "-i", str(p)]
            chain = f"[{in_idx}:v]{fit_filter(w['fit'], width, height)},fps={fps:g},format=yuv420p"
            in_idx += 1
        elif w["mediaType"] == "audio":
            inputs += ["-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:r={fps}:d={dur + 0.1:.3f}"]
            v_in = in_idx
            in_idx += 1
            inputs += ["-ss", f"{w['mediaInMs'] / 1000.0:.3f}", "-t", f"{dur + 0.25:.3f}", "-i", str(p)]
            a_in = in_idx
            in_idx += 1
            chain = f"[{v_in}:v]fps={fps:g},format=yuv420p,setpts=PTS-STARTPTS+{t0:.3f}/TB[s{i}]"
            parts.append(chain)
            nxt = f"vb{i + 1}"
            parts.append(f"[{cur}][s{i}]overlay=eof_action=pass:enable='between(t,{t0:.3f},{t1:.3f})'[{nxt}]")
            cur = nxt
            ms = int(round(t0 * 1000))
            audio_parts.append(
                f"[{a_in}:a]atrim=0:{dur:.3f},asetpts=PTS-STARTPTS,aresample=48000,"
                f"aformat=sample_fmts=fltp:channel_layouts=stereo,adelay={ms}|{ms}[sa{i}]"
            )
            a_labels.append(f"[sa{i}]")
            mute.append(f"between(t,{t0:.3f},{t1:.3f})")
            continue
        else:
            inputs += ["-ss", f"{w['mediaInMs'] / 1000.0:.3f}", "-t", f"{dur + 0.25:.3f}", "-i", str(p)]
            chain = (f"[{in_idx}:v]trim=0:{dur:.3f},setpts=PTS-STARTPTS,fps={fps:g},"
                     f"{fit_filter(w['fit'], width, height)},format=yuv420p")
            v_in = in_idx
            in_idx += 1
            layout = w.get("layout")
            if layout and edits and media:
                in_idx, s_lbl = _append_layout_composite(
                    i,
                    w,
                    layout,
                    parts=parts,
                    inputs=inputs,
                    in_idx=in_idx,
                    width=width,
                    height=height,
                    fps=fps,
                    t0=t0,
                    t1=t1,
                    dur=dur,
                    primary_v_in=v_in,
                    edits=edits,
                    media=media,
                )
                parts.append(f"[{s_lbl}]setpts=PTS-STARTPTS+{t0:.3f}/TB[s{i}]")
            else:
                parts.append(f"{chain},setpts=PTS-STARTPTS+{t0:.3f}/TB[s{i}]")
            nxt = f"vb{i + 1}"
            parts.append(f"[{cur}][s{i}]overlay=eof_action=pass:enable='between(t,{t0:.3f},{t1:.3f})'[{nxt}]")
            cur = nxt
            mode = w["audio"]
            if mode in ("source", "mix") and w["mediaType"] == "video" and source_has_audio[i]:
                ms = int(round(t0 * 1000))
                audio_parts.append(
                    f"[{v_in}:a]atrim=0:{dur:.3f},asetpts=PTS-STARTPTS,aresample=48000,"
                    f"aformat=sample_fmts=fltp:channel_layouts=stereo,adelay={ms}|{ms}[sa{i}]"
                )
                a_labels.append(f"[sa{i}]")
            if mode == "source":
                mute.append(f"between(t,{t0:.3f},{t1:.3f})")
            continue
    alabel: str | None = None
    if (mute or a_labels) and main_has_audio:
        main = "[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo"
        if mute:
            main += f",volume=0:enable='{'+'.join(mute)}'"
        audio_parts.append(f"{main}[ma]")
        if a_labels:
            audio_parts.append(
                f"[ma]{''.join(a_labels)}amix=inputs={len(a_labels) + 1}:duration=first:dropout_transition=0:normalize=0[aout]"
            )
            alabel = "aout"
        else:
            alabel = "ma"
    elif a_labels and not main_has_audio:
        audio_parts.append(
            f"anullsrc=r=48000:cl=stereo,atrim=0:{max(0.1, base_duration_s):.3f},aformat=sample_fmts=fltp[sil];"
            f"[sil]{''.join(a_labels)}amix=inputs={len(a_labels) + 1}:duration=first:dropout_transition=0:normalize=0[aout]"
        )
        alabel = "aout"
    fc = ";".join(parts + audio_parts)
    return inputs, fc, cur, alabel


def apply_full_render_sources(
    full_render: Path,
    edits: dict,
    clip_start_ms: int,
    clip_end_ms: int,
    work_dir: Path,
    media: dict[str, Path] | None,
) -> Path:
    """Composite E5 source segments onto full_render (source time). Returns full_render if none."""
    windows = source_windows(edits, clip_start_ms, clip_end_ms)
    if not windows or not media:
        return full_render
    usable: list[dict] = []
    paths: list[Path] = []
    for w in windows:
        p = media_path_for(edits, w["sourceId"], media)
        if p is None or not Path(p).is_file():
            print(f"[clipper:sources] skip {w['id']} (media missing)", flush=True)
            continue
        usable.append(w)
        paths.append(Path(p))
    if not usable:
        return full_render
    width, height = probe_size(full_render)
    fps = probe_fps(full_render)
    inputs, fc, vlabel, alabel = build_sources_filtergraph(
        usable,
        paths,
        width,
        height,
        fps,
        main_has_audio=has_audio_stream(full_render),
        source_has_audio=[(w["mediaType"] == "audio" or has_audio_stream(p)) for w, p in zip(usable, paths)],
        base_duration_s=(clip_end_ms - clip_start_ms) / 1000.0,
        edits=edits,
        media=media,
    )
    out = Path(work_dir) / "full_render_sources.mp4"
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(full_render), *inputs, "-filter_complex", fc,
           "-map", f"[{vlabel}]"]
    if alabel:
        cmd += ["-map", f"[{alabel}]", "-c:a", "aac", "-b:a", "192k"]
    else:
        cmd += ["-map", "0:a?", "-c:a", "copy"]
    cmd += ["-r", f"{fps:g}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", str(out)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"sources composite failed: {(proc.stderr or '')[-800:]}")
    print(f"[clipper:sources] {json.dumps({'segments': len(usable), 'audio': alabel or 'copy'})}", flush=True)
    return out


def upload_broll_spec_path(item: dict, media: dict[str, Path], work_dir: Path, pos: int) -> Path | None:
    """Local video for an upload B-roll item (stills become a clip of the item's length)."""
    p = media.get(str(item.get("uploadId") or ""))
    if p is None:
        return None
    if item.get("still"):
        dur = max(0.1, (int(item["endMs"]) - int(item["startMs"])) / 1000.0)
        return still_to_video(p, Path(work_dir) / f"broll_still_{pos}.mp4", dur + 0.2)
    return p


def prepare_canvas_bg_image(edits: dict, media_paths: dict[str, Path], work_dir: Path) -> dict:
    """CV-09: flatten canvas background image to work_dir/canvas_bg.png for ffmpeg movie=."""
    cb = edits.get("canvasBg") if isinstance(edits.get("canvasBg"), dict) else {}
    if cb.get("type") != "image":
        return edits
    image_id = str(cb.get("imageId") or "")
    src = media_paths.get(image_id)
    out_png = Path(work_dir) / "canvas_bg.png"
    if not src or not src.is_file():
        print(
            json.dumps({"decision": "editor", "event": "canvas_bg_image_missing", "imageId": image_id}),
            flush=True,
        )
        return {**edits, "canvasBg": {"type": "none"}}
    try:
        subprocess.check_call(
            [
                "ffmpeg",
                "-v",
                "error",
                "-y",
                "-i",
                str(src),
                "-frames:v",
                "1",
                "-vf",
                "scale='min(2160,iw)':-2,format=rgba,premultiply=inplace=1,format=rgb24",
                str(out_png),
            ],
        )
    except (subprocess.CalledProcessError, OSError) as err:
        print(
            json.dumps(
                {
                    "decision": "editor",
                    "event": "canvas_bg_image_missing",
                    "imageId": image_id,
                    "error": str(err),
                }
            ),
            flush=True,
        )
        return {**edits, "canvasBg": {"type": "none"}}
    return {**edits, "_canvasBgPath": str(out_png)}
