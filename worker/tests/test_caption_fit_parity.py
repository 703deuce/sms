"""E3fix2: preview ↔ export caption line-break parity.

worker/tests/fixtures/caption_fit_parity.json holds caption cases (edits.captions, aspect, words)
and, per chunk, the line breaks + shrink the export ASS actually contains. This test rebuilds the
ASS with build_ass at BOTH 720p and 1080p and asserts they match the fixture (breaks are
resolution-independent); new-app/tests/caption-fit-parity.test.ts asserts lib/clips/caption-fit.ts
produces the same from the same JSON. Regenerate after an intentional change:
    WRITE_CAPTION_FIT_FIXTURE=1 python -m pytest -q tests/test_caption_fit_parity.py
"""
from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path

from clips_worker.captions_ass import build_ass, ts

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "caption_fit_parity.json"
METRICS_WORKER = Path(__file__).resolve().parents[1] / "clips_worker" / "caption_font_metrics.json"
METRICS_WEB = Path(__file__).resolve().parents[2] / "new-app" / "lib" / "clips" / "caption-fit-metrics.json"

DIMS = {
    "9:16": [(1080, 1920), (720, 1280)],
    "1:1": [(1080, 1080), (720, 720)],
    "4:5": [(1080, 1350), (720, 900)],
    "16:9": [(1920, 1080), (1280, 720)],
}
LUDWIG = {
    "case": "sentence", "size": 6.5, "enabled": True, "position": "bottom", "presetId": "bold_pop",
    "animation": "pop", "marginVPct": 14, "wordsPerLine": 3, "emphasis": [0, 2, 7],
    "presetConfig": {"font": "Montserrat Black", "active": "#FFD93D", "weight": 900, "primary": "#FFFFFF",
                     "outlineW": 8, "emphasisScale": 1.12},
}
TEXT_A = "Energy, capital, whatever. Of forming a company is basically impossible right now honestly"
TEXT_B = "SUPERCALIFRAGILISTICEXPIALIDOCIOUS wow incomprehensibilities internationalization ok"
TEXT_C = "I just think that we should dip, Valorant isn't worth it at all anymore guys"
FONTS = ["Poppins", "Anton", "Montserrat Black", "Bangers", "Inter", "Lato", "Bebas Neue",
         "Luckiest Guy", "Archivo Black", "Oswald"]


def _cases() -> list[dict]:
    out: list[dict] = [{"id": "ludwig_bold_pop_montserrat", "captions": LUDWIG, "aspect": "9:16", "text": TEXT_A}]
    for f in FONTS:
        out.append({"id": f"font_{f}", "aspect": "9:16", "text": TEXT_A,
                    "captions": {"presetId": "bold_pop", "font": f, "size": 7.5, "wordsPerLine": 4}})
    for pid in ["bold_pop", "clean_white", "boxed", "karaoke", "minimal", "neon", "bounce", "slide_up", "highlighter"]:
        out.append({"id": f"preset_{pid}", "aspect": "9:16", "text": TEXT_C,
                    "captions": {"presetId": pid, "wordsPerLine": 4, "size": 8, "emphasis": [1, 5]}})
    for asp in ["1:1", "4:5", "16:9"]:
        out.append({"id": f"aspect_{asp}", "aspect": asp, "text": TEXT_A,
                    "captions": {**LUDWIG, "wordsPerLine": 4, "size": 9}})
    out += [
        {"id": "shrink_single_word", "aspect": "9:16", "text": TEXT_B,
         "captions": {"presetId": "bold_pop", "font": "Montserrat Black", "size": 10, "wordsPerLine": 1}},
        {"id": "highlight_box", "aspect": "9:16", "text": TEXT_C,
         "captions": {"presetId": "bold_pop", "activeStyle": "highlight", "wordsPerLine": 3, "size": 9}},
        {"id": "size_tie_7_25", "aspect": "9:16", "text": TEXT_A,
         "captions": {"presetId": "bold_pop", "size": 7.25, "wordsPerLine": 3}},
        {"id": "size_clamped_12", "aspect": "9:16", "text": TEXT_C,
         "captions": {"presetId": "bold_pop", "size": 12, "wordsPerLine": 2}},
        {"id": "cp1", "aspect": "9:16", "text": TEXT_C, "captions": {"presetId": "cp1", "wordsPerLine": 9, "size": 3}},
        {"id": "cp2", "aspect": "9:16", "text": TEXT_A, "captions": {"presetId": "cp2"}},
        {"id": "cp11", "aspect": "9:16", "text": TEXT_A, "captions": {"presetId": "cp11"}},
    ]
    return out


