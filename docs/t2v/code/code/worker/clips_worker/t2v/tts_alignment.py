"""ElevenLabs /with-timestamps character alignment -> Transovo transcript words.

Response (official docs, POST /v1/text-to-speech/{voice_id}/with-timestamps):
  { "audio_base64": "...", "alignment": { "characters": [...],
    "character_start_times_seconds": [...], "character_end_times_seconds": [...] },
    "normalized_alignment": {...} }
We use `alignment` (original text) so the words match what the user typed.

Output word shape matches project.transcriptWords consumed by new-app normalizeTranscriptWord()
and worker script_composition_render._editor_words_from_transcript(): {w, s, e, i, spk}.

Stable ids: i = scene_slot * 10_000 + k. Each scene owns a block of indexes, so re-voicing
scene 3 never renumbers words in scenes 4..N and keptWordIds in the FULL composition stay valid.
"""
from __future__ import annotations

WORD_BLOCK = 10_000


def words_from_alignment(alignment: dict, *, offset_s: float, scene_slot: int, spk: int = 0) -> list[dict]:
    chars = alignment.get("characters") or []
    starts = alignment.get("character_start_times_seconds") or []
    ends = alignment.get("character_end_times_seconds") or []
    words: list[dict] = []
    buf, w_start, w_end = "", None, None
    for ch, s, e in zip(chars, starts, ends):
        if ch.isspace():
            if buf:
                words.append({"w": buf, "s": w_start, "e": w_end})
            buf, w_start, w_end = "", None, None
            continue
        if not buf:
            w_start = s
        buf += ch
        w_end = e
    if buf:
        words.append({"w": buf, "s": w_start, "e": w_end})
    out = []
    for k, wd in enumerate(words):
        out.append({
            "w": wd["w"],
            "s": round(float(wd["s"]) + offset_s, 3),
            "e": round(float(wd["e"]) + offset_s, 3),
            "i": scene_slot * WORD_BLOCK + k,
            "spk": spk,
        })
    return out
