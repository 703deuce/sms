"""Step C: find moments (pass 1, chunked)."""
from __future__ import annotations

from clips_worker.picker.chunking import chunk_sentences, slice_sentence_range
from clips_worker.picker.config import load_core_rubric, load_examples, load_genre_prompt
from clips_worker.picker.formatting import format_sentence_line
from clips_worker.picker.llm import chat_json
from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals

PASS1_SCHEMA = {
    "type": "object",
    "properties": {
        "moments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "anchor_id": {"type": "integer"},
                    "approx_start_id": {"type": "integer"},
                    "approx_end_id": {"type": "integer"},
                    "archetype": {"type": "string"},
                    "locator": {"type": "string"},
                    "read_ahead_needed": {"type": "boolean"},
                    "why": {"type": "string"},
                },
                "required": [
                    "anchor_id",
                    "approx_start_id",
                    "approx_end_id",
                    "archetype",
                    "locator",
                    "read_ahead_needed",
                    "why",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["moments"],
    "additionalProperties": False,
}


def _pass1_system(genre: str) -> str:
    ex = load_examples()
    parts = [
        "You are Transovo's clip editor. Return PASS 1 JSON only.",
        load_core_rubric(),
        load_genre_prompt(genre),
    ]
    if ex:
        parts.append("FEW-SHOT EXAMPLES (EXAMPLE DATA):\n" + ex[:12000])
    return "\n\n".join(parts)


def find_moments(
    sentences: list[Sentence],
    signals: list[SentenceSignals],
    genre: str,
    user_prompt: str,
) -> list[dict]:
    if not sentences:
        return []
    sig_by = {s.sentence_idx: s for s in signals}
    all_moments: list[dict] = []
    for lo_ms, hi_ms in chunk_sentences(sentences):
        chunk = slice_sentence_range(sentences, lo_ms, hi_ms)
        if not chunk:
            continue
        lines = [format_sentence_line(s, sig_by[s.idx]) for s in chunk]
        transcript = "\n".join(lines)
        user = (
            f"User focus: {user_prompt or '(none)'}\n"
            "Return PASS 1 JSON. Find up to 3 candidates per 3 min of transcript; overgenerate.\n\n"
            f"Transcript chunk ({lo_ms}-{hi_ms} ms):\n{transcript}"
        )
        data = chat_json(_pass1_system(genre), user, PASS1_SCHEMA, "moments_pass1")
        for m in data.get("moments") or []:
            all_moments.append(
                {
                    "start_sentence": int(m["approx_start_id"]),
                    "end_sentence": int(m["approx_end_id"]),
                    "anchor_id": int(m.get("anchor_id", m["approx_start_id"])),
                    "archetype": m.get("archetype", "story"),
                    "locator": m.get("locator", ""),
                    "why": m.get("why", ""),
                }
            )
    return all_moments
