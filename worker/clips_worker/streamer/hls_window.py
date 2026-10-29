"""Deterministic HLS window fetch with recorded vodStartMs (Batch AC)."""
from __future__ import annotations

import re
import subprocess
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path


class RetryableError(RuntimeError):
    pass


@dataclass(frozen=True)
class HlsSeg:
    idx: int
    uri: str
    start_ms: int
    dur_ms: int


@dataclass(frozen=True)
class WindowMedia:
    path: Path
    vod_start_ms: int
    vod_end_ms: int
    requested_start_ms: int
    requested_end_ms: int
    method: str
    rendition: str


_EXTINF_RE = re.compile(r"#EXTINF:([\d.]+)")


def parse_media_playlist(text: str, base_url: str) -> list[HlsSeg]:
    lines = text.splitlines()
    segs: list[HlsSeg] = []
    cum = 0
    idx = 0
    pending_dur_ms: int | None = None
    base = base_url.rsplit("/", 1)[0] + "/"
    for line in lines:
        line = line.strip()
        m = _EXTINF_RE.match(line)
        if m:
            pending_dur_ms = int(round(float(m.group(1)) * 1000))
            continue
        if pending_dur_ms is not None and line and not line.startswith("#"):
            uri = urllib.parse.urljoin(base, line)
            segs.append(HlsSeg(idx=idx, uri=uri, start_ms=cum, dur_ms=pending_dur_ms))
            cum += pending_dur_ms
            idx += 1
            pending_dur_ms = None
    return segs


def select_segments(segs: list[HlsSeg], start_ms: int, end_ms: int) -> tuple[int, int]:
    if not segs:
        raise ValueError("empty playlist")
    k0 = 0
    for i, s in enumerate(segs):
        if s.start_ms <= start_ms:
            k0 = i
    k1 = k0
    for i in range(k0, len(segs)):
        s = segs[i]
        if s.start_ms + s.dur_ms >= end_ms:
            k1 = i
            break
        k1 = i
    return k0, k1


def _http_get(url: str, timeout: int = 60) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "transovo-clips/1"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _ffprobe_duration_ms(path: Path) -> int:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        text=True,
    ).strip()
    return int(round(float(out or "0") * 1000))


def resolve_rendition_playlist(meta: dict, *, want: str) -> str:
    """Pick m3u8_native URL from yt-dlp -J metadata."""
    formats = meta.get("formats") or []
    if not isinstance(formats, list):
        raise ValueError("no formats in metadata")

    def _is_hls(f: dict) -> bool:
        proto = str(f.get("protocol") or "")
        url = str(f.get("url") or "")
        return "m3u8" in proto or "m3u8" in url

    if want == "audio_only":
        candidates = [
            f
            for f in formats
            if _is_hls(f) and str(f.get("vcodec") or "none") in ("none", "None", "")
        ]
        if not candidates:
            candidates = [f for f in formats if _is_hls(f) and not f.get("height")]
    else:
        candidates = [
            f
            for f in formats
            if _is_hls(f)
            and int(f.get("height") or 0) <= 720
            and str(f.get("vcodec") or "none") not in ("none", "None", "")
        ]
        candidates.sort(key=lambda f: (-int(f.get("height") or 0), -int(f.get("tbr") or 0)))
    if not candidates:
        for f in formats:
            if _is_hls(f) and f.get("url"):
                return str(f["url"])
        raise ValueError(f"no HLS rendition for want={want}")
    return str(candidates[0]["url"])


def fetch_window(
    playlist_url: str,
    start_ms: int,
    end_ms: int,
    dest: Path,
    *,
    segs: list[HlsSeg] | None = None,
    download_segment_fn=None,
) -> WindowMedia:
    """
    Download covering HLS segments and concat to dest.
    `download_segment_fn(uri, path)` optional for tests.
    """
    if segs is None:
        segs = parse_media_playlist(_http_get(playlist_url), playlist_url)
    k0, k1 = select_segments(segs, start_ms, end_ms)
    vod_start = segs[k0].start_ms
    vod_end = segs[k1].start_ms + segs[k1].dur_ms
    dest.parent.mkdir(parents=True, exist_ok=True)
    td = dest.parent
    part_paths: list[Path] = []
    for i in range(k0, k1 + 1):
        part = td / f"hls_part_{i}.ts"
        uri = segs[i].uri
        if download_segment_fn:
            download_segment_fn(uri, part)
        else:
            data = urllib.request.urlopen(uri, timeout=120).read()
            part.write_bytes(data)
        part_paths.append(part)
    list_file = td / "concat.txt"
    list_file.write_text("\n".join(f"file '{p}'" for p in part_paths), encoding="utf-8")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_file),
            "-c",
            "copy",
            "-avoid_negative_ts",
            "make_zero",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    probed = _ffprobe_duration_ms(dest)
    expected = sum(segs[i].dur_ms for i in range(k0, k1 + 1))
    if abs(probed - expected) > 500:
        raise RetryableError(f"duration mismatch probed={probed} expected={expected}")
    return WindowMedia(
        path=dest,
        vod_start_ms=vod_start,
        vod_end_ms=vod_end,
        requested_start_ms=int(start_ms),
        requested_end_ms=int(end_ms),
        method="hls_segments",
        rendition="media",
    )
