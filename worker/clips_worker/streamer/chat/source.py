"""Chat message sources for streamer VODs (S5+)."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Iterable

def _live_capture_enabled() -> bool:
    raw = (os.environ.get("STREAMER_LIVE_REALTIME_ENABLED") or "").strip().lower()
    return raw in ("1", "true", "yes")


def _replay_disabled() -> bool:
    if os.environ.get("TWITCH_VOD_CHAT_REPLAY", "").lower() in ("off", "0", "false"):
        return True
    from clips_worker.streamer.chat.twitch_gql import gql_client_id

    return not gql_client_id()


def _vod_chat_window_s(vod: dict) -> tuple[int, int | None]:
    """Absolute VOD seconds [start, end] for chat replay (trim range or full analysed span)."""
    start_ms = int(vod.get("rangeStartMs") or 0)
    range_end = vod.get("rangeEndMs")
    dur_ms = int(vod.get("durationMs") or 0)
    if range_end is not None:
        end_ms = int(range_end)
    elif dur_ms > 0:
        end_ms = start_ms + dur_ms
    else:
        end_ms = start_ms
    start_s = max(0, start_ms // 1000)
    end_s = max(start_s, end_ms // 1000) if end_ms > start_ms else None
    return start_s, end_s


def _rebase_chat_to_analyzed_span(messages: list[dict], range_start_s: int) -> list[dict]:
    if range_start_s <= 0 or not messages:
        return messages
    rebased: list[dict] = []
    for row in messages:
        try:
            t = int(row.get("t_s", row.get("t", 0)))
        except (TypeError, ValueError):
            continue
        rebased.append({**row, "t_s": t - range_start_s})
    return rebased

def get_chat(vod: dict, conn=None) -> tuple[list[dict] | None, str]:
    """
    Returns (messages, chatSource).
    chatSource: twitch_replay | none | captured (future S13)
    """
    from clips_worker.streamer.config import stream_chat_signal_enabled

    if not stream_chat_signal_enabled():
        return None, "disabled"

    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state)
    channel_id = vod.get("channelId")
    start_ms = int(vod.get("rangeStartMs") or 0)
    end_ms = int(vod.get("durationMs") or vod.get("rangeEndMs") or 0) + start_ms
    if _live_capture_enabled() and conn and channel_id and end_ms > start_ms:
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

        messages = fetch_kick_vod_chat(vod)
        if messages:
            return messages, "kick_replay"
        return None, "kick_unavailable"

    if platform == "twitch" and external_id and not _replay_disabled():
        from clips_worker.streamer.chat.twitch_gql import (
            ChatFetchBudgetExceeded,
            fetch_all_vod_comments,
        )

        range_start_s, range_end_s = _vod_chat_window_s(vod)
        print(
            f"[clipper:chat] twitch_replay videoId={external_id} offset_s={range_start_s} "
            f"stop_s={range_end_s}",
            flush=True,
        )
        try:
            messages, _cursor = fetch_all_vod_comments(
                str(external_id),
                state.get("chatCursor"),
                content_offset_seconds=range_start_s,
                stop_after_seconds=range_end_s,
            )
        except ChatFetchBudgetExceeded:
            messages = []
        messages = _rebase_chat_to_analyzed_span(messages, range_start_s)
        return messages, "twitch_gql"
    return None, "none"
