"""ElevenLabs TTS with an output-format fallback that is NOT a paid retry (ST-RW-002, #1230-adjacent).

1. Capability probe (cached per account): GET /v1/user/subscription -> tier -> highest allowed mp3 format; the
   request uses min(preferred, allowed). A known-good format from a previous success is preferred.
2. One request. If ElevenLabs REJECTS it without generating (HTTP 400/401/403/422 whose body names the output
   format / plan), the request is re-issued ONCE at the next lower ElevenLabs format, and that is logged.
3. Never re-issued after a 200, a 5xx, a timeout or any other failure (those surface as a user-retryable step).
ElevenLabs only: there is no other TTS provider fallback.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import time
from pathlib import Path

import requests

TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
SUB_URL = "https://api.elevenlabs.io/v1/user/subscription"
# Highest -> lowest; all ElevenLabs mp3 formats.
LADDER = ["mp3_44100_192", "mp3_44100_128", "mp3_44100_96", "mp3_44100_64", "mp3_44100_32", "mp3_22050_32"]
# Tiers whose plan does not include 192 kbps.
LOW_TIERS = {"free", "starter"}
_CACHE: dict[str, dict] = {}
_CACHE_FILE = Path(os.environ.get("MOTION_STUDIO_TTS_CACHE", "/tmp/motion_studio_tts_formats.json"))


class FormatRejected(RuntimeError):
    """The provider refused the output format before generating anything (nothing billed)."""


def _account(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()[:16]   # never the key itself


def _load() -> dict:
    if not _CACHE and _CACHE_FILE.exists():
        try:
            _CACHE.update(json.loads(_CACHE_FILE.read_text()))
        except Exception:  # noqa: BLE001
            pass
    return _CACHE


def _save() -> None:
    try:
        _CACHE_FILE.write_text(json.dumps(_CACHE))
    except Exception:  # noqa: BLE001
        pass


def _lower(fmt: str) -> str | None:
    i = LADDER.index(fmt) if fmt in LADDER else 1
    return LADDER[i + 1] if i + 1 < len(LADDER) else None


def probe_format(api_key: str, preferred: str, *, session=requests) -> tuple[str, dict]:
    """Free metadata call (no generation). Cached per account."""
    cache = _load()
    acct = _account(api_key)
    hit = cache.get(acct)
    if hit and time.time() - hit.get("at", 0) < 86400:
        fmt = hit.get("knownGood") or hit.get("allowed") or preferred
        return _cap(preferred, fmt), {"cached": True, "tier": hit.get("tier")}
    tier = None
    try:
        r = session.get(SUB_URL, headers={"xi-api-key": api_key}, timeout=20)
        if r.ok:
            tier = str((r.json() or {}).get("tier") or "").lower() or None
    except Exception:  # noqa: BLE001 (probe is best-effort)
        tier = None
    allowed = "mp3_44100_128" if (tier is None or tier in LOW_TIERS) else "mp3_44100_192"
    cache[acct] = {"tier": tier, "allowed": allowed, "at": time.time(), **({"knownGood": hit["knownGood"]} if hit and hit.get("knownGood") else {})}
    _save()
    return _cap(preferred, allowed), {"cached": False, "tier": tier}


def _cap(preferred: str, allowed: str) -> str:
    if preferred not in LADDER or allowed not in LADDER:
        return preferred if preferred in LADDER else "mp3_44100_128"
    return LADDER[max(LADDER.index(preferred), LADDER.index(allowed))]


def _is_format_rejection(status: int, body: str) -> bool:
    if status not in (400, 401, 403, 422):
        return False
    b = body.lower()
    return any(t in b for t in ("output_format", "output format", "format", "subscription", "tier", "plan"))


def _post(api_key: str, text: str, voice: dict, model_id: str, fmt: str, prev: str | None, nxt: str | None, session):
    body = {"text": text, "model_id": model_id, "voice_settings": {
        "stability": voice.get("stability", 0.5), "similarity_boost": voice.get("similarityBoost", 0.75),
        "style": voice.get("style", 0.0), "speed": voice.get("speed", 0.85), "use_speaker_boost": True}}
    if prev:
        body["previous_text"] = prev
    if nxt:
        body["next_text"] = nxt
    r = session.post(TTS_URL.format(voice_id=voice["voiceId"]), params={"output_format": fmt}, json=body,
                     headers={"xi-api-key": api_key, "Content-Type": "application/json"}, timeout=180)
    if not r.ok:
        text_body = (r.text or "")[:300]
        if _is_format_rejection(r.status_code, text_body):
            raise FormatRejected(f"elevenlabs_format_rejected_{r.status_code}")
        raise RuntimeError(f"elevenlabs_tts_{r.status_code}")
    data = r.json()
    alignment = data.get("alignment") or data.get("normalized_alignment") or {}
    if not alignment.get("characters"):
        raise RuntimeError("elevenlabs_tts_no_alignment")
    return base64.b64decode(data["audio_base64"]), alignment


def tts_with_format_fallback(api_key: str, text: str, voice: dict, *, model_id: str, preferred: str, previous_text=None,
                             next_text=None, log=None, session=requests) -> tuple[bytes, dict, str]:
    """Returns (audio, alignment, format_used). At most two HTTP generation requests, the second only after a
    format rejection that generated nothing."""
    log = log or (lambda *a, **k: None)
    fmt, info = probe_format(api_key, preferred, session=session)
    try:
        audio, alignment = _post(api_key, text, voice, model_id, fmt, previous_text, next_text, session)
    except FormatRejected:
        lower = _lower(fmt)
        if not lower:
            raise
        log("tts_format_fallback", f"the voice service rejected {fmt} before generating; re-requesting once at {lower}",
            {"from": fmt, "to": lower, "tier": info.get("tier")})
        audio, alignment = _post(api_key, text, voice, model_id, lower, previous_text, next_text, session)  # no further retry
        fmt = lower
    cache = _load()
    acct = _account(api_key)
    cache.setdefault(acct, {"at": time.time()})["knownGood"] = fmt
    _save()
    return audio, alignment, fmt
