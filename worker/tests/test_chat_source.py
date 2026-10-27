from concurrent.futures import Future

from clips_worker.streamer.chat.resolve import resolve_chat_after_transcribe
from clips_worker.streamer.chat.source import get_chat
from clips_worker.streamer.chat.twitch_gql import TwitchChatReplayError


def test_get_chat_disabled_flag(monkeypatch):
    monkeypatch.setenv("STREAM_CHAT_SIGNAL", "0")
    msgs, src = get_chat({"platform": "twitch", "externalId": "123", "state": {}})
    assert msgs is None
    assert src == "disabled"


def test_get_chat_replay_off_returns_none(monkeypatch):
    monkeypatch.setenv("STREAM_CHAT_SIGNAL", "1")
    monkeypatch.setenv("TWITCH_VOD_CHAT_REPLAY", "off")
    msgs, src = get_chat({"platform": "twitch", "externalId": "123", "state": {}})
    assert msgs is None
    assert src == "none"


def test_get_chat_empty_replay_returns_empty_list(monkeypatch):
    monkeypatch.setenv("STREAM_CHAT_SIGNAL", "1")
    monkeypatch.delenv("TWITCH_VOD_CHAT_REPLAY", raising=False)
    monkeypatch.setattr(
        "clips_worker.streamer.chat.twitch_gql.fetch_all_vod_comments",
        lambda *a, **k: ([], None),
    )
    msgs, src = get_chat({"platform": "twitch", "externalId": "123", "state": {}})
    assert msgs == []
    assert src == "twitch_gql"


def test_get_chat_kick_unavailable(monkeypatch):
    from clips_worker.streamer.chat import kick_chat

    monkeypatch.setenv("STREAM_CHAT_SIGNAL", "1")
    monkeypatch.setattr(kick_chat, "fetch_kick_vod_chat", lambda _vod: None)
    msgs, src = get_chat({"platform": "kick", "url": "https://kick.com/x/videos/1", "state": {}})
    assert msgs is None
    assert src == "kick_unavailable"


def test_analyze_continues_on_chat_replay_error():
    fut: Future = Future()
    fut.set_exception(TwitchChatReplayError("gql down"))
    state = {"chunks": {}}
    msgs, src, state_out = resolve_chat_after_transcribe(fut, state)
    assert msgs == []
    assert src == "none"
    assert "chatError" in state_out


def test_resolve_chat_clears_stale_chat_error_on_success():
    fut: Future = Future()
    fut.set_result(([{"t": 0, "text": "hi"}], "twitch_gql"))
    state = {"chatError": "old failure"}
    msgs, src, state_out = resolve_chat_after_transcribe(fut, state)
    assert msgs == [{"t": 0, "text": "hi"}]
    assert src == "twitch_gql"
    assert "chatError" not in state_out
