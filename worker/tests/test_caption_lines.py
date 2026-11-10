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


def _words(rows):
    out = []
    for r in rows:
        out.extend(w for w in plain_text(r["text"]).replace("\n", " ").split() if w)
    return out


def _hundred_words():
    return [f"w{i:04d}" for i in range(1, 101)]


def test_600_char_cue_keeps_100_intact_words_in_four_pieces():
    # VQ: 100 tokens w0001..w0100 (599 chars) over 1000–25000 ms. Frontend
    # splitTokensByMaxChars yields 4 pieces and 100 intact words; w0034 and
    # w0067 must not be torn.
    words = _hundred_words()
    text = " ".join(words)
    assert len(text) == 599
    rows = normalize_caption_lines([{"id": "c600", "text": text, "startMs": 1000, "endMs": 25000}])
    kept = _words(rows)
    assert kept == words
    assert len(kept) == 100
    assert len(rows) == 4
    assert "w0034" in kept and "w0067" in kept
    assert "w0" not in kept and "034" not in kept
    assert "w006" not in kept and "7" not in kept
    assert kept.count("w0034") == 1 and kept.count("w0067") == 1
    assert [r["endMs"] - r["startMs"] for r in rows] == [7933, 7933, 7933, 201]
    assert rows[0]["startMs"] == 1000 and rows[-1]["endMs"] == 25000


def test_240_char_single_token_stays_whole():
    word = "x" * 240
    rows = normalize_caption_lines([{"id": "huge", "text": word, "startMs": 1000, "endMs": 2000}])
    assert len(rows) == 1
    assert rows[0]["text"] == word
    assert rows[0]["startMs"] == 1000 and rows[0]["endMs"] == 2000
    assert _words(rows) == [word]
    assert len(rows[0]["text"]) == 240


def test_150ms_two_piece_cue_keeps_every_word():
    # 40 words over 0–150 ms would pack as two pieces under 100 ms each;
    # merge them instead of dropping words.
    words = [f"word{str(i).zfill(2)}" for i in range(1, 41)]
    rows = normalize_caption_lines([{"id": "short", "text": " ".join(words), "startMs": 0, "endMs": 150}])
    assert _words(rows) == words
    assert rows[0]["startMs"] == 0 and rows[-1]["endMs"] == 150


def test_zero_length_cue_is_dropped_without_error():
    rows = normalize_caption_lines([
        {"id": "z", "text": "This should not appear", "startMs": 1000, "endMs": 1000},
        {"id": "ok", "text": "Kept", "startMs": 2000, "endMs": 3000},
    ])
    assert _words(rows) == ["Kept"]
    assert all(r["endMs"] - r["startMs"] >= MIN_MS for r in rows)


def test_overlap_trim_merges_leftover_under_100ms_instead_of_dropping():
    # After trimming B to start at A's end, B is only 40 ms. Merge into the
    # neighbor; do not drop "world".
    rows = normalize_caption_lines([
        {"id": "a", "text": "Hello there", "startMs": 0, "endMs": 1000},
        {"id": "b", "text": "world", "startMs": 960, "endMs": 1090},
    ])
    # B is duration-valid (130 ms) but only 90 ms remain after the overlap trim.
    assert _words(rows) == ["Hello", "there", "world"]
    assert rows[0]["startMs"] == 0
    assert rows[-1]["endMs"] >= 1090
    assert all(r["endMs"] - r["startMs"] >= MIN_MS for r in rows)


def test_201_char_two_token_cue_stays_two_legal_pieces():
    # Frontend leaves two legal-duration pieces; do not mid-word-split then
    # merge back into one 201-char cue.
    text = ("a" * 100) + " " + ("b" * 100)
    assert len(text) == 201
    rows = normalize_caption_lines([{"id": "even", "text": text, "startMs": 0, "endMs": 4000}])
    assert _words(rows) == ["a" * 100, "b" * 100]
    assert len(rows) == 2
    assert all(r["endMs"] - r["startMs"] >= MIN_MS for r in rows)
    assert rows[0]["startMs"] == 0 and rows[-1]["endMs"] == 4000
