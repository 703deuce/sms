"""Source-window preparation must keep ASR aligned to the downloaded MP4."""
from clips_worker.streamer.agent_prepare_job import rebase_window_words, MAX_WINDOW_MS
from clips_worker.chat_overlay_apply import original_chat_range_ms


def test_rebase_preserves_only_selected_original_words_and_local_times():
    words = [
        {"w": "before", "s": 4.0, "e": 4.4},
        {"w": "setup", "s": 10.5, "e": 11.2},
        {"w": "payoff", "s": 15.0, "e": 15.7},
        {"w": "after", "s": 20.1, "e": 20.4},
    ]
    local = rebase_window_words(words, 10_000, 20_000)
    assert [w["w"] for w in local] == ["setup", "payoff"]
    assert abs(local[0]["s"] - 0.5) < 1e-6
    assert abs(local[1]["e"] - 5.7) < 1e-6


def test_rebase_isolated_from_unsafe_or_out_of_range_tokens():
    local = rebase_window_words([
        {"w": "bad", "s": "not_a_number", "e": 10},
        {"w": "reversed", "s": 9, "e": 8},
        {"w": "clipped", "s": 8.8, "e": 10.3},
        {"w": "end", "s": 19.8, "e": 22},
    ], 10_000, 20_000)
    assert len(local) == 2
    assert local[0]["s"] == 0
    assert abs(local[-1]["e"] - 10.0) < 1e-6


def test_supports_object_wrapped_words_and_bounded_windows():
    assert MAX_WINDOW_MS == 20 * 60_000
    assert rebase_window_words({"words": [
        {"w": "hello", "s": 2.0, "e": 3.0}
    ]}, 0, 5_000)[0]["w"] == "hello"


def test_stream_chat_replay_times_follow_original_vod_not_local_window():
    # 30m into the original VOD, a 12s generated clip begins 4s into the
    # downloaded agent window. Chat is read in ORIGINAL VOD coordinates.
    assert original_chat_range_ms(4_000,16_000,1_800_000) == (1_804_000,1_816_000)
