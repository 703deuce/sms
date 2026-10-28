"""Step C: find moments (pass 1, chunked)."""
from __future__ import annotations

from clips_worker.picker.chunking import chunk_sentences, slice_sentence_range
from clips_worker.picker.config import load_core_rubric, load_examples, load_genre_prompt
from clips_worker.picker.formatting import format_sentence_line
from clips_worker.picker.llm import chat_json
from clips_worker.picker.log_util import json_snippet, picker_info
from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals
from clips_worker.target_clip_len import ClipLengthPolicy

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
    *,
    visual_moments: list[dict] | None = None,
    range_start_ms: int = 0,
    length_policy: ClipLengthPolicy | None = None,
) -> list[dict]:
    if not sentences:
        return []
    sig_by = {s.sentence_idx: s for s in signals}
    chunks = chunk_sentences(sentences)
    picker_info(
        "pass1_start",
        sentences=len(sentences),
        candidate_windows=len(chunks),
        genre=genre,
    )
    all_moments: list[dict] = []
    for lo_ms, hi_ms in chunks:
        chunk = slice_sentence_range(sentences, lo_ms, hi_ms)
        if not chunk:
            picker_info("pass1_chunk_empty", lo_ms=lo_ms, hi_ms=hi_ms)
            continue
        lines = [format_sentence_line(s, sig_by[s.idx]) for s in chunk]
        transcript = "\n".join(lines)
        picker_info(
            "pass1_chunk",
            lo_ms=lo_ms,
            hi_ms=hi_ms,
            sentences_in_chunk=len(chunk),
            transcript_chars=len(transcript),
        )
        from clips_worker.video_picker import format_moments_for_window

        visual_block = ""
        if visual_moments:
            slice_txt = format_moments_for_window(
                visual_moments,
                lo_ms,
                hi_ms,
                range_start_ms=range_start_ms,
            )
            if slice_txt:
                visual_block = (
                    "\n\nVisual watch (Gemini; t_s seconds from source range start). "
                    "Propose visual-only and low-speech gameplay moments; do not skip fights "
                    "just because the transcript is quiet in that window:\n"
                    f"{slice_txt}\n"
                )
        length_hint = f"\n{length_policy.pass1_length_hint()}\n" if length_policy else ""
        user = (
            f"User focus: {user_prompt or '(none)'}\n"
            "Return PASS 1 JSON. Find up to 3 candidates per 3 min of transcript; overgenerate.\n"
            "Use transcript AND visual notes together; visual-only beats count.\n"
            f"{length_hint}\n"
            f"Transcript chunk ({lo_ms}-{hi_ms} ms):\n{transcript}"
            f"{visual_block}"
        )
        data = chat_json(_pass1_system(genre), user, PASS1_SCHEMA, "moments_pass1")
        if not (data.get("moments") or []):
            picker_info("pass1_empty_retry", lo_ms=lo_ms, hi_ms=hi_ms)
            data = chat_json(_pass1_system(genre), user, PASS1_SCHEMA, "moments_pass1")
        picker_info("pass1_raw", lo_ms=lo_ms, hi_ms=hi_ms, raw=json_snippet(data))
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
    if len(all_moments) < 2 and len(sentences) >= 6:
        n = len(sentences)
        extras = [
            (0, min(n - 1, max(3, n // 2))),
            (max(0, n // 3), n - 1),
        ]
        seen = {(m["start_sentence"], m["end_sentence"]) for m in all_moments}
        for ss, es in extras:
            if (ss, es) in seen or es <= ss:
                continue
            all_moments.append(
                {
                    "start_sentence": ss,
                    "end_sentence": es,
                    "anchor_id": ss,
                    "archetype": "story",
                    "locator": "",
                    "why": "coverage_span",
                }
            )
            seen.add((ss, es))
            if len(all_moments) >= 2:
                break
        picker_info("pass1_coverage_extra", moments=len(all_moments))

    picker_info("pass1_done", moments=len(all_moments))
    return all_moments
