"""Apply MEDIA_BACKEND_MODE to LiveKit SDK env without changing Coolify Cloud vars."""

from __future__ import annotations

import os


def apply_media_backend_env() -> str:
    mode = (os.getenv("MEDIA_BACKEND_MODE") or "livekit_cloud").strip().lower()
    if mode != "self_hosted":
        return "livekit_cloud"

    mapping = {
        "LIVEKIT_URL": "LIVEKIT_SELF_HOSTED_URL",
        "LIVEKIT_API_KEY": "LIVEKIT_SELF_HOSTED_API_KEY",
        "LIVEKIT_API_SECRET": "LIVEKIT_SELF_HOSTED_API_SECRET",
    }
    for target, source in mapping.items():
        value = os.getenv(source, "").strip()
        if value:
            os.environ[target] = value

    outbound = os.getenv("LIVEKIT_SELF_HOSTED_OUTBOUND_TRUNK_ID", "").strip()
    if outbound:
        os.environ["LIVEKIT_SIP_OUTBOUND_TRUNK"] = outbound
        os.environ["LIVEKIT_DEFAULT_OUTBOUND_TRUNK_ID"] = outbound

    return "self_hosted"
