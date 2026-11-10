"""Worker ASS sentence case must match frontend formatCaptionWord (#1109 / #1107)."""
from pathlib import Path

from clips_worker.captions_ass import build_ass, disp, disp_words


def format_caption_word_frontend(text: str, case_mode: str, sentence_start: bool) -> str:
    """Python twin of new-app/lib/clips/caption-case.ts formatCaptionWord (PR #1109)."""
    safe = text if isinstance(text, str) else ""
    if not safe:
        return ""
    if case_mode == "upper":
        return safe.upper()
    if not sentence_start:
        return safe
    return safe[0:1].upper() + safe[1:]


def test_disp_matches_frontend_format_caption_word():
    samples = [
        ("I", "sentence", False),
        ("I'm", "sentence", False),
        ("Wayne", "sentence", False),
        ("State", "sentence", False),
        ("Michigan", "sentence", False),
        ("Egypt", "sentence", False),
        ("AI", "sentence", False),
        ("PhD", "sentence", False),
        ("early", "sentence", True),
        ("I'll", "sentence", True),
        ("ready.", "sentence", True),
        ("i'm", "sentence", True),
        ("hello", "upper", False),
        ("AI", "upper", True),
        ("", "sentence", True),
    ]
    for text, case, start in samples:
        escaped = text.replace("{", "(").replace("}", ")")
        assert disp(text, case, start) == format_caption_word_frontend(escaped, case, start)


def test_sentence_case_keeps_mid_sentence_i_proper_nouns_and_acronyms():
    chunk = [
        {"w": "early"},
        {"w": "on"},
        {"w": "I"},
        {"w": "I'm"},
        {"w": "at"},
        {"w": "Wayne"},
        {"w": "State"},
        {"w": "in"},
        {"w": "Michigan"},
        {"w": "studying"},
        {"w": "AI"},
        {"w": "and"},
        {"w": "a"},
        {"w": "PhD."},
        {"w": "ready."},
        {"w": "I'll"},
        {"w": "go."},
    ]
    out = disp_words(chunk, "sentence", styled=False)
    assert out[0] == "Early"
    assert out[2] == "I"
    assert out[3] == "I'm"
    assert out[5] == "Wayne"
    assert out[6] == "State"
    assert out[8] == "Michigan"
    assert out[10] == "AI"
    assert out[13] == "PhD."
    assert out[14] == "Ready."  # previous word ended the sentence
    assert out[15] == "I'll"
    # A new sentence after ". ? !" capitalizes only the first letter.
    chunk2 = [
        {"w": "ready."},
        {"w": "I'll"},
        {"w": "go!"},
        {"w": "next"},
        {"w": "is"},
        {"w": "AI."},
        {"w": "ok?"},
        {"w": "sure"},
    ]
    out2 = disp_words(chunk2, "sentence", styled=False)
    assert out2 == ["Ready.", "I'll", "go!", "Next", "is", "AI.", "Ok?", "Sure"]


def test_upper_case_still_uppercases_every_word():
    chunk = [{"w": "I"}, {"w": "I'm"}, {"w": "at"}, {"w": "Wayne"}, {"w": "AI"}]
    assert disp_words(chunk, "upper", styled=False) == ["I", "I'M", "AT", "WAYNE", "AI"]


def test_build_ass_sentence_case_matches_frontend_preview_words(tmp_path: Path):
    ass = tmp_path / "sentence.ass"
    words = [
        {"w": "early", "s": 0.0, "e": 0.3, "idx": 0},
        {"w": "on", "s": 0.3, "e": 0.5, "idx": 1},
        {"w": "I", "s": 0.5, "e": 0.7, "idx": 2},
        {"w": "I'm", "s": 0.7, "e": 1.0, "idx": 3},
        {"w": "at", "s": 1.0, "e": 1.2, "idx": 4},
        {"w": "Wayne", "s": 1.2, "e": 1.5, "idx": 5},
        {"w": "State", "s": 1.5, "e": 1.8, "idx": 6},
        {"w": "in", "s": 1.8, "e": 2.0, "idx": 7},
        {"w": "Michigan", "s": 2.0, "e": 2.4, "idx": 8},
        {"w": "for", "s": 2.4, "e": 2.6, "idx": 9},
        {"w": "AI", "s": 2.6, "e": 2.9, "idx": 10},
        {"w": "and", "s": 2.9, "e": 3.1, "idx": 11},
        {"w": "a", "s": 3.1, "e": 3.3, "idx": 12},
        {"w": "PhD.", "s": 3.3, "e": 3.8, "idx": 13},
        {"w": "I'll", "s": 3.8, "e": 4.1, "idx": 14},
        {"w": "stay.", "s": 4.1, "e": 4.6, "idx": 15},
    ]
    build_ass(
        words,
        {"presetId": "clean_white", "case": "sentence", "animation": "none", "wordsPerLine": 8},
        ass,
    )
    body = ass.read_text(encoding="utf-8")
    expected = disp_words(words, "sentence", styled=False)
    # Frontend preview / SRT use the same transform; burned-in ASS must show
    # the same visible words (I, I'm, Wayne State, Michigan, AI, PhD).
    assert expected[0] == "Early"
    assert expected[14] == "I'll"
    for token in expected:
        assert token in body, f"missing {token!r} in ASS\n{body}"
    assert "I'm" in body
    assert "Wayne" in body and "Michigan" in body
    assert "AI" in body and "PhD." in body
    assert "}i {" not in body and "}i'm" not in body
    assert "wayne" not in body
