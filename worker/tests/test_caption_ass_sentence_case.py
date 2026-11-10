"""Worker ASS case must match #1109 frontend formatCaptionWord token for token."""
from __future__ import annotations

import re
from pathlib import Path

from clips_worker.captions_ass import build_ass, disp, disp_words


def format_caption_word(text: str, case_mode: str, sentence_start: bool) -> str:
    """Python twin of new-app/lib/clips/caption-case.ts formatCaptionWord (PR #1109)."""
    safe = text if isinstance(text, str) else ""
    if not safe:
        return ""
    if case_mode == "upper":
        return safe.upper()
    if not sentence_start:
        return safe
    return safe[0:1].upper() + safe[1:]


def is_sentence_boundary(prev_word: str | None) -> bool:
    """Python twin of #1109 isSentenceBoundary."""
    if not prev_word:
        return True
    return bool(re.search(r'[.!?]["\')\]]*$', prev_word.strip()))


def format_caption_chunk(tokens: list[str], case_mode: str) -> str:
    """Python twin of #1109 formatCaptionChunk."""
    if case_mode == "upper":
        return " ".join(w.upper() for w in tokens)
    sentence_start = True
    parts: list[str] = []
    for w in tokens:
        parts.append(format_caption_word(w, "sentence", sentence_start))
        sentence_start = is_sentence_boundary(w)
    return " ".join(parts)


def format_caption_line_text(text: str, case_mode: str) -> str:
    """Python twin of #1109 formatCaptionLineText."""
    safe = text if isinstance(text, str) else ""
    if not safe:
        return ""
    if case_mode == "upper":
        return re.sub(r"[^\s]+", lambda m: m.group(0).upper(), safe)
    parts = re.split(r"(\s+)", safe)
    sentence_start = True
    out: list[str] = []
    for part in parts:
        if not part or re.fullmatch(r"\s+", part):
            out.append(part)
            continue
        out.append(format_caption_word(part, "sentence", sentence_start))
        sentence_start = is_sentence_boundary(part)
    return "".join(out)


# Same 40-word excerpt as new-app/tests/fixtures/published-editor-words-excerpt-40.ts (#1109).
PUBLISHED_EDITOR_WORDS_EXCERPT_40 = [
    "created,", "which", "was", "me,", "they", "had", "deep", "creative",
    "differences", "and", "got", "divorced", "and", "both", "remarried.",
    "I", "was", "raised", "by", "my", "dad", "and", "my", "stepmom,",
    "Jackie.", "She", "is", "a", "daughter", "of", "the", "American",
    "Revolution", "from", "Gratiot", "County,", "middle", "of", "the", "state.",
]


def test_disp_matches_frontend_format_caption_word_token_for_token():
    samples = [
        ("early", "sentence", True, "Early"),
        ("Early", "sentence", True, "Early"),
        ("I", "sentence", False, "I"),
        ("I'm", "sentence", False, "I'm"),
        ("Wayne", "sentence", False, "Wayne"),
        ("State", "sentence", False, "State"),
        ("Michigan", "sentence", False, "Michigan"),
        ("Egypt", "sentence", False, "Egypt"),
        ("AI", "sentence", False, "AI"),
        ("PhD", "sentence", False, "PhD"),
        ("I'll", "sentence", True, "I'll"),
        ("ready.", "sentence", True, "Ready."),
        ("hello", "upper", False, "HELLO"),
        ("AI", "upper", True, "AI"),
        ("I'm", "upper", False, "I'M"),
        ("", "sentence", True, ""),
        ("{hi}", "sentence", False, "(hi)"),
    ]
    for text, case, start, expected in samples:
        escaped = text.replace("{", "(").replace("}", ")")
        assert disp(text, case, start) == format_caption_word(escaped, case, start)
        if text not in ("{hi}",):
            assert disp(text, case, start) == expected


