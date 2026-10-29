"""C3 IRL-first rubric judge: prompt text, schema, input formatting, parsing, scoring.

Pure module: no flag reads, no I/O, no network. Callers: streamer/llm_rank.py (text batch,
CLIPFIND_JUDGE_V2) and clipfind/dense.py (frames, CLIPFIND_DENSE_LOOK).
Source of the rubric: research/irl_clip_rubric.md sections B/C (Oct 29, 2026).
"""
from __future__ import annotations

import re
from typing import Any

JUDGE_PROMPT_VERSION = "judge_v2_irl_2026-10-29"

ARCHETYPES = (
    "stranger_encounter", "confrontation", "quick_wit", "chat_roast_tts", "hot_take", "storytime",
    "banter", "reaction_to_content", "fail", "wholesome", "rizz", "surprising_answer", "gaming_play", "none",
)
RISK_FLAGS = (
    "bystander_target", "minor", "private_info", "sexual", "violence_or_medical",
    "third_party_media", "creator_regret", "hate_or_harassment",
)
# Flags that must never render as primary (demote to "more", render=False). Others demote one band.
BLOCK_FLAGS = frozenset({"minor", "sexual", "private_info", "hate_or_harassment"})
WEIGHTS = {"payoff": 0.30, "standalone": 0.20, "hook": 0.15, "reaction": 0.15, "rewatch": 0.20}
# Legacy llm_rank category enum (llm_rank.py:23-36) so fusion/_reasons_for keep working.
ARCHETYPE_TO_CATEGORY = {
    "stranger_encounter": "reaction", "confrontation": "rage", "quick_wit": "funny",
    "chat_roast_tts": "funny", "hot_take": "story", "storytime": "story", "banter": "funny",
    "reaction_to_content": "reaction", "fail": "fail", "wholesome": "wholesome", "rizz": "funny",
    "surprising_answer": "funny", "gaming_play": "clutch", "none": "other",
}

_RUBRIC_BODY = """WHAT A CLIP IS
One complete beat a stranger can follow on mute with captions: SETUP (the least context needed), TURN/EVENT,
PAYOFF (the line, answer, outcome or play), REACTION (the laugh, stunned silence, comeback, crowd or chat).
The signal is not the moment. A laugh points back to a joke. A "W/L" spam points back to a take or outcome.
A badge or victory screen points back to the fight. A closing line points back to its question.
A viewer clip or a chat !clip marks the PAYOFF or the reaction; the setup is usually 5-30 s earlier.

HOW TO READ THE MODALITIES TOGETHER
1. Find the PAYOFF from the transcript and visuals first. Then use audio and chat only to confirm and to time the reaction.
2. Chat reacts late. Locate the event from what was said or shown, never from the chat spike time.
3. A loud stretch with no identifiable payoff in the transcript or visuals is NOT a clip (shouting, music, street noise,
   hype with no cause, a raid/sub/gift alert, reading chat aloud with no comeback).
4. A QUIET moment can score 9-10: a deadpan reply after a pause, a surprising answer, an awkward silence after a
   question, a stranger's unexpected line, a face changing with no sound, a quiet clutch play.
   Treat a held silence or a stunned face after a line as a REACTION. "(pause N s)" marks silences in the transcript.
5. For IRL: a second person entering the frame or addressing the camera is a strong start cue. Walking, driving,
   waiting and scenery alone are filler until something happens between people.
6. For reaction content: the clip must show enough of the on-screen source to see the cause.

FIND THE BOUNDARIES (all times in the same seconds as the transcript labels)
- setup_start_s: the earliest line or frame a stranger needs. For example the question asked, the claim made, the stranger's first
  line, the moment the stakes become visible (a 1vX, low HP), the start of the story ("so this one time..."), or the
  donation/TTS text being read. Never a greeting, "so anyway", or the previous topic. Start on a sentence boundary.
  If the setup is longer than ~30 s before the payoff, choose the latest start that still makes it understandable.
- payoff_s: the time of the punchline, answer, outcome or decisive play.
- reaction_end_s: after the reaction peaks and decays: the laugh ends, the comeback finishes, the stranger leaves,
  the streamer's one-line take lands. Include the pause before the reaction. Never end mid-laugh or mid-word, or into
  the next topic. Usually <=15 s after the payoff.
- hook_s (optional): if the first 3 s from setup_start_s are slow, the strongest 1-3 s (often the payoff or reaction)
  the editor could use as a cold open. Keep setup_start_s unchanged.

SCORE (each criterion 0-10)
payoff 0.30 . standalone 0.20 . hook 0.15 . reaction 0.15 . rewatch 0.20,
minus penalties: context_needed (0-4), boundary (0-5), risk (0-10).
Guidance: 9-10 = a stranger would share it. 7-8 = clearly good. 5-6 = fine filler. <=4 = drop.
Do not raise a score because it is loud or because chat spiked. Do not lower a score because it is quiet.
If the clip only makes sense with earlier stream context (an inside joke, "remember earlier"), standalone <=3.

RISK FLAGS (set every one that applies, even if the score is high)
bystander_target: a non-consenting stranger is the butt of the joke or humiliated.
minor: a person who appears under 18 is central (block any mockery, conflict or flirting with them).
private_info: an address, plate, phone, ID, house number, or a person's private details read or shown.
sexual: nudity or sexual content.
violence_or_medical: a fight, injury or emergency involving a non-streamer.
third_party_media: copyrighted video or music dominates the clip.
creator_regret: the streamer asks not to clip it, or is visibly distressed about it airing.
hate_or_harassment: slurs, or targeted harassment.
"""

