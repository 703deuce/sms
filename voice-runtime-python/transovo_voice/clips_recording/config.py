"""LiveKit Cloud credentials for clips recording worker jobs (M14–M16)."""

from __future__ import annotations

import os


def _normalize_wss(url: str) -> str:
    u = url.strip()
    if u.startswith(('wss://', 'ws://')):
        return u
    if u.startswith('https://'):
        return 'wss://' + u[len('https://') :]
    if u.startswith('http://'):
        return 'ws://' + u[len('http://') :]
    return u


def livekit_credentials_for_recording() -> tuple[str, str, str]:
    """Return (wss_url, api_key, api_secret) — **LiveKit Cloud only** (`LIVEKIT_*`)."""
    url = os.getenv('LIVEKIT_URL', '').strip()
    key = os.getenv('LIVEKIT_API_KEY', '').strip()
    secret = os.getenv('LIVEKIT_API_SECRET', '').strip()
    if not url or not key or not secret:
        raise RuntimeError(
            'Recording requires LiveKit Cloud env: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET',
        )
    return _normalize_wss(url), key, secret
