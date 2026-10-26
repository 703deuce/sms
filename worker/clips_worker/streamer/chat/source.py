"""Chat message sources for streamer VODs (S5+)."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Iterable

def _replay_disabled() -> bool:
    if os.environ.get("TWITCH_VOD_CHAT_REPLAY", "").lower() in ("off", "0", "false"):
        return True
    return not (os.environ.get("TWITCH_GQL_CLIENT_ID") and os.environ.get("TWITCH_GQL_COMMENTS_HASH"))


def get_chat(vod: dict, conn=None) -> tuple[list[dict] | None, str]:
    """
    Returns (messages, chatSource).
    chatSource: twitch_replay | none | captured (future S13)
    """
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state)
    channel_id = vod.get("channelId")
    start_ms = int(vod.get("rangeStartMs") or 0)
    end_ms = int(vod.get("durationMs") or vod.get("rangeEndMs") or 0) + start_ms
    if conn and channel_id and end_ms > start_ms:
        from clips_worker.streamer.chat.live import fetch_live_chat_messages

        live = fetch_live_chat_messages(conn, str(channel_id), start_ms, end_ms)
        if live:
            return live, "twitch_eventsub"

    chat_key = state.get("chatKey")
    if chat_key:
        from clips_worker.storage import download_object

        scratch = Path("/tmp/streamer_chat.jsonl.gz")
        download_object(chat_key, scratch)
        from clips_worker.streamer.chat.twitch_gql import load_jsonl_gz

        return load_jsonl_gz(scratch), str(vod.get("chatSource") or "twitch_replay")

    platform = str(vod.get("platform") or "").lower()
    external_id = vod.get("externalId") or vod.get("external_id")
    if platform == "kick":
        from clips_worker.streamer.chat.kick_chat import fetch_kick_vod_chat

        messages = fetch_kick_vod_chat(vod.get("url"), external_id)
        if messages:
            return messages, "kick_replay"
        return None, "kick_unavailable"

    if platform == "twitch" and external_id and not _replay_disabled():
        from clips_worker.streamer.chat.twitch_gql import fetch_all_vod_comments

        try:
            messages, _cursor = fetch_all_vod_comments(str(external_id), state.get("chatCursor"))
            if messages:
                return messages, "twitch_replay"
        except Exception:
            return None, "none"
    return None, "none"
