import time

import pytest

from clips_worker.streamer.chat import source as chat_source
from clips_worker.streamer.chat.twitch_gql import (
    ChatFetchBudgetExceeded,
    fetch_all_vod_comments,
)
from clips_worker.streamer.progress import worker_progress_transcription_engine


def test_worker_progress_transcription_engine_filters_modal():
    assert worker_progress_transcription_engine("deepgram") == "deepgram"
    assert worker_progress_transcription_engine("local_whisper") == "local_whisper"
    assert worker_progress_transcription_engine("modal") is None
    assert worker_progress_transcription_engine("modal_diarize") is None


def test_vod_chat_window_from_trim_range():
    start_s, end_s = chat_source._vod_chat_window_s(
        {"rangeStartMs": 134_000_000, "rangeEndMs": 134_300_000, "durationMs": 300_000}
    )
    assert start_s == 134_000
    assert end_s == 134_300


def test_rebase_chat_messages():
    out = chat_source._rebase_chat_to_analyzed_span([{"t_s": 100, "text": "hi"}], 90)
    assert out[0]["t_s"] == 10


def test_fetch_all_stops_at_stop_after(monkeypatch):
    pages = [
        ([{"t_s": 10, "text": "a"}], "c1", True),
        ([{"t_s": 11, "text": "b"}], "c2", True),
        ([{"t_s": 20, "text": "past"}], None, False),
    ]

    def fake_fetch(_vid, cursor=None, *, content_offset_seconds=0):
        idx = 0 if cursor is None else 1 if cursor == "c1" else 2
        batch, cur, nxt = pages[idx]
        return batch, cur, nxt

    monkeypatch.setattr(
        "clips_worker.streamer.chat.twitch_gql.fetch_vod_comments",
        fake_fetch,
    )
    msgs, _ = fetch_all_vod_comments(
        "1",
        content_offset_seconds=10,
        stop_after_seconds=15,
        time_budget_s=30,
    )
    assert [m["t_s"] for m in msgs] == [10, 11]


def test_fetch_budget_raises_when_empty(monkeypatch):
    t = [1000.0]

    def fake_monotonic():
        t[0] += 10.0
        return t[0]

    monkeypatch.setattr(time, "monotonic", fake_monotonic)

    def slow_fetch(*_a, **_k):
        return ([], "c1", True)

    monkeypatch.setattr(
        "clips_worker.streamer.chat.twitch_gql.fetch_vod_comments",
        slow_fetch,
    )
    with pytest.raises(ChatFetchBudgetExceeded):
        fetch_all_vod_comments("1", time_budget_s=1.0)
