"""Mirror Next.js `RECORDING_LIVEKIT_TARGET` for Python-side recording jobs."""

from __future__ import annotations

import os

from transovo_voice.media_backend_constants import LIVEKIT_SELF_HOSTED_WSS_URL

_SELF_HOSTED_ALIASES = frozenset({'self_hosted', 'selfhosted'})


def recording_livekit_target() -> str:
    raw = (os.getenv('RECORDING_LIVEKIT_TARGET') or 'cloud').strip().lower().replace('-', '_')
    return 'self_hosted' if raw in _SELF_HOSTED_ALIASES else 'cloud'


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
    """Return (wss_url, api_key, api_secret) for clips recording on the active target."""
    if recording_livekit_target() == 'self_hosted':
        url = os.getenv('LIVEKIT_SELF_HOSTED_URL', '').strip() or LIVEKIT_SELF_HOSTED_WSS_URL
        key = os.getenv('LIVEKIT_SELF_HOSTED_API_KEY', '').strip()
        secret = os.getenv('LIVEKIT_SELF_HOSTED_API_SECRET', '').strip()
    else:
        url = os.getenv('LIVEKIT_URL', '').strip()
        key = os.getenv('LIVEKIT_API_KEY', '').strip()
        secret = os.getenv('LIVEKIT_API_SECRET', '').strip()
    if not url or not key or not secret:
        raise RuntimeError(
            'Recording LiveKit credentials missing for target=%s' % recording_livekit_target(),
        )
    return _normalize_wss(url), key, secret
