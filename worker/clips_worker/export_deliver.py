"""Post-render deliver pass (EX-09–15): transcode, scale, trim, alternate formats."""
from __future__ import annotations

import json
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path

DEFAULT = None  # normalize_deliver returns None for default mp4 path


def normalize_deliver(raw) -> dict | None:
    if not raw or not isinstance(raw, dict):
        return None
    fmt = str(raw.get("format") or "mp4")
    codec = raw.get("codec", "h264")
    quality = raw.get("quality", "standard")
    fps = raw.get("fps", "source")
    if (
        fmt == "mp4"
        and codec in (None, "h264")
        and quality in (None, "standard")
        and fps in (None, "source")
        and not raw.get("targetResolution")
        and raw.get("rangeInMs") is None
        and raw.get("rangeOutMs") is None
        and raw.get("stillAtMs") is None
        and not raw.get("softSubs")
        and not raw.get("stems")
    ):
        return None
    out = dict(raw)
    out.setdefault("format", "mp4")
    out.setdefault("codec", "h264")
    out.setdefault("quality", "standard")
    out.setdefault("fps", "source")
    return out


def srt_slice(body: str, in_ms: int | None, out_ms: int | None) -> str:
    if not body or in_ms is None or out_ms is None:
        return body or ""
    lines = body.splitlines()
    out_lines: list[str] = []
    i = 0
    shift = in_ms / 1000.0
    end = out_ms / 1000.0
    while i < len(lines):
        if i + 1 < len(lines) and "-->" in lines[i + 1]:
            try:
                a, b = lines[i + 1].split("-->")
                def _t(s):
                    s = s.strip().replace(",", ".")
                    h, m, rest = s.split(":")
                    sec = float(rest)
                    return int(h) * 3600 + int(m) * 60 + sec

                t0, t1 = _t(a), _t(b)
            except Exception:
                i += 1
                continue
            if t1 <= in_ms / 1000.0 or t0 >= out_ms / 1000.0:
                i += 4
                continue
            t0 = max(0.0, t0 - shift)
            t1 = min(end - shift, t1 - shift)
            if t1 <= t0:
                i += 4
                continue

            def _fmt(t):
                ms = int(round(t * 1000))
                h, rem = divmod(ms, 3600_000)
                m, rem = divmod(rem, 60_000)
                s, ms = divmod(rem, 1000)
                return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

            out_lines.append(lines[i])
            out_lines.append(f"{_fmt(t0)} --> {_fmt(t1)}")
            out_lines.extend(lines[i + 2 : i + 4])
            i += 4
        else:
            i += 1
    return "\n".join(out_lines) + ("\n" if out_lines else "")


def _crf(codec: str, quality: str) -> int:
    if codec == "hevc":
        return {"standard": 28, "high": 25, "max": 22}.get(quality, 28)
    return {"standard": 23, "high": 20, "max": 17}.get(quality, 23)


def _scale_filter(target: str | None, aspect_w: int, aspect_h: int) -> str:
    if target not in ("1440p", "2160p"):
        return ""
    short = 1440 if target == "1440p" else 2160
    if aspect_w >= aspect_h:
        w = int(round(short * aspect_w / aspect_h))
        h = short
    else:
        w = short
        h = int(round(short * aspect_h / aspect_w))
    w -= w % 2
    h -= h % 2
    return f"scale={w}:{h}:flags=lanczos"


