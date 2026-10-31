"""FV2: editor assets for full-video projects ONLY (never for clips — John: no extra B2 files).

Per full-video project, next to each other under ``ws/<ws>/projects/<proj>/editor/``:
  * ``peaks.json``        compact waveform: uint8 peaks (base64) at 20/s (~96 KB per hour)
  * ``filmstrip_NNN.jpg`` sprite sheets of small frame thumbnails (10x10 tiles, 90 px tall),
                          1 thumb every N s (N adaptive: <= ~600 thumbs per video)
  * ``proxy_720.mp4``     720p / ~2 Mbps playback copy, only when the source is heavier than that

Peaks + filmstrip are made before the project turns READY (audio decode + keyframe-only decode,
seconds to a minute for an hour). The proxy is made after READY (the editor plays the original
until then) and is skipped when the source is already light.
"""
from __future__ import annotations

import base64
import json
import math
import os
import subprocess
from pathlib import Path

PEAKS_PER_SEC = 20
PEAKS_SAMPLE_RATE = 8000
FILMSTRIP_TILE_H = 90
FILMSTRIP_COLS = 10
FILMSTRIP_ROWS = 10
FILMSTRIP_MAX_THUMBS = 600
_NICE_INTERVALS_S = (1, 2, 3, 5, 10, 15, 20, 30, 60)
PROXY_MAX_H = 720
PROXY_SKIP_MAX_BPS = 3_000_000


def editor_asset_prefix(workspace_id: str, project_id: str) -> str:
    return f"ws/{workspace_id}/projects/{project_id}/editor"


def filmstrip_interval_s(dur_ms: int, max_thumbs: int = FILMSTRIP_MAX_THUMBS) -> int:
    """Smallest 'nice' interval that keeps the thumb count <= max_thumbs (1 s for short media)."""
    dur_s = max(0.0, dur_ms / 1000.0)
    need = dur_s / max(1, max_thumbs)
    for n in _NICE_INTERVALS_S:
        if n >= need:
            return n
    return int(math.ceil(need))


def filmstrip_tile_w(src_w: int, src_h: int, tile_h: int = FILMSTRIP_TILE_H) -> int:
    if src_w <= 0 or src_h <= 0:
        src_w, src_h = 16, 9
    w = int(round(tile_h * src_w / src_h / 2.0)) * 2
    return max(30, min(240, w))


def encode_peaks(values: list[float], peaks_per_sec: float, duration_ms: int) -> dict:
    top = max(values) if values else 0.0
    scale = 255.0 / top if top > 0 else 0.0
    data = bytes(min(255, int(round(v * scale))) for v in values)
    return {
        "v": 1,
        "peaksPerSec": peaks_per_sec,
        "durationMs": int(duration_ms),
        "format": "u8b64",
        "data": base64.b64encode(data).decode("ascii"),
    }


def compute_peaks(src: Path, duration_ms: int, peaks_per_sec: int = PEAKS_PER_SEC) -> dict:
    """Stream mono 8 kHz PCM out of ffmpeg and keep one |max| per bucket (constant memory)."""
    import numpy as np

    block = PEAKS_SAMPLE_RATE // peaks_per_sec
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-nostdin", "-i", str(src), "-vn", "-ac", "1", "-ar", str(PEAKS_SAMPLE_RATE),
         "-f", "s16le", "-"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    out: list[float] = []
    carry = np.zeros(0, dtype=np.int16)
    chunk_bytes = block * 2 * 2000
    assert proc.stdout is not None
    while True:
        buf = proc.stdout.read(chunk_bytes)
        if not buf:
            break
        arr = np.frombuffer(buf[: len(buf) - (len(buf) % 2)], dtype=np.int16)
        if carry.size:
            arr = np.concatenate([carry, arr])
        n = (arr.size // block) * block
        if n:
            m = np.abs(arr[:n].astype(np.int32)).reshape(-1, block).max(axis=1)
            out.extend((m / 32768.0).tolist())
        carry = arr[n:].copy()
    if carry.size:
        out.append(float(np.abs(carry.astype(np.int32)).max()) / 32768.0)
    proc.wait()
    return encode_peaks(out, float(peaks_per_sec), duration_ms)


def build_filmstrip(src: Path, out_dir: Path, dur_ms: int, src_w: int, src_h: int) -> dict | None:
    """Keyframe-only decode → fps=1/N → scale → 10x10 tiles. Returns the sheet layout or None."""
    interval = filmstrip_interval_s(dur_ms)
    tile_w = filmstrip_tile_w(src_w, src_h)
    count = max(1, int(math.ceil(dur_ms / 1000.0 / interval)))
    out_dir.mkdir(parents=True, exist_ok=True)
    pattern = out_dir / "filmstrip_%03d.jpg"
    vf = (
        f"fps=1/{interval}:round=down,scale={tile_w}:{FILMSTRIP_TILE_H}:flags=fast_bilinear,"
        f"tile={FILMSTRIP_COLS}x{FILMSTRIP_ROWS}"
    )
    cmd = ["ffmpeg", "-v", "error", "-nostdin", "-y"]
    if dur_ms > 10 * 60 * 1000:
        # Long media: decode keyframes only (an hour in seconds). Thumbs land on the nearest keyframe;
        # the editor refines visible frames client-side when zoomed in.
        cmd += ["-skip_frame", "nokey"]
    cmd += ["-i", str(src), "-an", "-sn", "-vf", vf, "-vsync", "0", "-q:v", "6", str(pattern)]
    timeout = max(120.0, dur_ms / 1000.0 / 4.0)
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=timeout)
    except Exception as exc:
        print(f"[clipper:fullvideo] filmstrip_skip err={type(exc).__name__}", flush=True)
        return None
    sheets = sorted(out_dir.glob("filmstrip_*.jpg"))
    if not sheets:
        return None
    per = FILMSTRIP_COLS * FILMSTRIP_ROWS
    count = min(count, len(sheets) * per)
    return {
        "intervalMs": interval * 1000,
        "tileW": tile_w,
        "tileH": FILMSTRIP_TILE_H,
        "cols": FILMSTRIP_COLS,
        "rows": FILMSTRIP_ROWS,
        "count": count,
        "files": [str(p) for p in sheets],
    }


