"""Shared caption chunk timing (P3)."""
from __future__ import annotations


def chunk_caption_words(words: list[dict], preset: dict, emphasis_idx: set[int] | None = None) -> list[dict]:
    emph = emphasis_idx or set()
    wpl = max(1, int(preset.get("wordsPerChunk") or preset.get("wordsPerLine") or 3))
    max_lines = max(1, int(preset.get("maxLines") or 2))
    out: list[dict] = []
    i = 0
    while i < len(words):
        slice_words = words[i : i + wpl * max_lines]
        j = 0
        while j < len(slice_words):
            row = slice_words[j : j + wpl]
            if not row:
                break
            out.append(
                {
                    "t0": float(row[0]["s"]),
                    "t1": float(row[-1]["e"]),
                    "words": [
                        {
                            "text": str(w.get("w") or w.get("word") or ""),
                            "t0": float(w["s"]),
                            "t1": float(w["e"]),
                            "emph": (i + j + k) in emph,
                            "loud": False,
                        }
                        for k, w in enumerate(row)
                    ],
                }
            )
            j += wpl
        i += wpl * max_lines
    return out
