"""Resilient yt-dlp downloads with retries and clearer errors."""
from __future__ import annotations

import re
import subprocess
import time
from typing import Callable

from clips_worker.streamer.errors import RetryableError
from clips_worker.streamer.ytdlp import map_ytdlp_error


class YtdlpDownloadError(RuntimeError):
    """yt-dlp exited non-zero after retries."""

    def __init__(
        self,
        message: str,
        *,
        exit_code: int | None = None,
        stderr_tail: str = "",
        reason: str = "",
    ) -> None:
        super().__init__(message)
        self.exit_code = exit_code
        self.stderr_tail = (stderr_tail or "")[-4000:]
        self.reason = (reason or message or "download_failed")[:500]


def _stderr_error_line(stderr: str) -> str:
    for line in reversed((stderr or "").splitlines()):
        low = line.lower()
        if "error" in low or "failed" in low:
            return line.strip()[:500]
    return ""


def _friendly_step_error(stderr: str, step: str) -> str:
    s = (stderr or "").lower()
    if "502" in s or "bad gateway" in s:
        return f"{step}: Twitch/Kick CDN returned 502 Bad Gateway. We will retry automatically."
    if "503" in s or "service unavailable" in s:
        return f"{step}: upstream temporarily unavailable (503). We will retry automatically."
    if "429" in s or "too many requests" in s:
        return f"{step}: rate limited. We will retry automatically."
    mapped = map_ytdlp_error(stderr)
    if mapped and mapped != stderr.strip()[:500]:
        return f"{step}: {mapped}"
    return mapped or f"{step} failed"


def _is_retryable(stderr: str) -> bool:
    s = (stderr or "").lower()
    return any(
        x in s
        for x in (
            "502",
            "503",
            "429",
            "408",
            "bad gateway",
            "service unavailable",
            "too many requests",
            "timed out",
            "timeout",
            "connection reset",
            "temporary failure",
        )
    )


def run_ytdlp(cmd: list[str], progress_cb: Callable[[float], None] | None = None, step: str = "Download") -> None:
    last_err = ""
    last_stderr = ""
    for attempt in range(1, 6):
        lines: list[str] = []
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        assert proc.stdout
        for line in proc.stdout:
            lines.append(line)
            if progress_cb and "[download]" in line:
                m = re.search(r"(\d+(?:\.\d+)?)%", line)
                if m:
                    progress_cb(float(m.group(1)))
        proc.wait()
        if proc.returncode == 0:
            return
        last_stderr = "".join(lines[-80:])
        last_err = _friendly_step_error(last_stderr, step)
        if attempt < 5:
            time.sleep(min(30, 2 ** attempt))
    if _is_retryable(last_stderr):
        raise RetryableError(last_err or f"{step} failed after retries")
    err_line = _stderr_error_line(last_stderr)
    raise YtdlpDownloadError(
        last_err or f"{step} failed after retries",
        exit_code=proc.returncode if proc else None,
        stderr_tail=last_stderr,
        reason=err_line or last_err or "download_failed",
    )