def probe_stream(src: Path) -> dict:
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
             "stream=width,height,codec_name:format=bit_rate", "-of", "json", str(src)],
            text=True,
        )
        j = json.loads(out)
        st = (j.get("streams") or [{}])[0]
        return {
            "width": int(st.get("width") or 0),
            "height": int(st.get("height") or 0),
            "codec": str(st.get("codec_name") or ""),
            "bitRate": int((j.get("format") or {}).get("bit_rate") or 0),
        }
    except Exception:
        return {"width": 0, "height": 0, "codec": "", "bitRate": 0}


def proxy_needed(info: dict) -> bool:
    """Skip the proxy (no extra file) when the original is already light enough to scrub."""
    h = int(info.get("height") or 0)
    w = int(info.get("width") or 0)
    br = int(info.get("bitRate") or 0)
    light = min(w, h) <= PROXY_MAX_H and 0 < br <= PROXY_SKIP_MAX_BPS and info.get("codec") == "h264"
    return not light


def build_proxy(src: Path, out: Path, dur_ms: int, threads: int) -> bool:
    """720p H.264 ~2 Mbps, keyframe every 2 s (snappy seeks), AAC audio, faststart."""
    cmd = [
        "ffmpeg", "-v", "error", "-nostdin", "-y", "-i", str(src),
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", f"scale=-2:'min({PROXY_MAX_H},ih)'",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-maxrate", "2M", "-bufsize", "4M",
        "-force_key_frames", "expr:gte(t,n_forced*2)", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "96k", "-ac", "2",
        "-threads", str(max(1, threads)), "-movflags", "+faststart", str(out),
    ]
    timeout = max(600.0, dur_ms / 1000.0 * 2.0)
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=timeout)
        return out.is_file() and out.stat().st_size > 0
    except Exception as exc:
        print(f"[clipper:fullvideo] proxy_fail err={type(exc).__name__}", flush=True)
        return False


def build_pre_ready_assets(
    src: Path,
    workspace_id: str,
    project_id: str,
    dur_ms: int,
    src_w: int,
    src_h: int,
    upload_file,
) -> dict:
    """Peaks + filmstrip, uploaded. Returns aiMeta.fullVideo fields (keys only, never URLs)."""
    prefix = editor_asset_prefix(workspace_id, project_id)
    meta: dict = {}
    work = src.parent / "fv_assets"
    work.mkdir(parents=True, exist_ok=True)
    try:
        peaks = compute_peaks(src, dur_ms)
        p = work / "peaks.json"
        p.write_text(json.dumps(peaks, separators=(",", ":")))
        upload_file(f"{prefix}/peaks.json", p, "application/json")
        meta["peaksKey"] = f"{prefix}/peaks.json"
    except Exception as exc:
        print(f"[clipper:fullvideo] peaks_skip err={type(exc).__name__}", flush=True)
    try:
        fs = build_filmstrip(src, work / "filmstrip", dur_ms, src_w, src_h)
        if fs:
            keys = []
            for f in fs.pop("files"):
                key = f"{prefix}/{Path(f).name}"
                upload_file(key, Path(f), "image/jpeg")
                keys.append(key)
            fs["keys"] = keys
            meta["filmstrip"] = fs
    except Exception as exc:
        print(f"[clipper:fullvideo] filmstrip_upload_skip err={type(exc).__name__}", flush=True)
    return meta


def build_and_attach_proxy(src: Path, workspace_id: str, project_id: str, dur_ms: int, upload_file) -> str | None:
    """After READY: make the 720p proxy (if needed), upload, set clip_projects.proxyKey."""
    if os.environ.get("FULL_VIDEO_PROXY", "1").strip() in ("0", "false", "off"):
        return None
    info = probe_stream(src)
    if not proxy_needed(info):
        print(f"[clipper:fullvideo] proxy_skip light_source project={project_id}", flush=True)
        return None
    try:
        from clips_worker.render_concurrency import ffmpeg_threads_per_job

        threads = max(2, ffmpeg_threads_per_job())
    except Exception:
        threads = 2
    out = src.parent / "proxy_720.mp4"
    if not build_proxy(src, out, dur_ms, threads):
        return None
    key = f"{editor_asset_prefix(workspace_id, project_id)}/proxy_720.mp4"
    upload_file(key, out, "video/mp4")
    set_project_proxy_key(project_id, key)
    out.unlink(missing_ok=True)
    print(f"[clipper:fullvideo] proxy_ready project={project_id}", flush=True)
    return key


def set_project_proxy_key(project_id: str, key: str) -> None:
    """Fresh connection: the job's conn may have idled for the whole encode."""
    import psycopg2

    with psycopg2.connect(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE clip_projects SET "proxyKey" = %s, "updatedAt" = NOW() WHERE id = %s',
                (key, project_id),
            )
        conn.commit()
