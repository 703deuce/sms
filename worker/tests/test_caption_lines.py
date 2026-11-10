"""Oversized caption cue splits must never drop words (PR #1132)."""
from clips_worker.caption_lines import MAX_CHARS, MIN_MS, normalize_caption_lines, plain_text


def test_one_char_overflow_on_4s_cue_merges_short_piece_and_keeps_all_words():
    # 201 plain characters on a 4 s cue: the 1-character overflow would be
    # ~20 ms, under MIN_MS (100). Merge it into its neighbor; never drop it.
    text = "x" * (MAX_CHARS + 1)
    assert len(text) == 201
    rows = normalize_caption_lines([{"id": "a", "text": text, "startMs": 0, "endMs": 4000}])
    kept = "".join(plain_text(r["text"]).replace("\n", "") for r in rows)
    assert kept == text
    assert all(r["endMs"] - r["startMs"] >= MIN_MS for r in rows)
    assert rows[0]["startMs"] == 0 and rows[-1]["endMs"] == 4000
    # The sub-100 ms overflow cannot stand alone, so it is merged back.
    assert len(rows) == 1
    assert rows[0]["text"] == text


def test_oversized_cue_splits_when_each_piece_is_long_enough_and_keeps_every_word():
    # 60 * "word" is 299 plain characters; over 1 s both halves are >= 100 ms.
    long = "word " * 60
    expected = " ".join(long.split())
    rows = normalize_caption_lines([{"id": "a", "text": long, "startMs": 0, "endMs": 1000}])
    kept = " ".join(plain_text(r["text"]).replace("\n", " ") for r in rows)
    assert kept == expected
    assert len(rows) >= 2
    assert all(r["endMs"] - r["startMs"] >= MIN_MS for r in rows)
    assert rows[0]["startMs"] == 0 and rows[-1]["endMs"] == 1000
    for a, b in zip(rows, rows[1:]):
        assert a["endMs"] == b["startMs"]
