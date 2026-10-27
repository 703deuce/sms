"""STREAM_AUTOPULL: resolve VOD after stream ends (S13/S14)."""
from __future__ import annotations

import json
import os
import subprocess
import uuid
from datetime import datetime, timezone

from psycopg2.extras import RealDictCursor

from clips_worker.streamer.errors import RetryableError

BACKOFF_MIN = [2, 5, 10, 20, 40]


def _helix_app_token() -> str:
    import urllib.parse
    import urllib.request

    cid = os.environ["TWITCH_CLIENT_ID"]
    secret = os.environ["TWITCH_CLIENT_SECRET"]
    data = urllib.parse.urlencode(
        {"client_id": cid, "client_secret": secret, "grant_type": "client_credentials"}
    ).encode()
    req = urllib.request.Request("https://id.twitch.tv/oauth2/token", data=data, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())["access_token"]


class HelixAutopullError(RuntimeError):
    """Helix API failure during autopull (not 'VOD not found yet')."""


def _match_twitch_vod(
    user_id: str,
    streamed_at: datetime,
    *,
    stream_id: str | None = None,
) -> dict | None:
    import urllib.error
    import urllib.request

    from clips_worker.streamer.twitch_duration import parse_twitch_duration

    token = _helix_app_token()
    cid = os.environ["TWITCH_CLIENT_ID"]
    url = f"https://api.twitch.tv/helix/videos?user_id={user_id}&type=archive&first=5"
    req = urllib.request.Request(url, headers={"Client-Id": cid, "Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:500]
        msg = f"Helix videos failed: {exc.code} {body}"
        if exc.code == 429 or (exc.code and int(exc.code) >= 500):
            raise RetryableError(msg) from exc
        raise HelixAutopullError(msg) from exc
    except urllib.error.URLError as exc:
        raise RetryableError(f"Helix videos unreachable: {exc}") from exc

    if stream_id:
        for v in data.get("data") or []:
            if str(v.get("stream_id") or "") == str(stream_id):
                return _normalize_helix_video(v, parse_twitch_duration)

    target = streamed_at.timestamp()
    for v in data.get("data") or []:
        created = datetime.fromisoformat(v["created_at"].replace("Z", "+00:00")).timestamp()
        if abs(created - target) <= 15 * 60:
            return _normalize_helix_video(v, parse_twitch_duration)
    return None


def _normalize_helix_video(v: dict, parse_duration) -> dict:
    dur_raw = v.get("duration")
    if dur_raw and not isinstance(v.get("duration"), (int, float)):
        try:
            v = {**v, "duration": parse_duration(dur_raw)}
        except ValueError:
            pass
    return v


def run_stream_autopull_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    vod_id = payload.get("vodId")
    attempt = int(payload.get("attempt") or 1)
    if not vod_id:
        raise RuntimeError("missing vodId")

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT v.*, c."externalId" AS channel_external, c.platform AS channel_platform, c.login
            FROM stream_vods v
            LEFT JOIN stream_channels c ON c.id = v."channelId"
            WHERE v.id = %s
            """,
            (vod_id,),
        )
        vod = dict(cur.fetchone() or {})

    platform = vod.get("channel_platform") or vod.get("platform")
    streamed_at = vod.get("streamedAt")
    if isinstance(streamed_at, str):
        streamed_at = datetime.fromisoformat(streamed_at.replace("Z", "+00:00"))
    if not streamed_at:
        streamed_at = datetime.now(timezone.utc)

    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state)
    stream_id = state.get("streamSessionId") or state.get("streamId")

    matched = None
    if platform == "twitch" and vod.get("channel_external"):
        try:
            matched = _match_twitch_vod(
                str(vod["channel_external"]),
                streamed_at,
                stream_id=str(stream_id) if stream_id else None,
            )
        except HelixAutopullError:
            raise
    elif platform == "kick" and vod.get("login"):
        matched = _match_kick_vod(str(vod["login"]), streamed_at)

    if platform == "twitch" and vod.get("channel_external"):
        from clips_worker.streamer.vod_saving import channel_stores_past_broadcasts

        if not channel_stores_past_broadcasts(str(vod["channel_external"])):
            _record_skip(
                conn,
                vod.get("channelId"),
                "store_past_broadcasts_off",
                "No Twitch archive VODs — turn on Store past broadcasts in Creator Dashboard.",
                vod,
            )
            return

    if not matched:
        if attempt >= 6:
            from clips_worker.streamer.notify import notify_event

            _record_skip(
                conn,
                vod.get("channelId"),
                "kick_replay_pending" if platform == "kick" else "vod_unavailable",
                "Replay VOD not published yet after stream ended.",
                vod,
            )
            notify_event(
                workspace_id=vod["workspaceId"],
                type="autopull_failed",
                vod_id=vod_id,
                data={"error": "VOD not published yet"},
            )
            return
        delay = BACKOFF_MIN[min(attempt - 1, len(BACKOFF_MIN) - 1)]
        new_id = f"job_{uuid.uuid4().hex}"
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "runAfter", "createdAt")
                VALUES (%s,%s,'STREAM_AUTOPULL','QUEUED',%s::jsonb,15,NOW() + (%s || ' minutes')::interval,NOW())
                """,
                (
                    new_id,
                    vod["projectId"],
                    json.dumps({"vodId": vod_id, "attempt": attempt + 1}),
                    str(delay),
                ),
            )
        conn.commit()
        return

    url = matched.get("url") or matched.get("webpage_url")
    title = matched.get("title") or vod.get("title")
    duration_ms = int(float(matched.get("duration") or matched.get("duration_s") or 0) * 1000)
    external = matched.get("id") or matched.get("video_id")

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stream_vods SET url=%s, title=%s, "externalId"=%s, "durationMs"=%s, "updatedAt"=NOW()
            WHERE id=%s
            """,
            (url, title, external, duration_ms, vod_id),
        )
        import_id = f"job_{uuid.uuid4().hex}"
        cur.execute(
            """
            INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
            VALUES (%s,%s,'STREAM_IMPORT','QUEUED',%s::jsonb,15,NOW())
            """,
            (import_id, vod["projectId"], json.dumps({"vodId": vod_id})),
        )
    conn.commit()


def _record_skip(conn, channel_id: str | None, code: str, message: str, vod: dict) -> None:
    if not channel_id:
        return
    import json
    from datetime import datetime, timezone

    entry = {
        "at": datetime.now(timezone.utc).isoformat(),
        "code": code,
        "message": message,
        "title": vod.get("title") or "Stream",
    }
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stream_channels
            SET "platformState" = jsonb_set(
              COALESCE("platformState", '{}'::jsonb),
              '{skippedStreams}',
              (%s::jsonb) || COALESCE("platformState"->'skippedStreams', '[]'::jsonb)
            ),
            "updatedAt" = NOW()
            WHERE id = %s
            """,
            (json.dumps(entry), channel_id),
        )
    conn.commit()
    print(
        f"[clipper:stream] stream_skipped channelId={channel_id} code={code} message={message[:120]}",
        flush=True,
    )


def _match_kick_vod(slug: str, streamed_at: datetime) -> dict | None:
    try:
        raw = subprocess.check_output(
            ["yt-dlp", "--flat-playlist", "-J", f"https://kick.com/{slug}/videos"],
            text=True,
            timeout=120,
        )
        data = json.loads(raw)
    except Exception:
        return None
    target = streamed_at.timestamp()
    for ent in (data.get("entries") or [])[:5]:
        ts = ent.get("timestamp") or ent.get("release_timestamp")
        if ts and abs(float(ts) - target) <= 15 * 60:
            return {"url": ent.get("url") or ent.get("webpage_url"), "title": ent.get("title"), "id": ent.get("id")}
    return None