def test_sentence_case_keeps_i_proper_nouns_and_acronyms_like_1109():
    assert format_caption_line_text("hello I went and I'm ready", "sentence") == "Hello I went and I'm ready"
    assert format_caption_chunk(["hello", "I", "went", "and", "I'm", "ready"], "sentence") == "Hello I went and I'm ready"
    assert format_caption_line_text("I studied at Wayne State in Michigan", "sentence") == "I studied at Wayne State in Michigan"
    assert format_caption_chunk(["I", "studied", "at", "Wayne", "State", "in", "Michigan"], "sentence") == "I studied at Wayne State in Michigan"
    assert format_caption_line_text("She earned a PhD in AI", "sentence") == "She earned a PhD in AI"
    assert format_caption_chunk(["She", "earned", "a", "PhD", "in", "AI"], "sentence") == "She earned a PhD in AI"
    assert format_caption_line_text("ready. I'll study Egypt where I'd go.", "sentence") == "Ready. I'll study Egypt where I'd go."

    chunk = [
        {"w": "hello"}, {"w": "I"}, {"w": "went"}, {"w": "and"}, {"w": "I'm"}, {"w": "ready"},
    ]
    assert " ".join(disp_words(chunk, "sentence", styled=False)) == "Hello I went and I'm ready"

    wayne = [{"w": w} for w in ["I", "studied", "at", "Wayne", "State", "in", "Michigan"]]
    assert " ".join(disp_words(wayne, "sentence", styled=False)) == "I studied at Wayne State in Michigan"

    acronyms = [{"w": w} for w in ["She", "earned", "a", "PhD", "in", "AI"]]
    assert " ".join(disp_words(acronyms, "sentence", styled=False)) == "She earned a PhD in AI"

    mid = [{"w": w} for w in ["ready.", "I'll", "study", "Egypt", "where", "I'd", "go."]]
    assert " ".join(disp_words(mid, "sentence", styled=False)) == "Ready. I'll study Egypt where I'd go."


def test_published_editor_words_excerpt_40_matches_frontend_and_keeps_capitals():
    expected = format_caption_chunk(PUBLISHED_EDITOR_WORDS_EXCERPT_40, "sentence")
    got = " ".join(disp_words([{"w": w} for w in PUBLISHED_EDITOR_WORDS_EXCERPT_40], "sentence", styled=False))
    assert got == expected
    assert got.startswith("Created,")
    # Mid-sentence capitals the old t.lower() path burned off.
    for token in ("I", "Jackie.", "She", "American", "Revolution", "Gratiot", "County,"):
        assert token in got.split()
    assert "jackie." not in got
    assert "american" not in got
    assert "gratiot" not in got


def test_upper_mode_still_uppercases_every_letter_like_1109():
    assert format_caption_line_text("I'm at Wayne State for a PhD", "upper") == "I'M AT WAYNE STATE FOR A PHD"
    chunk = [{"w": "I'm"}, {"w": "at"}, {"w": "Wayne"}]
    assert " ".join(disp_words(chunk, "upper", styled=False)) == "I'M AT WAYNE"


def test_build_ass_sentence_case_matches_1109_preview_words(tmp_path: Path):
    text = "hello I went to Wayne State for a PhD in AI and I'm from Michigan"
    expected = "Hello I went to Wayne State for a PhD in AI and I'm from Michigan"
    assert format_caption_line_text(text, "sentence") == expected
    assert format_caption_chunk(text.split(" "), "sentence") == expected
    tokens = text.split(" ")
    words = [{"w": w, "s": 0.2 + i * 0.1, "e": 0.3 + i * 0.1, "idx": i} for i, w in enumerate(tokens)]
    assert " ".join(disp_words(words, "sentence", styled=False)) == expected
    ass = tmp_path / "sentence.ass"
    build_ass(
        words,
        {"presetId": "clean_white", "case": "sentence", "animation": "none", "wordsPerLine": 8},
        ass,
    )
    body = ass.read_text(encoding="utf-8")
    for token in expected.split(" "):
        assert token in body, f"missing {token!r} in ASS\n{body}"
    assert "wayne" not in body
    assert "phd" not in body
    assert "i'm" not in body
