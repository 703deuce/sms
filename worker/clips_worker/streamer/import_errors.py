"""User-facing stream import errors (muted VOD, VOD disabled, etc.)."""
from __future__ import annotations


def classify_ytdlp_import_error(stderr: str, platform: str = "") -> str | None:
    s = (stderr or "").lower()
    plat = platform.lower()
    if "subscriber" in s or "subscription" in s and "only" in s:
        return "This VOD is subscriber-only. Download it from your dashboard and upload the file."
    if "muted" in s and ("vod" in s or "video" in s or "audio" in s):
        return (
            "This VOD has no usable audio (muted or silent segments). "
            "Upload a local recording or pick another VOD."
        )
    if "vod" in s and ("disabled" in s or "not enabled" in s or "archives are disabled" in s):
        return (
            "This channel has VOD storage disabled, so we cannot import from a link. "
            "Upload a recording from OBS instead."
        )
    if plat == "kick" and ("live" in s or "is_live" in s):
        return "Kick streams are clipped after the stream ends. Paste the replay VOD link when it appears."
    if "does not exist" in s or "404" in s or "not found" in s:
        return "VOD not found or deleted."
    return None


def classify_metadata(meta: dict, platform: str = "") -> str | None:
    plat = (platform or "").lower()
    live = meta.get("is_live")
    live_status = (str(meta.get("live_status") or "")).lower()
    if plat == "kick" and (live or live_status in ("is_live", "is_upcoming")):
        return "Kick streams are clipped after the stream ends. Wait for the replay VOD, then paste that link."
    dur = float(meta.get("duration") or meta.get("duration_s") or 0)
    if dur <= 0 and not live:
        return "Could not read VOD duration (it may be muted, blocked, or not published yet)."
    return None
