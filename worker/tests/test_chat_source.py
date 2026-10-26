import os

from clips_worker.streamer.chat.source import get_chat


def test_get_chat_none_when_twitch_gql_unset(monkeypatch):
    monkeypatch.delenv("TWITCH_GQL_CLIENT_ID", raising=False)
    monkeypatch.delenv("TWITCH_GQL_COMMENTS_HASH", raising=False)
    msgs, src = get_chat({"platform": "twitch", "externalId": "123", "state": {}})
    assert msgs is None
    assert src == "none"


def test_get_chat_kick_unavailable(monkeypatch):
    from clips_worker.streamer.chat import kick_chat

    monkeypatch.setattr(kick_chat, "fetch_kick_vod_chat", lambda *a, **k: None)
    msgs, src = get_chat({"platform": "kick", "url": "https://kick.com/x/videos/1", "state": {}})
    assert msgs is None
    assert src == "kick_unavailable"
