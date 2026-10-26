"""yt-dlp metadata + download helpers for streamer imports."""
from __future__ import annotations

import json
import re
import subprocess
from typing import Any

LIVE_MSG = "We never record live streams. Paste the VOD after the stream ends."


def map_ytdlp_error(stderr: str) -> str:
    s = stderr.lower()
    if "subscriber" in s or "requires authentication" in s:
        return "This VOD is subscriber-only. Download it from your dashboard and upload the file."
    if "does not exist" in s or "404" in s:
        return "VOD not found or deleted."
    if "403" in s or "geo" in s:
        return "Twitch/Kick refused the download. Try again later or upload the file."
    if "502" in s or "bad gateway" in s:
        return "Twitch/Kick CDN returned 502 Bad Gateway."
    if "503" in s or "service unavailable" in s:
        return "Upstream temporarily unavailable (503)."
    if "429" in s or "too many requests" in s:
        return "Rate limited by Twitch/Kick."
    return stderr.strip()[:500] or "Download failed"


def metadata(url: str, timeout_s: int = 60) -> dict[str, Any]:
    proc = subprocess.run(
        ["yt-dlp", "-J", "--no-download", "--no-playlist", url],
        capture_output=True,
        text=True,
        timeout=timeout_s,
    )
    if proc.returncode != 0:
        raise RuntimeError(map_ytdlp_error(proc.stderr or proc.stdout))
    data = json.loads(proc.stdout)
    live = data.get("is_live")
    live_status = (data.get("live_status") or "").lower()
    if live or live_status in ("is_live", "is_upcoming"):
        raise RuntimeError(LIVE_MSG)
    return data


def parse_metadata(data: dict[str, Any]) -> dict[str, Any]:
    chapters = []
    for ch in data.get("chapters") or []:
        chapters.append(
            {
                "startMs": int(float(ch.get("start_time", 0)) * 1000),
                "endMs": int(float(ch.get("end_time", 0)) * 1000),
                "category": ch.get("title"),
            }
        )
    ts = data.get("timestamp")
    return {
        "title": data.get("title") or data.get("fulltitle"),
        "channel": data.get("channel") or data.get("uploader"),
        "login": (data.get("uploader_id") or data.get("channel_id") or "").lower(),
        "duration_s": float(data.get("duration") or 0),
        "thumbnail": data.get("thumbnail"),
        "chapters": chapters or None,
        "streamed_at": ts,
        "category": (chapters[0].get("category") if chapters else None) or data.get("genre"),
    }


def download_video(url: str, dest: str, section: str | None = None, progress_cb=None) -> None:
    from clips_worker.streamer.http_download import run_ytdlp

    cmd = [
        "yt-dlp",
        "--retries",
        "5",
        "--fragment-retries",
        "10",
        "--continue",
        "-f",
        "bv*[height<=1080][fps<=60]+ba/b[height<=1080]/b",
        "--merge-output-format",
        "mp4",
        "-o",
        dest,
        "--newline",
    ]
    if section:
        cmd.extend(["--download-sections", section])
    cmd.append(url)
    run_ytdlp(cmd, progress_cb, step="Downloading video")


def download_audio(
    url: str,
    dest: str,
    section: str | None = None,
    progress_cb=None,
) -> None:
    from clips_worker.streamer.http_download import run_ytdlp

    cmd = [
        "yt-dlp",
        "--retries",
        "5",
        "--fragment-retries",
        "10",
        "--continue",
        "-f",
        "ba/b",
        "-x",
        "--audio-format",
        "opus",
        "--postprocessor-args",
        "ffmpeg:-ac 1 -ar 16000 -b:a 24k",
        "-o",
        dest,
        "--newline",
    ]
    if section:
        cmd.extend(["--download-sections", section])
    cmd.append(url)
    run_ytdlp(cmd, progress_cb, step="Downloading audio")