_ITEM_FIELDS = """  "archetype": "stranger_encounter|confrontation|quick_wit|chat_roast_tts|hot_take|storytime|banter|reaction_to_content|fail|wholesome|rizz|surprising_answer|gaming_play|none",
  "event_present": true,
  "setup_start_s": 0.0, "payoff_s": 0.0, "reaction_end_s": 0.0, "hook_s": null,
  "beat_evidence": {"setup": "quote or frame", "payoff": "quote or frame", "reaction": "quote or frame"},
  "criteria": {"payoff": 0, "standalone": 0, "hook": 0, "reaction": 0, "rewatch": 0},
  "penalties": {"context_needed": 0, "boundary": 0, "risk": 0},
  "score": 0.0,
  "quiet_moment": false,
  "standalone_ok": true,
  "risk_flags": [],
  "observation_confidence": 0.0,
  "why": "one sentence a stranger would understand: what happens and why it lands",
  "title": "<=60 chars, no clickbait caps",
  "verdict": "keep|demote\""""

_RULES = """Rules: every time must lie inside the candidate's CONTEXT span and satisfy setup_start_s < payoff_s <= reaction_end_s.
If nothing qualifies, set event_present=false, archetype="none", verdict="demote" and say why.
Quote the transcript for evidence. Do not invent words that are not in the transcript.
observation_confidence: how sure you are about the beats from the evidence you were given (0-1)."""

JUDGE_SYSTEM_BATCH = (
    "You are judging candidate windows from a livestream for short vertical clips, one judgement per candidate.\n"
    "The content may be IRL, Just Chatting, a reaction, a podcast, or gaming, and it can change inside a window.\n"
    "Do not assume one mode; apply whichever archetypes fit each candidate.\n\n"
    "INPUTS PER CANDIDATE (times are seconds on the stream timeline, the same numbers as [t=...] labels):\n"
    "- CONTEXT span: the transcript covers 30 s before and 15 s after the proposed window so you can find the setup.\n"
    "- TRANSCRIPT: lines \"[t=start] (speaker) text\", plus \"(pause N s)\" for silences >= 0.8 s. The primary evidence.\n"
    "- VISUAL NOTES: what a video model saw near this time (may be missing). There are no frames in this pass.\n"
    "- AUDIO: loudness per 5 s (0-1). Context only.\n"
    "- CHAT: per 5 s, already shifted back ~6 s for lag (count, top emotes). It may still lag by up to ~15 s.\n"
    "- PAYOFF MARKERS: viewer clips / !clip calls near here. They mark the payoff or reaction, not the start.\n"
    "- CANDIDATE NOTE: why this was proposed. It is a hint, not proof.\n\n"
    + _RUBRIC_BODY
    + "\nOUTPUT: JSON only, with no prose outside it: {\"candidates\": [ {\n  \"id\": \"<candidate id>\",\n"
    + _ITEM_FIELDS + "\n} ]}\nReturn exactly one object per candidate id.\n" + _RULES
)

