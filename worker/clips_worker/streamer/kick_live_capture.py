"""Kick live HLS capture — design skeleton (Rick). Not started on worker until Twitch stage 1 gate."""
from __future__ import annotations

import os

from clips_worker.streamer.config import CHUNK_MIN, DISK_GUARD_PCT, SESSION_GAP_MAX_S
from clips_worker.streamer.disk_guard import disk_guard_blocks_new_stream_work
from clips_worker.streamer.kick_playback import playback_host_for_log, resolve_kick_live_hls_url


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


KICK_ROLLING_VIDEO_BUFFER_MIN = _int_env("KICK_ROLLING_VIDEO_BUFFER_MIN", 15)
KICK_ROLLING_VIDEO_HEIGHT = _int_env("KICK_ROLLING_VIDEO_HEIGHT", 720)
KICK_LIVE_MAX_CONCURRENT_PER_WORKER = _int_env("KICK_LIVE_MAX_CONCURRENT_PER_WORKER", 2)


def kick_live_capture_enabled() -> bool:
    return os.environ.get("KICK_LIVE_CAPTURE_ENABLED", "0") == "1"


def can_start_kick_live_capture(active_on_worker: int) -> tuple[bool, str]:
    if not kick_live_capture_enabled():
        return False, "disabled"
    if active_on_worker >= KICK_LIVE_MAX_CONCURRENT_PER_WORKER:
        return False, "worker_concurrent_cap"
    if disk_guard_blocks_new_stream_work():
        return False, "disk_guard"
    return True, "ok"


def log_kick_live_start(channel_id: str, session_id: str, slug: str, hls_url: str | None) -> None:
    host = playback_host_for_log(hls_url)
    print(
        f"[clipper:stream] kick_live_start channelId={channel_id} sessionId={session_id} "
        f"slug={slug} playbackHost={host} chunkMin={CHUNK_MIN} "
        f"videoBufferMin={KICK_ROLLING_VIDEO_BUFFER_MIN} sessionGapMaxS={SESSION_GAP_MAX_S} "
        f"diskGuardPct={DISK_GUARD_PCT}",
        flush=True,
    )


def prepare_kick_live_session(slug: str) -> dict:
    """Resolve playback URL for enqueue-time validation (webhook / job payload)."""
    hls = resolve_kick_live_hls_url(slug)
    return {
        "slug": slug,
        "hlsUrl": hls,
        "chunkMin": CHUNK_MIN,
        "videoBufferMin": KICK_ROLLING_VIDEO_BUFFER_MIN,
        "videoHeight": KICK_ROLLING_VIDEO_HEIGHT,
    }