def _words(text: str) -> list[dict]:
    return [{"w": w, "s": i * 0.5, "e": i * 0.5 + 0.4, "i": i} for i, w in enumerate(text.split())]


_PREFIX = re.compile(r"^(\{\\move[^}]*\})?\{\\fscx(\d+)\\fscy(\d+)\}")
_TAGS = re.compile(r"\{[^}]*\}")


def _chunks_from_ass(ass_text: str, words: list[dict]) -> list[dict]:
    caps: dict[str, str] = {}
    for ln in ass_text.splitlines():
        if not ln.startswith("Dialogue:"):
            continue
        parts = ln.split(",", 9)
        if parts[3] != "Cap":
            continue
        caps.setdefault(parts[1], parts[9])
    out: list[dict] = []
    i = 0
    while i < len(words):
        text = caps[ts(words[i]["s"])]
        m = _PREFIX.match(text)
        pct = int(m.group(2)) if m else 100
        segs = [s.split() for s in _TAGS.sub("", text).split(r"\N")]
        n = sum(len(s) for s in segs)
        breaks, acc = [], 0
        for s in segs[:-1]:
            acc += len(s)
            breaks.append(acc)
        out.append({"n": n, "breaks": breaks, "pct": pct})
        i += n
    return out


def _export_chunks(case: dict, play_w: int, play_h: int) -> list[dict]:
    words = _words(case["text"])
    d = Path(tempfile.mkdtemp())
    build_ass(words, dict(case["captions"]), d / "c.ass", play_w=play_w, play_h=play_h)
    return _chunks_from_ass((d / "c.ass").read_text(), words)


def _generate() -> dict:
    cases = []
    for c in _cases():
        w, h = DIMS[c["aspect"]][0]
        cases.append({**c, "expected": _export_chunks(c, w, h)})
    return {"cases": cases}


def test_metrics_tables_are_byte_identical():
    assert METRICS_WORKER.read_bytes() == METRICS_WEB.read_bytes()
    fonts = set(json.loads(METRICS_WORKER.read_text()))
    assert {"Poppins ExtraBold", "Anton", "Montserrat Black", "Bangers", "Inter", "Lato", "Bebas Neue",
            "Luckiest Guy", "Archivo Black", "Oswald"} <= fonts


def test_fixture_matches_export_ass_at_720p_and_1080p():
    data = _generate()
    if os.environ.get("WRITE_CAPTION_FIT_FIXTURE"):
        FIXTURE.write_text(json.dumps(data, indent=1) + "\n")
    fixture = json.loads(FIXTURE.read_text())
    assert [c["id"] for c in fixture["cases"]] == [c["id"] for c in data["cases"]]
    for fc, gc in zip(fixture["cases"], data["cases"], strict=True):
        assert fc["expected"] == gc["expected"], fc["id"]
        for w, h in DIMS[fc["aspect"]]:
            assert _export_chunks(fc, w, h) == fc["expected"], (fc["id"], w, h)


def test_fixture_exercises_breaks_and_shrink():
    fixture = json.loads(FIXTURE.read_text())
    chunks = [ch for c in fixture["cases"] for ch in c["expected"]]
    assert sum(1 for ch in chunks if ch["breaks"]) >= 10
    assert any(ch["pct"] < 100 for ch in chunks)
    assert sum(1 for ch in chunks if not ch["breaks"] and ch["pct"] == 100) >= 10