JUDGE_SYSTEM_DENSE = (
    "You are judging ONE candidate window from a livestream or video for a short vertical clip.\n"
    "The content may be IRL, Just Chatting, a reaction, a podcast, or gaming, and it can change inside the window.\n"
    "First label each sub-span: talking | irl | reaction | gaming | creative (more than one is allowed). Do not assume one mode.\n\n"
    "INPUTS (times are window-relative seconds; the window starts at t=0):\n"
    "- FRAMES: one every few seconds, each preceded by its [t=...] label. Read faces, who is in frame, on-screen source content, HUD, overlays.\n"
    "- AUDIO: the original audio track for the same timeline.\n"
    "- TRANSCRIPT: lines \"[t=start] (speaker) text\", plus \"(pause N s)\" for silences >= 0.8 s. The primary evidence for talk moments.\n"
    "- CHAT: per 5 s, already shifted back ~6 s for lag (count, top emotes). It may still lag by up to ~15 s.\n"
    "- PAYOFF MARKERS: viewer clips / !clip calls inside the window.\n"
    "- CANDIDATE NOTE and FIRST-PASS JUDGEMENT: hints, not proof.\n\n"
    + _RUBRIC_BODY
    + "\nOUTPUT: JSON only, with no prose outside it:\n{\n"
    + "  \"activity_labels\": [{\"start_s\": 0, \"end_s\": 0, \"label\": \"irl|talking|reaction|gaming|creative\"}],\n"
    + _ITEM_FIELDS + "\n}\n" + _RULES.replace("CONTEXT span", "window")
)

# OpenAI strict json_schema for the batch path (chat_json requires every key required, no extras).
_NUM_OR_NULL = {"type": ["number", "null"]}
_CRIT = {k: {"type": "number"} for k in WEIGHTS}
_PEN = {k: {"type": "number"} for k in ("context_needed", "boundary", "risk")}
_EVID = {k: {"type": "string"} for k in ("setup", "payoff", "reaction")}


def _obj(props: dict) -> dict:
    return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}


JUDGE_ITEM_SCHEMA = _obj({
    "id": {"type": "string"},
    "archetype": {"type": "string", "enum": list(ARCHETYPES)},
    "event_present": {"type": "boolean"},
    "setup_start_s": {"type": "number"},
    "payoff_s": {"type": "number"},
    "reaction_end_s": {"type": "number"},
    "hook_s": _NUM_OR_NULL,
    "beat_evidence": _obj(_EVID),
    "criteria": _obj(_CRIT),
    "penalties": _obj(_PEN),
    "score": {"type": "number"},
    "quiet_moment": {"type": "boolean"},
    "standalone_ok": {"type": "boolean"},
    "risk_flags": {"type": "array", "items": {"type": "string", "enum": list(RISK_FLAGS)}},
    "observation_confidence": {"type": "number"},
    "why": {"type": "string"},
    "title": {"type": "string"},
    "verdict": {"type": "string", "enum": ["keep", "demote"]},
})
JUDGE_BATCH_SCHEMA = _obj({"candidates": {"type": "array", "items": JUDGE_ITEM_SCHEMA}})


# ---------------------------------------------------------------- scoring (code, not the model)
def _c(x: Any, lo: float, hi: float) -> float:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return lo
    return max(lo, min(hi, v))


def rubric_score(criteria: dict | None, penalties: dict | None) -> float:
    """Weighted 0-10 score recomputed from the criteria. Inputs contain no loudness term on purpose:
    audio/chat can only change the model's confidence, never this number."""
    cr = criteria or {}
    pe = penalties or {}
    s = sum(w * _c(cr.get(k), 0, 10) for k, w in WEIGHTS.items())
    s -= _c(pe.get("context_needed"), 0, 4) + _c(pe.get("boundary"), 0, 5) + _c(pe.get("risk"), 0, 10)
    return round(max(0.0, min(10.0, s)), 2)


def band(score: float) -> str:
    return "advance" if score >= 8 else "keep" if score >= 6 else "more" if score >= 4 else "demote"


def risk_action(flags: list[str] | None) -> str:
    """'block' -> never primary (render False). 'demote' -> one band down. 'none'."""
    fl = {f for f in (flags or []) if f in RISK_FLAGS}
    if fl & BLOCK_FLAGS:
        return "block"
    return "demote" if fl else "none"


