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

from clips_worker.template_playback import (
    normalize_source_playback,
    playback_media_offset_ms,
    render_playback_window,
)

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


def _finite(raw, default: float = 0.0) -> float:
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return default
    return default if v != v or v in (float("inf"), float("-inf")) else v


def _normalize_source_fx(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    out: dict = {}
    for key in ("brightness", "contrast", "saturation"):
        value = _clamp(_finite(raw.get(key)), -100.0, 100.0)
        if abs(value) >= 0.001:
            out[key] = round(value, 2)
    return out or None


def _normalize_source_transform(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    out: dict = {}
    x = _clamp(_finite(raw.get("x")), -100.0, 100.0)
    y = _clamp(_finite(raw.get("y")), -100.0, 100.0)
    scale = _clamp(_finite(raw.get("scale"), 100.0), 25.0, 400.0)
    rotation = _clamp(_finite(raw.get("rotation")), -360.0, 360.0)
    l = _clamp(_finite(raw.get("cropL")), 0.0, 90.0)
    r = _clamp(_finite(raw.get("cropR")), 0.0, 90.0)
    t = _clamp(_finite(raw.get("cropT")), 0.0, 90.0)
    b = _clamp(_finite(raw.get("cropB")), 0.0, 90.0)
    if l + r > 95.0:
        r = max(0.0, 95.0 - l)
    if t + b > 95.0:
        b = max(0.0, 95.0 - t)
    for key, value, identity in (
        ("x", x, 0.0), ("y", y, 0.0), ("scale", scale, 100.0), ("rotation", rotation, 0.0),
        ("cropL", l, 0.0), ("cropR", r, 0.0), ("cropT", t, 0.0), ("cropB", b, 0.0),
    ):
        if abs(value - identity) >= 0.001:
            out[key] = round(value, 2)
    return out or None


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


def youtube_long_form_enabled(edits: dict) -> bool:
    """Versioned YouTube Story opt-in; legacy payloads retain the default limit."""
    return isinstance(edits, dict) and type(edits.get("youtubeLongFormAssembly")) is int and edits["youtubeLongFormAssembly"] == 1


def normalize_media_sources(raw, allow_youtube_long_form: bool = False) -> list[dict] | None:
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
        if not allow_youtube_long_form and len(out) >= MAX_SOURCES:
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
        playback = normalize_source_playback(r.get("playback")) if src["mediaType"] == "video" else None
        if r.get("playback") is not None and (
            not playback or src["mediaType"] != "video"
            or playback["outputFrames"] != round((b - a) * 30 / 1000)
            or r.get("speed") is not None
        ):
            raise ValueError("source playback: unsupported media, speed conflict or frame budget")
        if playback:
            seg["playback"] = playback
        else:
            try:
                rate = float(r.get("speed", 1))
            except (TypeError, ValueError):
                rate = 1.0
            if src["mediaType"] == "video" and 0.25 <= rate <= 4.0 and abs(rate - 1.0) >= 0.0001:
                seg["speed"] = round(rate, 3)
        transform = _normalize_source_transform(r.get("transform"))
        if transform:
            seg["transform"] = transform
        fx = _normalize_source_fx(r.get("fx"))
        if fx:
            seg["fx"] = fx
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
    return bool(src and src["mediaType"] == "video" and "syncMs" in src and "inMs" not in seg and "speed" not in seg and "playback" not in seg)


def segment_media_ms(seg: dict, src: dict | None, src_ms: int) -> int:
    if not src or src["mediaType"] == "image":
        return 0
    if _is_synced(seg, src):
        return max(0, src_ms + int(src.get("syncMs") or 0))
    if seg.get("playback"):
        local_ms = src_ms - int(seg["startMs"])
        mapped = int(seg.get("inMs") or 0) + playback_media_offset_ms(seg["playback"], local_ms)
        return max(0, int(round(mapped)))
    return max(0, int(round(int(seg.get("inMs") or 0) + (src_ms - int(seg["startMs"])) * float(seg.get("speed") or 1.0))))


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
    sources = normalize_media_sources(edits.get("sources"), youtube_long_form_enabled(edits)) or []
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
        if s.get("playback"):
            row["playback"] = s["playback"]
            row["playbackSourceInMs"] = int(s.get("inMs") or 0)
            row["playbackStartFrame"] = int(round((lo - int(s["startMs"])) * 30.0 / 1000.0))
            if src.get("durationMs"):
                row["sourceDurationMs"] = int(src["durationMs"])
        elif s.get("speed"):
            row["speed"] = s["speed"]
        if s.get("transform"):
            row["transform"] = s["transform"]
        if s.get("fx"):
            row["fx"] = s["fx"]
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
    sources = normalize_media_sources(edits.get("sources"), youtube_long_form_enabled(edits)) or []
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

    for ins in normalize_inserts(edits.get("inserts"), sources, youtube_long_form_enabled(edits)) or []:
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
    for s in normalize_media_sources(edits.get("sources"), youtube_long_form_enabled(edits)) or []:
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


def atempo_filter(rate: float) -> str:
    """FFmpeg atempo supports 0.5..2 per stage; chain for the B3 0.25..4 range."""
    r = max(0.25, min(4.0, float(rate or 1.0)))
    parts: list[float] = []
    while r > 2.0 + 1e-9:
        parts.append(2.0)
        r /= 2.0
    while r < 0.5 - 1e-9:
        parts.append(0.5)
        r /= 0.5
    if abs(r - 1.0) >= 1e-9:
        parts.append(r)
    return ",".join(f"atempo={x:.6f}" for x in parts)


def source_fx_filter(fx: dict | None) -> str:
    n = _normalize_source_fx(fx)
    if not n:
        return ""
    # Browser preview uses CSS brightness(multiplier) -> contrast -> saturate, in that order.
    # Mirror brightness with channel multipliers (not eq's additive brightness), then eq's
    # center-relative contrast and saturation. Keeping the operation order is important for parity.
    brightness = 1.0 + float(n.get("brightness", 0.0)) / 100.0
    contrast = 1.0 + float(n.get("contrast", 0.0)) / 100.0
    saturation = 1.0 + float(n.get("saturation", 0.0)) / 100.0
    return (
        f",colorchannelmixer=rr={brightness:.6f}:gg={brightness:.6f}:bb={brightness:.6f},"
        f"eq=contrast={contrast:.6f}:saturation={saturation:.6f}"
    )


def source_transform_filter(transform: dict | None, w: int, h: int) -> str:
    """B3 mirror of sourceSegmentTransformCss: crop mask, scale/rotate, then translate on black."""
    t = _normalize_source_transform(transform)
    if not t:
        return ""
    parts: list[str] = []
    l, r = float(t.get("cropL", 0)) / 100.0, float(t.get("cropR", 0)) / 100.0
    top, bot = float(t.get("cropT", 0)) / 100.0, float(t.get("cropB", 0)) / 100.0
    if l or r or top or bot:
        cw = max(2, int(round(w * (1.0 - l - r))) // 2 * 2)
        ch = max(2, int(round(h * (1.0 - top - bot))) // 2 * 2)
        cx = max(0, min(w - cw, int(round(w * l))))
        cy = max(0, min(h - ch, int(round(h * top))))
        # Keep the crop at its original frame position rather than stretching it.
        parts.append(f"crop={cw}:{ch}:{cx}:{cy}")
        parts.append(f"pad={w}:{h}:{cx}:{cy}:color=black")
    scale = float(t.get("scale", 100.0)) / 100.0
    if abs(scale - 1.0) >= 0.0001:
        sw = max(2, int(round(w * scale)) // 2 * 2)
        sh = max(2, int(round(h * scale)) // 2 * 2)
        parts.append(f"scale={sw}:{sh}")
        if scale >= 1.0:
            parts.append(f"crop={w}:{h}:(iw-{w})/2:(ih-{h})/2")
        else:
            parts.append(f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black")
    rotation = float(t.get("rotation", 0.0))
    if abs(rotation) >= 0.0001:
        parts.append(f"rotate={rotation}*PI/180:ow=iw:oh=ih:c=black")
    dx = int(round(float(t.get("x", 0.0)) * w / 100.0))
    dy = int(round(float(t.get("y", 0.0)) * h / 100.0))
    if dx or dy:
        ax, ay = abs(dx), abs(dy)
        parts.append(f"pad={w + 2 * ax}:{h + 2 * ay}:{ax}:{ay}:color=black")
        parts.append(f"crop={w}:{h}:{ax - dx}:{ay - dy}")
    return "," + ",".join(parts) if parts else ""


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
    by_id = {s["id"]: s for s in normalize_media_sources(edits.get("sources"), youtube_long_form_enabled(edits)) or []}
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
            chain = f"[{in_idx}:v]{fit_filter(w['fit'], width, height)}{source_transform_filter(w.get('transform'), width, height)}{source_fx_filter(w.get('fx'))},fps={fps:g},format=yuv420p"
            in_idx += 1
            # Still sources must be placed on the carrier clock and composited just like video.
            # Without this overlay, image-only template slots render as the black carrier.
            parts.append(f"{chain},setpts=PTS-STARTPTS+{t0:.3f}/TB[s{i}]")
            nxt = f"vb{i + 1}"
            parts.append(f"[{cur}][s{i}]overlay=eof_action=pass:enable='between(t,{t0:.3f},{t1:.3f})'[{nxt}]")
            cur = nxt
            continue
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
            speed = float(w.get("speed") or 1.0)
            media_dur = dur * speed
            inputs += ["-ss", f"{w['mediaInMs'] / 1000.0:.3f}", "-t", f"{media_dur + 0.25:.3f}", "-i", str(p)]
            # Preserve the legacy filtergraph exactly for absent/1x speed (golden parity).
            pts = "setpts=PTS-STARTPTS" if speed == 1.0 else f"setpts=(PTS-STARTPTS)/{speed:.6f}"
            chain = (f"[{in_idx}:v]trim=0:{media_dur:.3f},{pts},fps={fps:g},"
                     f"{fit_filter(w['fit'], width, height)}{source_transform_filter(w.get('transform'), width, height)}{source_fx_filter(w.get('fx'))},format=yuv420p")
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
                tempo = atempo_filter(speed)
                tempo_part = (tempo + ",") if tempo else ""
                audio_parts.append(
                    f"[{v_in}:a]atrim=0:{media_dur:.3f},asetpts=PTS-STARTPTS,{tempo_part}aresample=48000,"
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


def source_transition_boundaries(edits: dict) -> set[int]:
    """Template/source Video-split boundaries consumed by the direct source transition adapter."""
    if not isinstance(edits.get("templateProvenance"), dict):
        return set()
    splits = {
        int(round(float(x))) for x in (edits.get("videoSplits") or [])
        if isinstance(x, (int, float))
    }
    if not splits:
        return set()
    sources = normalize_media_sources(edits.get("sources"), youtube_long_form_enabled(edits)) or []
    segs = normalize_source_segments(edits.get("sourceSegments"), sources) or []
    transitions = edits.get("transitions") if isinstance(edits.get("transitions"), list) else []
    tr_points: set[int] = set()
    for tr in transitions:
        if not isinstance(tr, dict):
            continue
        try:
            src_ms = int(round(float(tr.get("srcMs"))))
        except (TypeError, ValueError):
            continue
        tr_points.add(src_ms)
    out: set[int] = set()
    for left, right in zip(segs, segs[1:]):
        boundary = int(right["startMs"])
        if abs(int(left["endMs"]) - boundary) <= 1 and boundary in splits and boundary in tr_points:
            out.add(boundary)
    return out


def _source_transition_rows(edits: dict, clip_start_ms: int, clip_end_ms: int, fps: float) -> list[dict]:
    """Cross-source transition windows on the source/carrier clock."""
    from clips_worker.motion import normalize_transition_spec

    boundaries = source_transition_boundaries(edits)
    if not boundaries:
        return []
    sources = normalize_media_sources(edits.get("sources"), youtube_long_form_enabled(edits)) or []
    by_id = {src["id"]: src for src in sources}
    segs = normalize_source_segments(edits.get("sourceSegments"), sources) or []
    trs = []
    for raw in edits.get("transitions") or []:
        if not isinstance(raw, dict):
            continue
        spec = normalize_transition_spec(raw)
        if not spec:
            continue
        try:
            src_ms = int(round(float(raw.get("srcMs"))))
        except (TypeError, ValueError):
            continue
        if src_ms in boundaries:
            trs.append((src_ms, spec))
    by_boundary = {src_ms: spec for src_ms, spec in trs}
    out: list[dict] = []
    last_end_frame = 0
    for left, right in zip(segs, segs[1:]):
        boundary = int(right["startMs"])
        spec = by_boundary.get(boundary)
        if not spec or abs(int(left["endMs"]) - boundary) > 1:
            continue
        left_src, right_src = by_id.get(left["sourceId"]), by_id.get(right["sourceId"])
        if not left_src or not right_src or left_src["mediaType"] == "audio" or right_src["mediaType"] == "audio":
            continue
        dur_ms = min(int(spec["durMs"]), int(left["endMs"]) - int(left["startMs"]), int(right["endMs"]) - int(right["startMs"]))
        frames = max(2, int(round(dur_ms * fps / 1000.0)))
        start_src_ms = boundary - dur_ms / 2.0
        start_frame = int(round((start_src_ms - clip_start_ms) * fps / 1000.0))
        start_frame = max(start_frame, last_end_frame, 0)
        end_frame_limit = int((clip_end_ms - clip_start_ms) * fps / 1000.0)
        frames = min(frames, end_frame_limit - start_frame)
        if frames < 2:
            continue
        last_end_frame = start_frame + frames
        actual_start_src_ms = clip_start_ms + start_frame * 1000.0 / fps
        out.append({
            "srcMs": boundary,
            "type": spec["type"],
            "durMs": dur_ms,
            "frames": frames,
            "startFrame": start_frame,
            "left": left,
            "right": right,
            "leftSource": left_src,
            "rightSource": right_src,
            "leftMediaMs": segment_media_ms(left, left_src, int(round(actual_start_src_ms))),
            "rightMediaMs": segment_media_ms(right, right_src, int(round(actual_start_src_ms))),
            "leftLocalFrame": int(round((actual_start_src_ms - int(left["startMs"])) * 30.0 / 1000.0)),
            "rightLocalFrame": int(round((actual_start_src_ms - int(right["startMs"])) * 30.0 / 1000.0)),
        })
    return out


def _render_source_transition_side(
    path: Path,
    source: dict,
    seg: dict,
    media_in_ms: int,
    local_frame: int,
    frames: int,
    width: int,
    height: int,
    fps: float,
    out: Path,
) -> None:
    if seg.get("playback"):
        if source["mediaType"] != "video":
            raise RuntimeError("source playback transition requires video")
        raw = out.with_name(out.stem + "_playback.mp4")
        render_playback_window(
            path,
            seg["playback"],
            int(seg.get("inMs") or 0),
            int(source["durationMs"]) if source.get("durationMs") else None,
            int(local_frame),
            int(frames),
            fps,
            raw,
            include_audio=False,
        )
        path = raw
        media_in_ms = 0
        seg = {k: v for k, v in seg.items() if k not in ("playback", "speed")}
        source = {**source, "mediaType": "video"}
    speed = float(seg.get("speed") or 1.0)
    speed_prefix = f"setpts=(PTS-STARTPTS)/{speed:.6f}," if source["mediaType"] == "video" and abs(speed - 1.0) >= 0.0001 else ""
    vf = (
        speed_prefix
        + fit_filter(seg.get("fit") or "cover", width, height)
        + source_transform_filter(seg.get("transform"), width, height)
        + source_fx_filter(seg.get("fx"))
        + f",fps={fps:g},format=yuv420p"
    )
    cmd = ["ffmpeg", "-y", "-v", "error"]
    if source["mediaType"] == "image":
        cmd += ["-loop", "1", "-framerate", f"{fps:g}", "-i", str(path)]
    else:
        cmd += ["-ss", f"{media_in_ms / 1000.0:.6f}", "-i", str(path)]
    cmd += [
        "-vf", vf, "-frames:v", str(frames + 1), "-an",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", str(out),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"source transition side failed: {(proc.stderr or '')[-800:]}")


def apply_source_segment_transitions(
    full_render: Path,
    edits: dict,
    clip_start_ms: int,
    clip_end_ms: int,
    work_dir: Path,
    media: dict[str, Path],
) -> Path:
    """Overlay cross-source Video-split transition windows using the two registered media assets."""
    from clips_worker.motion import SHADER_TRANSITIONS
    from clips_worker.motion_render import shader_rendered_window_filter, window_decode_cmd, xfade_window_filters

    width, height = probe_size(full_render)
    fps = probe_fps(full_render)
    windows = _source_transition_rows(edits, clip_start_ms, clip_end_ms, fps)
    if not windows:
        return full_render
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(full_render)]
    parts = ["[0:v]setsar=1,format=yuv420p[base]"]
    cur = "base"
    input_idx = 1
    rendered = 0
    for i, win in enumerate(windows):
        left_path = media_path_for(edits, win["left"]["sourceId"], media)
        right_path = media_path_for(edits, win["right"]["sourceId"], media)
        if not left_path or not right_path or not Path(left_path).is_file() or not Path(right_path).is_file():
            raise RuntimeError("source transition media missing")
        a = Path(work_dir) / f"source_transition_{i}_a.mp4"
        b = Path(work_dir) / f"source_transition_{i}_b.mp4"
        _render_source_transition_side(Path(left_path), win["leftSource"], win["left"], int(win["leftMediaMs"]),
                                       int(win["leftLocalFrame"]), int(win["frames"]), width, height, fps, a)
        _render_source_transition_side(Path(right_path), win["rightSource"], win["right"], int(win["rightMediaMs"]),
                                       int(win["rightLocalFrame"]), int(win["frames"]), width, height, fps, b)
        label = f"st{i}"
        w0 = win["startFrame"] / fps
        if win["type"] in SHADER_TRANSITIONS:
            if abs(fps - 30.0) > 0.01:
                raise RuntimeError("template shader transition requires 30fps")
            from clips_worker.shader_transitions import gl_context, render_window
            shader_out = Path(work_dir) / f"source_transition_{i}_shader.mkv"
            ctx, _renderer = gl_context()
            try:
                span = int(win["frames"]) / fps + 0.2
                render_window(
                    ctx,
                    win["type"],
                    window_decode_cmd(a, 0.0, span, 0.0, int(win["frames"]), width, height),
                    window_decode_cmd(b, 0.0, span, 0.0, int(win["frames"]), width, height),
                    int(win["frames"]),
                    width,
                    height,
                    shader_out,
                )
            finally:
                ctx.release()
            cmd += ["-i", str(shader_out)]
            parts.append(shader_rendered_window_filter(input_idx, int(win["frames"]), width, height, w0, label))
            input_idx += 1
        else:
            cmd += ["-i", str(a), "-i", str(b)]
            parts.append(xfade_window_filters(win, input_idx, input_idx + 1, width, height, label))
            input_idx += 2
        w1 = (win["startFrame"] + win["frames"]) / fps
        nxt = f"stbase{i}"
        parts.append(
            f"[{cur}][{label}]overlay=0:0:eof_action=pass:"
            f"enable='between(t,{w0 - 0.5 / fps:.6f},{w1 - 0.5 / fps:.6f})'[{nxt}]"
        )
        cur = nxt
        rendered += 1
    if not rendered:
        return full_render
    out = Path(work_dir) / "full_render_source_transitions.mp4"
    cmd += [
        "-filter_complex", ";".join(parts), "-map", f"[{cur}]", "-map", "0:a?",
        "-r", f"{fps:g}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "copy", str(out),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"source transitions failed: {(proc.stderr or '')[-1000:]}")
    print(f"[clipper:sources] source_transitions={rendered}", flush=True)
    return out


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
        if isinstance(edits.get("templateProvenance"), dict) and edits.get("sourceSegments"):
            raise RuntimeError("template source media unavailable; refusing black carrier fallback")
        return full_render
    usable: list[dict] = []
    paths: list[Path] = []
    for w in windows:
        p = media_path_for(edits, w["sourceId"], media)
        if p is None or not Path(p).is_file():
            if w.get("playback") or isinstance(edits.get("templateProvenance"), dict):
                raise RuntimeError("template source media missing; cannot render black fallback")
            print(f"[clipper:sources] skip {w['id']} (media missing)", flush=True)
            continue
        usable.append(w)
        paths.append(Path(p))
    if not usable:
        if isinstance(edits.get("templateProvenance"), dict):
            raise RuntimeError("template source windows unavailable; refusing black carrier fallback")
        return full_render
    width, height = probe_size(full_render)
    fps = probe_fps(full_render)
    prepared_usable: list[dict] = []
    prepared_paths: list[Path] = []
    for i, (window, source_path) in enumerate(zip(usable, paths)):
        playback = window.get("playback")
        if not playback:
            prepared_usable.append(window)
            prepared_paths.append(source_path)
            continue
        if abs(fps - 30.0) > 0.01:
            raise RuntimeError("template playback requires 30fps source clock")
        frame_count = max(1, int(round((int(window["t1Ms"]) - int(window["t0Ms"])) * 30.0 / 1000.0)))
        prepared = Path(work_dir) / f"source_playback_{i}.mp4"
        need_audio = window.get("audio") in ("source", "mix") and has_audio_stream(source_path)
        render_playback_window(
            source_path,
            playback,
            int(window.get("playbackSourceInMs") or 0),
            int(window["sourceDurationMs"]) if window.get("sourceDurationMs") else None,
            int(window.get("playbackStartFrame") or 0),
            frame_count,
            fps,
            prepared,
            include_audio=need_audio,
        )
        normalized = dict(window)
        for key in ("playback", "playbackSourceInMs", "playbackStartFrame", "sourceDurationMs", "speed"):
            normalized.pop(key, None)
        normalized["mediaInMs"] = 0
        prepared_usable.append(normalized)
        prepared_paths.append(prepared)
    usable = prepared_usable
    paths = prepared_paths
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
    return apply_source_segment_transitions(out, edits, clip_start_ms, clip_end_ms, work_dir, media)


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
