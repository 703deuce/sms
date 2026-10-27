"""Pure URL parsing for Drive/Dropbox imports (no storage deps)."""
from __future__ import annotations

import re
import urllib.parse

YOUTUBE_UNSUPPORTED = "Paste a public YouTube video link (not a live stream)."
DRIVE_PUBLIC_MSG = "Make the file public (Anyone with the link)"
UNSUPPORTED_MSG = "Supported: Google Drive, Dropbox, YouTube, or Twitch VOD/clip links."


def classify_url(raw: str) -> str:
    trimmed = (raw or "").strip()
    if not trimmed:
        return "unsupported"
    try:
        url = urllib.parse.urlparse(trimmed if trimmed.startswith("http") else f"https://{trimmed}")
    except Exception:
        return "unsupported"
    host = (url.hostname or "").lower()
    bare = host.replace("www.", "")
    if host in ("youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be") or bare in (
        "youtube.com",
        "youtu.be",
    ):
        return "youtube"
    if bare in ("drive.google.com", "docs.google.com"):
        return "drive"
    if bare == "dropbox.com" or bare.endswith(".dropbox.com"):
        return "dropbox"
    if bare in ("twitch.tv", "clips.twitch.tv"):
        return "twitch"
    if bare == "kick.com":
        return "kick"
    return "unsupported"


def parse_drive_file_id(url: str) -> str | None:
    try:
        u = urllib.parse.urlparse(url if url.strip().startswith("http") else f"https://{url.strip()}")
    except Exception:
        return None
    m = re.search(r"/file/d/([^/]+)", u.path)
    if m:
        return m.group(1)
    q = urllib.parse.parse_qs(u.query)
    ids = q.get("id") or []
    return ids[0] if ids else None


def normalize_dropbox_url(url: str) -> str:
    u = urllib.parse.urlparse(url if url.strip().startswith("http") else f"https://{url.strip()}")
    q = urllib.parse.parse_qs(u.query)
    flat = {k: v[0] for k, v in q.items()}
    if "/scl/" in u.path:
        flat["raw"] = "1"
        flat.pop("dl", None)
    else:
        flat["dl"] = "1"
    new_q = urllib.parse.urlencode(flat)
    return urllib.parse.urlunparse((u.scheme, u.netloc, u.path, u.params, new_q, u.fragment))


def drive_download_url(file_id: str) -> str:
    return (
        "https://drive.usercontent.google.com/download?"
        f"id={urllib.parse.quote(file_id)}&export=download&confirm=t"
    )
