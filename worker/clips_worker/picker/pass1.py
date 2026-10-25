"""Step C: find moments (pass 1)."""
from __future__ import annotations

from clips_worker.picker.config import load_core_rubric, load_genre_prompt, signal_preferences_text
from clips_worker.picker.formatting import format_sentence_line
from clips_worker.picker.llm import chat_json
from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals

SCHEMA = {
    "type": "object",
    "properties": {
        "moments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start_sentence": {"type": "integer"},
                    "end_sentence": {"type": "integer"},
                    "why": {"type": "string"},
                },
                "required": ["start_sentence", "end_sentence", "why"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["moments"],
    "additionalProperties": False,
}


def find_moments(
    sentences: list[Sentence],
    signals: list[SentenceSignals],
    genre: str,
    user_prompt: str,
) -> list[dict]:
    if not sentences:
        return []
    sig_by_idx = {s.sentence_idx: s for s in signals}
    lines = [format_sentence_line(s, sig_by_idx[s.idx]) for s in sentences]
    transcript = "\n".join(lines)
    prefs = signal_preferences_text(genre)
    system = (
        "You are an expert short-form clip editor. Pick up to 15 clip moments using sentence indices.\n"
        f"{load_core_rubric()}\n"
        f"{load_genre_prompt(genre)}"
    )
    if prefs:
        system += f"\n\n{prefs}"
    user = f"User focus: {user_prompt or '(none)'}\n\nTranscript:\n{transcript}"
    data = chat_json(system, user, SCHEMA, "moments_pass1")
    return data.get("moments") or []
