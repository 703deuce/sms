"""Resolve in-progress Twitch archive VOD for live channels (not capped prior broadcasts)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

LIVE_ARCHIVE_MATCH_S = 10 * 60
NO_LIVE_ARCHIVE_MSG = (
    "This live stream doesn't have a saved broadcast yet (Twitch may not have published it). "
    "Try again in a few minutes."
)


def _parse_iso(ts: str) -> float | None:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def _candidate_summary(v: dict[str, Any], *, live_status: str | None = None) -> dict[str, Any]:
    return {
        "id": str(v.get("id") or ""),
        "created_at": v.get("created_at"),
        "duration": v.get("duration"),
        "live_status": live_status,
        "stream_id": v.get("stream_id"),
    }


def pick_live_twitch_archive(
    videos: list[dict[str, Any]],
    *,
    stream_id: str | None = None,
    stream_started_at: datetime | str | None = None,
    ytdlp_live_status_by_id: dict[str, str] | None = None,
) -> tuple[dict[str, Any] | None, str, list[dict[str, Any]]]:
    """Return (video, reason, candidate_summaries)."""
    ymap = {str(k): str(v or "").lower() for k, v in (ytdlp_live_status_by_id or {}).items()}
    candidates = [_candidate_summary(v, live_status=ymap.get(str(v.get("id") or ""))) for v in videos]

    if stream_id:
        for v in videos:
            if str(v.get("stream_id") or "") == str(stream_id):
                return v, "stream_id_match", candidates

    if ymap:
        for v in videos:
            if ymap.get(str(v.get("id") or "")) == "is_live":
                return v, "ytdlp_is_live", candidates

    started_ts: float | None = None
    if isinstance(stream_started_at, datetime):
        started_ts = stream_started_at.timestamp()
    elif isinstance(stream_started_at, str) and stream_started_at.strip():
        started_ts = _parse_iso(stream_started_at)

    if started_ts is not None:
        for v in videos:
            created = _parse_iso(str(v.get("created_at") or ""))
            if created is not None and abs(created - started_ts) <= LIVE_ARCHIVE_MATCH_S:
                return v, "created_at_near_stream_start", candidates

    return None, "no_matching_archive", candidates


def video_matches_live_stream(
    video: dict[str, Any],
    *,
    stream_id: str | None,
    stream_started_at: datetime | str | None,
    ytdlp_live_status: str | None = None,
) -> tuple[bool, str]:
    if stream_id and str(video.get("stream_id") or "") == str(stream_id):
        return True, "stream_id_match"
    st = (ytdlp_live_status or "").lower()
    if st == "is_live":
        return True, "ytdlp_is_live"
    started_ts: float | None = None
    if isinstance(stream_started_at, datetime):
        started_ts = stream_started_at.timestamp()
    elif isinstance(stream_started_at, str) and stream_started_at.strip():
        started_ts = _parse_iso(stream_started_at)
    if started_ts is not None:
        created = _parse_iso(str(video.get("created_at") or ""))
        if created is not None and abs(created - started_ts) <= LIVE_ARCHIVE_MATCH_S:
            return True, "created_at_near_stream_start"
    return False, "no_match"


def log_archive_resolve_decision(
    *,
    stream_started_at: str | None,
    candidates: list[dict[str, Any]],
    picked: str | None,
    reason: str | None,
) -> None:
    from clips_worker.decision_log import decision_log

    decision_log(
        "stream_import",
        "archive_resolve",
        stream_started_at=stream_started_at,
        candidates=candidates,
        picked=picked,
        reason=reason,
    )


def _helix_json(path: str) -> dict[str, Any]:
    import json
    import urllib.error
    import urllib.request

    from clips_worker.streamer.autopull_job import _helix_app_token

    token = _helix_app_token()
    cid = __import__("os").environ.get("TWITCH_CLIENT_ID", "")
    if not token or not cid:
        return {}
    req = urllib.request.Request(
        f"https://api.twitch.tv/helix{path}",
        headers={"Client-Id": cid, "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return {}


def _twitch_video_id_from_url(url: str) -> str | None:
    import re

    m = re.search(r"twitch\.tv/videos/(\d+)", url or "", re.I)
    return m.group(1) if m else None


def guard_twitch_growing_archive_url(vod: dict, url: str, *, allow_growing: bool) -> None:
    """Reject stale capped archives while the channel is still live."""
    if not allow_growing or str(vod.get("platform") or "").lower() != "twitch":
        return
    state = vod.get("state") or {}
    if isinstance(state, str):
        import json

        state = json.loads(state) if state else {}
    login = str(vod.get("channelLogin") or state.get("channelLogin") or "").strip().lower()
    if not login:
        from clips_worker.streamer.channel_resolve import _twitch_video_id

        vid = _twitch_video_id(url)
        if vid:
            from clips_worker.streamer.channel_resolve import _helix_video_channel

            login = (_helix_video_channel(vid)[0] or "").lower()
    if not login:
        return

    import urllib.parse

    users = _helix_json(f"/users?login={urllib.parse.quote(login)}")
    user = (users.get("data") or [None])[0]
    if not user:
        return
    user_id = str(user.get("id") or "")
    streams = _helix_json(f"/streams?user_id={urllib.parse.quote(user_id)}")
    live = (streams.get("data") or [None])[0]
    if not live:
        return

    stream_id = str(live.get("id") or "")
    stream_started_at = str(live.get("started_at") or "")
    videos_payload = _helix_json(
        f"/videos?user_id={urllib.parse.quote(user_id)}&type=archive&first=8",
    )
    videos = list(videos_payload.get("data") or [])

    url_vid = _twitch_video_id_from_url(url)
    ytdlp_live_status: str | None = None
    if url_vid:
        try:
            from clips_worker.streamer.ytdlp import metadata as ytdlp_metadata

            raw = ytdlp_metadata(url, timeout_s=45, allow_twitch_growing_vod=False)
            ytdlp_live_status = str(raw.get("live_status") or "")
        except Exception:
            ytdlp_live_status = None

    picked, pick_reason, candidates = pick_live_twitch_archive(
        videos,
        stream_id=stream_id or None,
        stream_started_at=stream_started_at or None,
        ytdlp_live_status_by_id={url_vid: ytdlp_live_status} if url_vid and ytdlp_live_status else None,
    )

    current_video = next((v for v in videos if str(v.get("id") or "") == str(url_vid or "")), None)
    if current_video is None and url_vid:
        by_id = _helix_json(f"/videos?id={urllib.parse.quote(str(url_vid))}")
        current_video = (by_id.get("data") or [None])[0]

    ok = False
    match_reason = "no_match"
    if current_video and stream_id:
        ok, match_reason = video_matches_live_stream(
            current_video,
            stream_id=stream_id,
            stream_started_at=stream_started_at,
            ytdlp_live_status=ytdlp_live_status,
        )

    log_archive_resolve_decision(
        stream_started_at=stream_started_at or None,
        candidates=candidates,
        picked=str(url_vid) if ok else (str(picked.get("id")) if picked else None),
        reason=match_reason if ok else (pick_reason if picked else "no_matching_archive"),
    )

    if not ok:
        raise RuntimeError(NO_LIVE_ARCHIVE_MSG)
