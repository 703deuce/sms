"""Deepgram prerecorded transcription → pipeline word list ({w,s,e,spk,i,p})."""
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

DEEPGRAM_LISTEN_URL = "https://api.deepgram.com/v1/listen"
DEFAULT_MODEL = "nova-3"
REQUEST_TIMEOUT_S = 120.0
RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class DeepgramTranscribeError(Exception):
    def __init__(self, reason: str, status: int | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.status = status


def deepgram_api_key() -> str | None:
    raw = os.environ.get("DEEPGRAM_API_KEY", "").strip()
    return raw or None


def resolve_transcribe_provider() -> str:
    """deepgram | local — default deepgram when API key is set."""
    explicit = (os.environ.get("TRANSCRIBE_PROVIDER") or "").strip().lower()
    has_key = bool(deepgram_api_key())
    if explicit == "local":
        return "local"
    if explicit == "deepgram":
        return "deepgram" if has_key else "local"
    return "deepgram" if has_key else "local"


def deepgram_model() -> str:
    return (os.environ.get("DEEPGRAM_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL


def map_deepgram_words(raw_words: list[dict[str, Any]], offset_ms: int = 0) -> list[dict]:
    offset_s = offset_ms / 1000.0
    out: list[dict] = []
    for pos, item in enumerate(raw_words):
        text = (item.get("punctuated_word") or item.get("word") or "").strip()
        if not text:
            continue
        spk_raw = item.get("speaker", 0)
        try:
            spk = int(spk_raw)
        except (TypeError, ValueError):
            spk = 0
        out.append(
            {
                "w": text,
                "s": round(float(item["start"]) + offset_s, 3),
                "e": round(float(item["end"]) + offset_s, 3),
                "spk": spk,
                "i": pos,
                "p": round(float(item.get("confidence", 0) or 0), 3),
            }
        )
    return out


def _extract_words_from_payload(payload: dict[str, Any]) -> list[dict]:
    channels = (payload.get("results") or {}).get("channels") or []
    if not channels:
        return []
    alts = channels[0].get("alternatives") or []
    if not alts:
        return []
    words = alts[0].get("words") or []
    if isinstance(words, list) and words:
        return words
    transcript = (alts[0].get("transcript") or "").strip()
    if not transcript:
        raise DeepgramTranscribeError("empty_transcript")
    raise DeepgramTranscribeError("malformed_transcript_no_words")


def _listen_params(model: str | None = None) -> str:
    from urllib.parse import urlencode

    params = {
        "model": (model or deepgram_model()).strip() or DEFAULT_MODEL,
        "smart_format": "true",
        "punctuate": "true",
        "language": "en",
        "diarize": "true",
        "utterances": "true",
        "diarize_version": "latest",
    }
    return urlencode(params)


def _http_listen(
    *,
    audio_bytes: bytes | None = None,
    audio_url: str | None = None,
    content_type: str = "audio/opus",
    model: str | None = None,
) -> dict[str, Any]:
    api_key = deepgram_api_key()
    if not api_key:
        raise DeepgramTranscribeError("no_api_key")

    url = f"{DEEPGRAM_LISTEN_URL}?{_listen_params(model=model)}"
    if audio_url:
        body = json.dumps({"url": audio_url}).encode("utf-8")
        headers = {
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json",
        }
    elif audio_bytes is not None:
        body = audio_bytes
        headers = {
            "Authorization": f"Token {api_key}",
            "Content-Type": content_type,
        }
    else:
        raise DeepgramTranscribeError("no_audio_source")

    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as resp:
                raw = resp.read().decode("utf-8")
            return json.loads(raw)
        except urllib.error.HTTPError as exc:
            status = exc.code
            try:
                raw_err = exc.read(300)
                snippet = raw_err.decode("utf-8", errors="replace") if isinstance(raw_err, bytes) else str(raw_err)
            except Exception:
                snippet = ""
            reason = f"http_{status}"
            if status in (401, 402, 403):
                raise DeepgramTranscribeError(reason, status) from exc
            if status in RETRYABLE_STATUS and attempt == 0:
                time.sleep(1.5)
                last_exc = exc
                continue
            raise DeepgramTranscribeError(f"{reason}:{snippet[:120]}", status) from exc
        except urllib.error.URLError as exc:
            reason = "timeout" if "timed out" in str(exc).lower() else "network"
            if attempt == 0:
                time.sleep(1.0)
                last_exc = exc
                continue
            raise DeepgramTranscribeError(reason) from exc
    raise DeepgramTranscribeError("retry_exhausted") from last_exc


def transcribe_deepgram(req: TranscribeReq, *, model: str | None = None) -> TranscribeRes:
    payload: dict[str, Any]
    if req.audio_url:
        payload = _http_listen(audio_url=req.audio_url, model=model)
    elif req.audio_path:
        path = Path(req.audio_path)
        suffix = path.suffix.lower()
        mime = "audio/wav" if suffix == ".wav" else "audio/opus"
        payload = _http_listen(audio_bytes=path.read_bytes(), content_type=mime, model=model)
    else:
        raise DeepgramTranscribeError("no_audio_source")

    raw_words = _extract_words_from_payload(payload)
    words = map_deepgram_words(raw_words, offset_ms=req.offset_ms)
    if not words:
        raise DeepgramTranscribeError("empty_transcript")

    duration_s = max((w["e"] for w in words), default=0.0)
    meta = payload.get("metadata") or {}
    lang = (meta.get("detected_language") or req.language or "en") if isinstance(meta, dict) else "en"
    return TranscribeRes(
        words=words,
        language=str(lang),
        duration_s=float(duration_s),
        gpu_seconds=0.0,
        provider="deepgram",
        transcription_engine="deepgram",
        fallback_reason=None,
    )


@dataclass
class TranscribeMeta:
    transcription_engine: str
    fallback_reason: str | None = None
    telemetry: dict | None = None

    def as_progress_fields(self) -> dict[str, str]:
        out = {"transcriptionEngine": self.transcription_engine}
        if self.fallback_reason:
            out["transcriptionFallbackReason"] = self.fallback_reason
        return out
