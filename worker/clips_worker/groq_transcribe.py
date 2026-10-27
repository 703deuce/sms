"""Groq OpenAI-compatible audio transcriptions (whisper-large-v3-turbo)."""
from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from clips_worker.gpu.base import TranscribeReq, TranscribeRes

log = logging.getLogger(__name__)

GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
DEFAULT_MODEL = "whisper-large-v3-turbo"
REQUEST_TIMEOUT_S = 300.0
RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class GroqTranscribeError(Exception):
    def __init__(self, reason: str, status: int | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.status = status


def groq_api_key() -> str | None:
    raw = os.environ.get("GROQ_API_KEY", "").strip()
    return raw or None


def groq_model() -> str:
    return (os.environ.get("GROQ_WHISPER_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL


def groq_usd_per_audio_hour() -> float:
    try:
        return float(os.environ.get("GROQ_USD_PER_AUDIO_HOUR", "0.04"))
    except ValueError:
        return 0.04


def map_groq_segments(segments: list[dict[str, Any]], offset_ms: int = 0) -> list[dict]:
    offset_s = offset_ms / 1000.0
    out: list[dict] = []
    pos = 0
    for seg in segments:
        text = str(seg.get("text") or "").strip()
        if not text:
            continue
        start = float(seg.get("start", 0)) + offset_s
        end = float(seg.get("end", start)) + offset_s
        for piece in text.split():
            out.append(
                {
                    "w": piece,
                    "s": round(start, 3),
                    "e": round(end, 3),
                    "spk": 0,
                    "i": pos,
                    "p": 1.0,
                }
            )
            pos += 1
    return out


def _multipart_transcribe(path: Path, language: str | None) -> dict[str, Any]:
    api_key = groq_api_key()
    if not api_key:
        raise GroqTranscribeError("no_api_key")

    import mimetypes

    mime = mimetypes.guess_type(path.name)[0] or "audio/opus"
    model = groq_model()
    lang = language or "en"

    # Minimal multipart/form-data without extra deps
    boundary = "----groqtranscribe"
    file_bytes = path.read_bytes()
    parts: list[bytes] = []
    for name, value in (
        ("model", model),
        ("response_format", "verbose_json"),
        ("language", lang),
    ):
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode()
        )
    parts.append(
        (
            f"--{boundary}\r\n"
            f"Content-Disposition: form-data; name=\"file\"; filename=\"{path.name}\"\r\n"
            f"Content-Type: {mime}\r\n\r\n"
        ).encode()
        + file_bytes
        + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            req = urllib.request.Request(GROQ_TRANSCRIPTIONS_URL, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as resp:
                raw = resp.read().decode("utf-8")
            return json.loads(raw)
        except urllib.error.HTTPError as exc:
            status = exc.code
            reason = f"http_{status}"
            if status in (401, 403):
                raise GroqTranscribeError(reason, status) from exc
            if status in RETRYABLE_STATUS and attempt == 0:
                time.sleep(1.5)
                last_exc = exc
                continue
            raise GroqTranscribeError(reason, status) from exc
        except urllib.error.URLError as exc:
            if attempt == 0:
                time.sleep(1.0)
                last_exc = exc
                continue
            raise GroqTranscribeError("network") from exc
    raise GroqTranscribeError("retry_exhausted") from last_exc


def transcribe_groq(req: TranscribeReq) -> TranscribeRes:
    if not req.audio_path:
        raise GroqTranscribeError("no_audio_path")
    path = Path(req.audio_path)
    payload = _multipart_transcribe(path, req.language)
    segments = payload.get("segments")
    if isinstance(segments, list) and segments:
        words = map_groq_segments(segments, offset_ms=req.offset_ms)
    else:
        text = str(payload.get("text") or "").strip()
        if not text:
            raise GroqTranscribeError("empty_transcript")
        words = [
            {
                "w": w,
                "s": req.offset_ms / 1000.0,
                "e": req.offset_ms / 1000.0 + 0.5,
                "spk": 0,
                "i": i,
                "p": 1.0,
            }
            for i, w in enumerate(text.split())
        ]
    if not words:
        raise GroqTranscribeError("empty_transcript")
    duration_s = max((w["e"] for w in words), default=0.0)
    return TranscribeRes(
        words=words,
        language=str(payload.get("language") or req.language or "en"),
        duration_s=float(duration_s),
        gpu_seconds=0.0,
        provider="groq",
        transcription_engine="groq",
        fallback_reason=None,
    )


@dataclass
class StreamTranscribeCost:
    provider: str
    audio_minutes: float
    cost_usd_est: float
    fallback: str | None = None