# ---------------------------------------------------------------- parsing
def parse_judge_item(row: Any, lo_s: float, hi_s: float) -> dict | None:
    """Validate one judgement. Times must be inside [lo_s, hi_s] and ordered.
    Returns a normalized dict (score recomputed) or None (caller falls back)."""
    if not isinstance(row, dict):
        return None
    try:
        s, p, r = float(row["setup_start_s"]), float(row["payoff_s"]), float(row["reaction_end_s"])
    except (KeyError, TypeError, ValueError):
        return None
    present = bool(row.get("event_present", True)) and row.get("archetype") != "none"
    ok_times = lo_s - 0.5 <= s < p <= r <= hi_s + 0.5
    if present and not ok_times:
        return None
    arch = row.get("archetype") if row.get("archetype") in ARCHETYPES else "none"
    flags = [f for f in (row.get("risk_flags") or []) if f in RISK_FLAGS]
    score = rubric_score(row.get("criteria"), row.get("penalties"))
    verdict = "demote" if (not present or row.get("verdict") == "demote" or score < 4) else "keep"
    hook = row.get("hook_s")
    hook = float(hook) if isinstance(hook, (int, float)) and lo_s <= float(hook) <= hi_s else None
    return {
        "id": str(row.get("id") or ""),
        "archetype": arch,
        "event_present": present,
        "setup_start_s": s if present else None,
        "payoff_s": p if present else None,
        "reaction_end_s": r if present else None,
        "hook_s": hook,
        "score": score,
        "model_score": _c(row.get("score"), 0, 10),
        "criteria": {k: _c((row.get("criteria") or {}).get(k), 0, 10) for k in WEIGHTS},
        "quiet_moment": bool(row.get("quiet_moment")),
        "standalone_ok": bool(row.get("standalone_ok", True)),
        "risk_flags": flags,
        "risk_action": risk_action(flags),
        "observation_confidence": _c(row.get("observation_confidence"), 0, 1),
        "why": str(row.get("why") or "")[:240],
        "title": str(row.get("title") or "")[:60],
        "evidence": {k: str(v)[:160] for k, v in (row.get("beat_evidence") or {}).items() if k in _EVID},
        "verdict": verdict,
        "band": band(score),
        "prompt_version": JUDGE_PROMPT_VERSION,
    }


def judge_to_llm_row(j: dict) -> dict:
    """Map a parsed batch judgement to the legacy llm_rank row consumed by fusion.py:349-402.
    keep is ALWAYS True: the judge demotes via ai_meta.clipfind.judge, it never deletes."""
    present = j["event_present"]
    return {
        "id": j["id"],
        "score": int(round(j["score"] * 10)),
        "keep": True,
        "title": j["title"] or j["why"][:60],
        "hook": (j["why"] or j["title"])[:90],
        "category": ARCHETYPE_TO_CATEGORY.get(j["archetype"], "other"),
        "suggestedCaption": None,
        "hashtags": [],
        "setup_start_s": j["setup_start_s"] if present else None,
        "payoff_end_s": j["reaction_end_s"] if present else None,
        "reason": j["why"],
        "_judge": j,
    }


def judge_beats_ms(j: dict | None, offset_s: float = 0.0) -> dict | None:
    """Judgement times -> absolute ms on the caller's timeline (offset_s = window start for dense)."""
    if not j or not j.get("event_present") or j.get("setup_start_s") is None:
        return None
    return {
        "setup": int(round((j["setup_start_s"] + offset_s) * 1000)),
        "payoff": int(round((j["payoff_s"] + offset_s) * 1000)),
        "reaction_end": int(round((j["reaction_end_s"] + offset_s) * 1000)),
    }


# ---------------------------------------------------------------- input formatting
_EMOTE_RE = re.compile(r"\b(LUL|KEKW|OMEGALUL|ICANT|LMAO|Pog|PogU|POGGERS|monkaS|monkaW|Aware|Clueless|DansGame|W|L)\b")


