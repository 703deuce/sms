"""Step C: find moments (pass 1)."""
from __future__ import annotations

from clips_worker.picker.formatting import format_sentence_line
from clips_worker.picker.genre import genre_paragraph
from clips_worker.picker.llm import chat_json
from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals

RUBRIC = """A great short clip: (1) HOOK: the first sentence alone makes a scroller stop: a bold claim, surprising fact, strong opinion, question, conflict, or emotional line. Never start on filler (so, um, yeah, like I said) or mid-thought. (2) SELF-CONTAINED: makes sense with zero prior context; no unresolved 'that', 'he', 'it' references to earlier parts. (3) ONE IDEA with a PAYOFF: setup then a punchline, answer, lesson, number, or twist, and it ends right after the payoff, not trailing off. (4) ENERGY: favor rising vocal energy, laughter, quick back-and-forth, disagreement, storytelling with specifics (names, numbers, places). (5) VALUE: a viewer learns, feels, or laughs. Reject: intros/outros, sponsor reads, housekeeping, small talk, rambling with no point, and moments that need visuals to understand."""

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
    system = (
        "You are an expert short-form clip editor. Pick up to 15 clip moments using sentence indices.\n"
        f"{RUBRIC}\n"
        f"{genre_paragraph(genre)}"
    )
    user = f"User focus: {user_prompt or '(none)'}\n\nTranscript:\n{transcript}"
    data = chat_json(system, user, SCHEMA, "moments_pass1")
    return data.get("moments") or []
