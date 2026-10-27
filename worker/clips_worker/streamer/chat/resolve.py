"""Chat fetch result handling for stream analyze (soft-fail replay)."""
from __future__ import annotations

from concurrent.futures import Future


def resolve_chat_after_transcribe(
    chat_future: Future,
    state: dict,
) -> tuple[list[dict] | None, str, dict]:
    from clips_worker.streamer.chat.twitch_gql import TwitchChatReplayError

    chat_messages: list[dict] | None = None
    chat_source = "none"
    try:
        chat_messages, chat_source = chat_future.result()
    except TwitchChatReplayError as exc:
        print(f"stream analyze chat replay failed (continuing): {exc}", flush=True)
        state = {**state, "chatError": str(exc)[:500]}
        chat_messages, chat_source = [], "none"
    except Exception as exc:
        print(f"stream analyze chat fetch failed (continuing): {exc}", flush=True)
        state = {**state, "chatError": str(exc)[:500]}
        chat_messages, chat_source = [], "none"
    else:
        if chat_messages is not None:
            state = {k: v for k, v in state.items() if k != "chatError"}
    return chat_messages, chat_source, state