def transcript_lines(words: list[dict], lo_s: float, hi_s: float, *, rel_to: float = 0.0,
                     max_chars: int = 3500) -> str:
    """Words {"w","s","e"[,"speaker"]} -> '[t=12.3] (S1) text' lines; new line on pause >=0.8s,
    speaker change, sentence end, or 14 words. Pauses are written explicitly (quiet-moment cue)."""
    ws = [w for w in words if lo_s <= float(w.get("s", 0)) <= hi_s]
    lines: list[str] = []
    cur: list[str] = []
    cur_t = None
    cur_spk = None
    prev_e = None
    for w in ws:
        s, e = float(w.get("s", 0)), float(w.get("e", w.get("s", 0)))
        spk = w.get("speaker")
        gap = (s - prev_e) if prev_e is not None else 0.0
        if cur and (gap >= 0.8 or spk != cur_spk or len(cur) >= 14 or cur[-1][-1:] in ".?!"):
            lines.append(_line(cur_t, cur_spk, cur, rel_to))
            cur = []
        if gap >= 0.8:
            lines.append(f"(pause {gap:.1f} s)")
        if not cur:
            cur_t, cur_spk = s, spk
        cur.append(str(w.get("w") or "").strip())
        prev_e = e
    if cur:
        lines.append(_line(cur_t, cur_spk, cur, rel_to))
    out = "\n".join(lines) or "(no speech in this span)"
    return out if len(out) <= max_chars else out[:max_chars] + "\n(truncated)"


def _line(t: float | None, spk: Any, toks: list[str], rel_to: float) -> str:
    tag = f" ({spk})" if spk not in (None, "") else ""
    return f"[t={(t or 0) - rel_to:.1f}]{tag} " + " ".join(x for x in toks if x)


def chat_summary(messages: list[dict] | None, lo_s: float, hi_s: float, *, lag_s: float = 6.0,
                 rel_to: float = 0.0, bin_s: int = 5) -> str:
    """Per-5s counts + top emotes, shifted back by lag_s. Empty -> 'unavailable' (not a negative)."""
    if not messages:
        return "(chat unavailable: not evidence either way)"
    bins: dict[int, list[str]] = {}
    for m in messages:
        t = float(m.get("t_s", m.get("t", 0))) - lag_s
        if lo_s <= t <= hi_s:
            bins.setdefault(int((t - lo_s) // bin_s), []).append(str(m.get("text") or m.get("message") or ""))
    if not bins:
        return "(no chat messages in this span)"
    rows = []
    for b in sorted(bins):
        texts = bins[b]
        em: dict[str, int] = {}
        for tx in texts:
            for x in _EMOTE_RE.findall(tx):
                em[x] = em.get(x, 0) + 1
        top = ",".join(k for k, _ in sorted(em.items(), key=lambda kv: -kv[1])[:3]) or "-"
        rows.append(f"[t={lo_s + b * bin_s - rel_to:.0f}] n={len(texts)} top={top}")
    return "\n".join(rows[:40])


def audio_summary(curve: list[float] | None, lo_s: float, hi_s: float, *, rel_to: float = 0.0, bin_s: int = 5) -> str:
    if not curve:
        return "(no audio curve)"
    rows = []
    t = int(lo_s)
    while t < hi_s and t < len(curve):
        seg = curve[t: min(len(curve), t + bin_s)]
        rows.append(f"{t - rel_to:.0f}:{max(seg):.2f}")
        t += bin_s
    return " ".join(rows) or "(no audio curve)"


def format_judge_candidate(*, cand_id: str, start_s: float, end_s: float, words: list[dict],
                           audio: list[float] | None, chat_messages: list[dict] | None,
                           visual_notes: list[str], payoff_markers: list[float], note: str,
                           duration_s: float, lag_s: float = 6.0) -> str:
    lo = max(0.0, start_s - 30.0)
    hi = min(float(duration_s), end_s + 15.0)
    marks = ", ".join(f"t={m:.1f}" for m in payoff_markers if lo <= m <= hi) or "(none)"
    return "\n".join([
        f"CANDIDATE id={cand_id} proposed=[{start_s:.1f}, {end_s:.1f}] CONTEXT=[{lo:.1f}, {hi:.1f}]",
        f"CANDIDATE NOTE: {note[:200] or '(none)'}",
        "TRANSCRIPT:", transcript_lines(words, lo, hi),
        "VISUAL NOTES:", "\n".join(v[:220] for v in visual_notes[:4]) or "(none)",
        f"AUDIO: {audio_summary(audio, lo, hi)}",
        "CHAT:", chat_summary(chat_messages, lo, hi, lag_s=lag_s),
        f"PAYOFF MARKERS: {marks}",
    ])