def deliver_cmd(
    src: Path,
    dest: Path,
    deliver: dict,
    *,
    srt_path: Path | None = None,
    aspect_w: int = 16,
    aspect_h: int = 9,
) -> list[str]:
    fmt = deliver.get("format") or "mp4"
    codec = deliver.get("codec") or "h264"
    quality = deliver.get("quality") or "standard"
    fps = deliver.get("fps") or "source"
    target = deliver.get("targetResolution")
    rin = deliver.get("rangeInMs")
    rout = deliver.get("rangeOutMs")
    still = deliver.get("stillAtMs")
    soft = deliver.get("softSubs")

    vf: list[str] = []
    if rin is not None and rout is not None:
        ss = rin / 1000.0
        to = rout / 1000.0
    else:
        ss = None
        to = None

    if fmt == "png":
        t = (still or 0) / 1000.0
        sc = _scale_filter(target, aspect_w, aspect_h)
        vf_part = ",".join([x for x in [sc] if x])
        cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", str(src), "-frames:v", "1"]
        if vf_part:
            cmd += ["-vf", vf_part]
        cmd += [str(dest)]
        return cmd

    if fmt == "gif":
        gf = int(fps) if isinstance(fps, (int, float)) else 12
        vf.append(f"fps={gf}")
        vf.append("scale=720:-2:flags=lanczos")
        vf.append("split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3")
    else:
        if fps not in (None, "source") and str(fps) != "source":
            vf.append(f"fps={int(fps)}")
        sc = _scale_filter(target, aspect_w, aspect_h)
        if sc:
            vf.append(sc)

    cmd = ["ffmpeg", "-y", "-v", "error"]
    if ss is not None:
        cmd += ["-ss", f"{ss:.3f}"]
    cmd += ["-i", str(src)]
    if to is not None and ss is not None:
        cmd += ["-to", f"{to - ss:.3f}"]
    if srt_path and soft and fmt in ("mp4", "mov"):
        cmd += ["-i", str(srt_path)]

    if vf:
        cmd += ["-vf", ",".join(vf)]

    if fmt in ("mp3", "wav", "m4a", "flac"):
        cmd += ["-vn"]
        if fmt == "mp3":
            cmd += ["-c:a", "libmp3lame", "-b:a", "192k"]
        elif fmt == "wav":
            cmd += ["-c:a", "pcm_s16le", "-ar", "48000"]
        elif fmt == "m4a":
            cmd += ["-c:a", "aac", "-b:a", "192k"]
        else:
            cmd += ["-c:a", "flac"]
    elif fmt == "gif":
        cmd += ["-an"]
    else:
        vcodec = "libx265" if codec == "hevc" else "libx264"
        cmd += ["-c:v", vcodec, "-preset", "medium", "-crf", str(_crf(codec, quality)), "-pix_fmt", "yuv420p"]
        if codec == "hevc":
            cmd += ["-tag:v", "hvc1"]
        cmd += ["-c:a", "aac", "-b:a", "192k"]
        if fmt == "mov":
            cmd += ["-f", "mov"]
        cmd += ["-movflags", "+faststart"]
        if srt_path and soft:
            cmd += ["-c:s", "mov_text", "-metadata:s:s:0", "language=eng"]

    cmd.append(str(dest))
    return cmd


@lru_cache(maxsize=1)
def _encoders() -> set[str]:
    try:
        out = subprocess.check_output(["ffmpeg", "-hide_banner", "-encoders"], text=True, stderr=subprocess.STDOUT)
    except Exception:
        return set()
    enc = set()
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[0].endswith("."):
            enc.add(parts[1])
    return enc


def encoder_available(name: str) -> bool:
    return name in _encoders()


def deliver_time_factor(deliver: dict | None) -> float:
    if not deliver:
        return 1.0
    f = 1.0
    if deliver.get("targetResolution") == "2160p":
        f *= 2.5
    elif deliver.get("targetResolution") == "1440p":
        f *= 1.6
    if deliver.get("codec") == "hevc":
        f *= 1.6
    return f


_EXT = {
    "mp4": ("mp4", "video/mp4"),
    "mov": ("mov", "video/quicktime"),
    "gif": ("gif", "image/gif"),
    "mp3": ("mp3", "audio/mpeg"),
    "wav": ("wav", "audio/wav"),
    "m4a": ("m4a", "audio/mp4"),
    "flac": ("flac", "audio/flac"),
    "png": ("png", "image/png"),
}


def deliver(src: Path, work: Path, deliver_spec: dict, srt_body: str | None) -> tuple[Path, str, str]:
    spec = dict(deliver_spec)
    fmt = spec.get("format") or "mp4"
    if fmt == "mp3" and not encoder_available("libmp3lame"):
        spec["format"] = "m4a"
        fmt = "m4a"
    ext, ctype = _EXT.get(fmt, ("mp4", "video/mp4"))
    out = work / f"deliver.{ext}"
    srt_p = None
    if srt_body and deliver_spec.get("softSubs") and fmt in ("mp4", "mov"):
        srt_p = work / "subs.srt"
        srt_p.write_text(srt_body, encoding="utf-8")
    rin, rout = deliver_spec.get("rangeInMs"), deliver_spec.get("rangeOutMs")
    if srt_body and rin is not None and rout is not None:
        srt_body = srt_slice(srt_body, rin, rout)
        if srt_p:
            srt_p.write_text(srt_body, encoding="utf-8")

    vcodec = "libx265" if spec.get("codec") == "hevc" else "libx264"
    if fmt in ("mp4", "mov") and spec.get("codec") == "hevc" and not encoder_available("libx265"):
        raise RuntimeError("Export format not available: libx265")

    cmd = deliver_cmd(src, out, spec, srt_path=srt_p)
    subprocess.check_call(cmd)
    return out, ext, ctype
