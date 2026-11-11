#!/usr/bin/env python3
"""Production worker ASS output for Batch 2B preview/export byte parity tests."""
from __future__ import annotations
import json
import os
import sys
import tempfile
from pathlib import Path

from clips_worker.captions_ass import build_ass
from clips_worker.caption_presets import PRESETS

WORDS = [
    {"i": 0, "w": "VISIBLE", "s": 0.0, "e": 0.5},
    {"i": 1, "w": "WORDS", "s": 0.5, "e": 1.0},
]
DIMENSIONS = [(180, 320), (240, 240), (320, 180)]


def main() -> None:
    result = {}
    with tempfile.TemporaryDirectory(prefix="transovo-b2b-ass-") as tmp:
        out = Path(tmp) / "captions.ass"
        for name in sorted(PRESETS):
            if not name.startswith("b2b_"):
                continue
            for width, height in DIMENSIONS:
                build_ass(WORDS, {"enabled": True, "presetId": name},
                          out, play_w=width, play_h=height)
                result[name + "|" + str(width) + "x" + str(height)] = out.read_text(encoding="utf-8")
    sys.stdout.write(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
