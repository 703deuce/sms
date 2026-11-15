"""T2V_VERIFY_STOCK — single-pass, visual-only Gemini check of stock candidates per shot.

Prompt-to-Video (stock MVP). For each planned shot the web app sends a short, ordered list of
stock candidates (Pixabay previews). For each candidate, in order, until one is accepted:

1. Download the provider preview rendition (allow-listed CDN hosts only).
2. Strip audio and downscale with ffmpeg (stock audio is never used; voiceover replaces it).
3. Blind describe, then score (the normal case, the line's lineShows is fixed):
   a. Gemini watches the muted clip with NO line or script context and writes a plain second-by-second
      description (same prompt as the describe test). Cached per provider + id + rendition
      (t2v_clip_descriptions), so each unique clip costs one call across lines, rounds and reruns.
   b. A text-only call scores that description against the line's fixed lineShows, the full sentence,
      neighbours and the whole script: seen, depicts, score, fit_reason, artifacts and the window.
   Old payloads without lineShows (and T2V_BLIND_DESCRIBE=0) keep the single combined video call.

No transcription, no audio analysis, no multi-pass review. Results are written into the job
payload (``results``) and posted to ``/api/t2v/internal/pipeline-verified``.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import re
import subprocess
import tempfile
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import requests

log = logging.getLogger(__name__)

ALLOWED_HOST_SUFFIXES = ("cdn.pixabay.com", "pixabay.com", "videos.pexels.com", "pexels.com", "player.vimeo.com", "replicate.delivery")
ACCEPT_SCORE = 7
MAX_CANDIDATES_PER_SHOT = 8
# When nothing passes, use the best-scoring clip that is at least loosely on-topic rather than a text card.
FALLBACK_MIN_SCORE = 3
MAX_PREVIEW_BYTES = 40 * 1024 * 1024
# Realistic styles (documentary etc.) accept live-action footage only.
LIVE_ACTION = "live_action"
# Just under the relevance bar but still works for the line: used before holding the previous shot.
USABLE_SCORE = 5
# dHash Hamming distance (64-bit) at or below which two frames count as the same shot.
NEAR_DUP_BITS = 10
PARALLEL_SHOTS = 4
MAX_OUTPUT_TOKENS = 2048
# Blind describe-then-score (NEW 1). Off only for debugging; old payloads without lineShows use the old call.
BLIND_DESCRIBE = os.environ.get("T2V_BLIND_DESCRIBE", "1").strip().lower() not in ("0", "false", "no", "off")
DESCRIBE_MAX_TOKENS = 2048
# Bumped when the describe prompt or the feed changes, so old cached descriptions are not reused.
DESCRIBE_VERSION = "events-v2"
DESCRIBE_FEED = "360p4fps-fps1-low"
# Entry copy of the blind description (rechecks read it for the window); the cache keeps the full text.
DESCRIBED_CHARS = 900

VERIFY_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        # Written FIRST: what THIS line is about (from the line in its sentence), then what is literally on screen,
        # then whether the screen shows it. The score is capped in code from that last judgement (DEPICTS_CAP).
        "line_shows": {"type": "STRING"},
        "seen": {"type": "STRING"},
        "depicts": {"type": "STRING", "enum": ["yes", "partly", "no"]},
        "visible": {"type": "STRING"},
        "main_subject": {"type": "STRING"},
        "action": {"type": "STRING"},
        "matches": {"type": "BOOLEAN"},
        "score": {"type": "INTEGER"},
        "in_s": {"type": "NUMBER"},
        "out_s": {"type": "NUMBER"},
        "issues": {"type": "STRING"},
        "style": {
            "type": "STRING",
            "enum": ["live_action", "animation", "3d_render", "motion_graphics", "clip_art", "screen_recording"],
        },
        "lighting": {"type": "INTEGER"},
        "framing": {"type": "STRING"},
        "time_of_day": {"type": "STRING", "enum": ["day", "night", "dusk_dawn", "indoor"]},
        "subject_visible": {"type": "BOOLEAN"},
        "fit_reason": {"type": "STRING"},
        "setting_fit": {"type": "STRING", "enum": ["fits", "neutral", "contradicts"]},
        "setting_reason": {"type": "STRING"},
    },
    "required": ["line_shows", "seen", "depicts", "setting_fit", "setting_reason", "visible", "main_subject", "action", "matches", "score", "fit_reason", "in_s", "out_s", "style", "lighting", "framing", "time_of_day", "subject_visible"],
    # Gemini fills properties in this order: what the line needs, what is on screen, does it show it, then the
    # score and only then the reason (writing the reason first let the model argue a clip into a pass).
    "propertyOrdering": ["line_shows", "seen", "depicts", "setting_fit", "setting_reason", "visible", "main_subject", "action", "score", "fit_reason", "matches", "subject_visible", "in_s", "out_s", "issues", "style", "lighting", "framing", "time_of_day"],
}

# Fixed line_shows (the normal case): written ONCE per line by the web (script-context pass, or once for a frozen
# plan) and given to every check of that line. The checker does not output it, so it cannot reshape what the line
# needs around the clip it is watching (sleep #1194: sc_20 had 40 different line_shows over 57 checks).
VERIFY_SCHEMA_FIXED: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {k: v for k, v in VERIFY_SCHEMA["properties"].items() if k != "line_shows"},
    "required": [k for k in VERIFY_SCHEMA["required"] if k != "line_shows"],
    "propertyOrdering": [k for k in VERIFY_SCHEMA["propertyOrdering"] if k != "line_shows"],
}

PROMPT = """You are the footage checker for an automatic stock-footage video editor.
You watch ONE short stock clip (video frames only; no audio) and decide whether a viewer watching THIS video
would immediately get this clip as THIS line. Judge only what is visible on screen, never titles or tags.

{script_block}Clip length: {clip_s:.1f} s. The shot needs about {need_s:.1f} s.

The whole script and the moment are context: they tell you what the video is about and what a viewer of it
expects to see. They never make a clip fit THIS line: a clip that would suit another line of the script, the
topic or the theme in general, but does not show THIS line, is a miss here. If this line is only part of a
sentence, read it as that whole sentence. If the line warns against doing something, a clip that shows that act
being done does not work.

Work in steps, in this order.
1. line_shows: in a few plain words, what a viewer should SEE on screen for what THIS line means (read inside
   its sentence): the action the line asks for or describes, or its result - not just the words it mentions.
   When the line advises stopping, avoiding or reducing something, line_shows is the advised action or its
   result, not the thing to stop.
2. seen: describe in plain words what is literally on screen: the people, things and actions you can actually
   see, and say if the picture is too dark, too small or too unclear to tell. Describe only.
3. depicts: does what you wrote in seen show line_shows, so that a viewer watching this video would get it at
   once, for most of the clip?
   - "yes": it plainly shows line_shows (the same thing or action, from any angle or in any everyday situation),
     and it would not look out of place to a viewer of this video.
   - "partly": it shows only part of line_shows, or shows it in a way or setting a viewer of this video would
     find odd.
   - "no": it shows something else - a related object or activity, the same category, a symbol, a mood, a
     metaphor, the result or a step only an argument connects, the habit or act the line advises against, or
     it is too unclear to tell.
   If an intended shot is given above, "yes" also needs the clip to show that intended shot (something merely
   similar is "partly" at most).
4. setting_fit: the implied setting given above (time of day, indoor/outdoor, kind of place, mood) is what a
   viewer of THIS video expects at this moment, read from its topic and the lines around it. Compare it with
   what the clip shows:
   - "contradicts": it visibly shows a different time of day (bright daylight for a night moment, night for a
     day one), the other side of indoor/outdoor, a clearly different kind of place, or a mood that clashes
     with the line in this video - even when the literal subject or action matches line_shows.
   - "fits": its visible time of day, place and mood match the implied setting.
   - "neutral": it does not show enough of its surroundings to tell (a tight close-up), or no implied setting
     is given.
   setting_reason: a few words on what in the clip fits or contradicts the setting.
5. score: 0-10 for this line in this video, based on seen, depicts and setting_fit, not on what the clip might
   stand for. 9-10 = depicts yes and exactly right here; 7-8 = depicts yes, clearly works; 5-6 = depicts
   partly, usable but not ideal; 0-4 = depicts no or setting_fit contradicts (3 or lower when the picture is
   too unclear to tell).
6. fit_reason: one short sentence on why what you described in seen does or does not show line_shows.

Return JSON:
- line_shows, seen, depicts, setting_fit, setting_reason, score, fit_reason: as above (in that order).
- visible: one sentence describing what is actually shown.
- main_subject, action: the main subject and what it is doing.
- matches: true when depicts is "yes", setting_fit is not "contradicts", score >= 7 and the clip is readable (not too dark or blurry to see what
  it shows, no dominating text, logos or watermarks).
- subject_visible: true if what the viewer must recognise is clearly visible.
- in_s, out_s: the best continuous window in which line_shows is visible, preferably >= {need_s:.1f} s;
  0 <= in_s < out_s <= {clip_s:.1f}.
- issues: shaky, blurry, text overlay, cut inside clip, or "".
- style: live_action, animation, 3d_render, motion_graphics, clip_art, or screen_recording.
- lighting: 0-10 how readable the subject is (information only).
- framing: 2-5 words, shot size + subject.
- time_of_day: day, night, dusk_dawn, or indoor (information only).
{style_rule}"""

# Step 1 and the first return line of PROMPT when the line's line_shows is given (fixed per line).
_STEP1_FREE = """1. line_shows: in a few plain words, what a viewer should SEE on screen for what THIS line means (read inside
   its sentence): the action the line asks for or describes, or its result - not just the words it mentions.
   When the line advises stopping, avoiding or reducing something, line_shows is the advised action or its
   result, not the thing to stop.
"""
FIXED_MARKER = "line_shows is given above and is FIXED for this line"
_STEP1_FIXED = """1. """ + FIXED_MARKER + """: the same for every clip checked for this line.
   Judge against it exactly as written. Never restate, widen, narrow or reinterpret it to fit what this clip
   shows, and do not output it.
"""
_RETURN_FREE = "- line_shows, seen, depicts, setting_fit, setting_reason, score, fit_reason: as above (in that order)."
_RETURN_FIXED = "- seen, depicts, setting_fit, setting_reason, score, fit_reason: as above (in that order)."


def prompt_template(fixed: bool) -> str:
    """PROMPT with line_shows fixed (given by the web, judged against) or, for old payloads, written by the checker."""
    if not fixed:
        return PROMPT
    return PROMPT.replace(_STEP1_FREE, _STEP1_FIXED).replace(_RETURN_FREE, _RETURN_FIXED)


# The video context the checker reads before judging: its own-words understanding of the video (script-context
# pass), the whole script, the neighbouring lines, this line's moment and what the viewer must recognise.
SCRIPT_BLOCK = """What this video is about: {video_understanding}
Whole script (this shot is line {line_no}):
{script}
Previous line: "{prev}"
This line (spoken over this shot): "{narration}"
{sentence_line}Next line: "{next}"
What this moment means in the video (context only): "{moment}"
What the viewer must recognise: "{must_recognise}"
{setting_line}{search_line}{idea_line}"""


# The score can never be higher than the literal-depiction judgement allows: a clip that does not show the
# line is a miss however well it could be argued (snow sc_5 IV bags for medicines at home: 7; sleep sc_13
# candlelit reading for "make the bedroom dark": 8). Same numbers as the web's DEPICTS_CAP.
DEPICTS_CAP = {"yes": 10, "partly": 6, "no": 4}

# A clip whose visible setting contradicts the moment's implied setting (time of day, indoor/outdoor, place, mood
# from the topic and the lines around it) never reaches the 5/10 filler floor, even when the literal subject
# matches (sleep: a daytime woods walk under "get out of bed and do a quiet activity"). The fit is the model's
# call; code only applies the cap. Same number as the web's SETTING_CAP.
SETTING_CAP = 4


def norm_setting_fit(v: Any) -> str:
    """fits / neutral / contradicts. Anything else (or missing) is neutral: depicts still gates the clip."""
    w = (re.sub(r"[^a-z]+", " ", str(v or "").lower()).split() or [""])[0]
    if w in ("contradicts", "contradict", "conflicts", "wrong", "no"):
        return "contradicts"
    if w in ("fits", "fit", "yes", "matches"):
        return "fits"
    return "neutral"


def apply_setting_cap(entry: dict) -> bool:
    """Cap the score and drop `matches` when the setting contradicts. True when it capped anything."""
    if entry.get("settingFit") != "contradicts":
        return False
    entry["matches"] = False
    if entry.get("score", 0) > SETTING_CAP:
        entry["score"] = SETTING_CAP
        return True
    return False


# Spellings of the three answers (case and punctuation are ignored). Anything else is unknown.
_DEPICTS_WORDS = {
    "yes": "yes", "y": "yes", "true": "yes",
    "partly": "partly", "partially": "partly", "partial": "partly", "part": "partly", "somewhat": "partly",
    "no": "no", "n": "no", "false": "no", "not": "no", "none": "no",
}


def depicts_word(v: Any) -> str | None:
    """'Partially.', 'No.', ' YES ' -> partly / no / yes; None when it is none of them (or empty)."""
    words = re.sub(r"[^a-z]+", " ", str(v or "").lower()).split()
    return _DEPICTS_WORDS.get(words[0]) if words else None


def norm_depicts(v: Any) -> str:
    """yes / partly / no. An unknown or missing answer fails closed: 'no' (score capped at 4)."""
    return depicts_word(v) or "no"


def depicts_rank(e: dict) -> int:
    """Selection order before the score: yes > not judged (older answers) > partly > no (same as the web)."""
    return {"yes": 3, "partly": 1, "no": 0}.get(str(e.get("depicts") or ""), 2)


def capped_score(v: dict) -> tuple[int, int, str]:
    """(score, rawScore, depicts): the model's score capped by its own depicts call. An unknown or missing
    depicts answer counts as "no" (fail closed) and is logged."""
    try:
        raw = max(0, min(10, int(round(float(v.get("score") or 0)))))
    except (TypeError, ValueError):
        raw = 0
    if depicts_word(v.get("depicts")) is None:
        print("[t2v:verify:depicts_unknown]", json.dumps({"depicts": str(v.get("depicts"))[:40], "rawScore": raw, "treatedAs": "no"}), flush=True)
    d = norm_depicts(v.get("depicts"))
    return min(raw, DEPICTS_CAP[d]), raw, d


# ---- Blind describe, then score (NEW 1) -------------------------------------------------------------------
# Step A: the describe test's prompt (describe_test.py), word for word, with NO line or script context, plus one
# generic sentence so the description also records the style and production artifacts step B needs. The describe
# test (t2v/describe_test/results.md) showed the LOW feed sees fine with this prompt: the known misreads came from
# the line biasing `seen`, not from resolution.
DESCRIBE_PROMPT = (
    "Describe exactly what happens in this clip, second by second: who/what is visible, what they do, "
    "the direction of any motion, colours, lighting, indoor/outdoor, time of day."
)
# Pass 1 is returned as timestamped events, never a whole-clip summary: pass 2 must be able to see WHEN something
# happens (an action that starts at second 7 cannot be placed from a summary).
DESCRIBE_EXTRA = (
    "\nReturn JSON. events: consecutive short intervals that together cover the whole clip from 0 to its end, "
    "each 1-3 seconds (start a new one whenever what is visible or happening changes), each with t_start and "
    "t_end in seconds, visible (who/what is in shot), action (what they do; 'nothing' if still), motion "
    "(direction of any movement of subjects or camera, or 'none') and lighting (brightness and colour, and "
    "whether it is too dark or blurry to see). Also: setting (indoor or outdoor, the kind of place, and the time "
    "of day as far as the picture shows it: daylight, night, dusk/dawn, or 'cannot tell'), style (live-action "
    "camera footage, animation, 3D render or "
    "graphics) and notes (any on-screen text or watermark, green or blue screen, studio lights or film "
    "equipment in shot, frozen frames; '' if none)."
)
DESCRIBE_PHOTO_PROMPT = (
    "Describe exactly what is in this photo: who/what is visible, what they are doing, colours, lighting, "
    "indoor/outdoor, time of day.\nReturn JSON with one event (t_start 0, t_end 0) holding visible, action, "
    "motion ('none') and lighting. Also: setting (indoor or outdoor, the kind of place, and the time of day as "
    "far as the picture shows it: daylight, night, dusk/dawn, or 'cannot tell'), style (real camera "
    "photograph, illustration, 3D render, or a cut-out on "
    "a plain or transparent background) and notes (any on-screen text or watermark, green or blue screen, studio "
    "lights or equipment, stretched, smeared or distorted areas; '' if none)."
)
OBSERVE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "events": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "t_start": {"type": "NUMBER"}, "t_end": {"type": "NUMBER"}, "visible": {"type": "STRING"},
                    "action": {"type": "STRING"}, "motion": {"type": "STRING"}, "lighting": {"type": "STRING"},
                },
                "required": ["t_start", "t_end", "visible", "action", "motion", "lighting"],
                "propertyOrdering": ["t_start", "t_end", "visible", "action", "motion", "lighting"],
            },
        },
        "setting": {"type": "STRING"},
        "style": {"type": "STRING"},
        "notes": {"type": "STRING"},
    },
    "required": ["events", "setting", "style", "notes"],
    "propertyOrdering": ["events", "setting", "style", "notes"],
}


def norm_observation(obs: Any, clip_s: float) -> dict:
    """Pass 1 output, cleaned: events sorted, clamped to the clip, at least one event. Locked from here on."""
    obs = obs if isinstance(obs, dict) else {}
    events: list[dict] = []
    for e in obs.get("events") or []:
        if not isinstance(e, dict):
            continue
        try:
            t0, t1 = float(e.get("t_start") or 0), float(e.get("t_end") or 0)
        except (TypeError, ValueError):
            continue
        t0 = max(0.0, min(t0, clip_s))
        t1 = max(t0, min(t1, clip_s))
        events.append({"t_start": round(t0, 2), "t_end": round(t1, 2),
                       **{k: str(e.get(k) or "")[:200] for k in ("visible", "action", "motion", "lighting")}})
    events.sort(key=lambda e: e["t_start"])
    if events:
        events[-1]["t_end"] = max(events[-1]["t_end"], round(clip_s, 2)) if clip_s else events[-1]["t_end"]
    return {"events": events, "setting": str(obs.get("setting") or "")[:200],
            "style": str(obs.get("style") or "")[:120], "notes": str(obs.get("notes") or "")[:300]}


def event_line(e: dict) -> str:
    return (f"[{e['t_start']:.1f}-{e['t_end']:.1f} s] visible: {e.get('visible', '')}; action: {e.get('action', '')}; "
            f"motion: {e.get('motion', '')}; lighting: {e.get('lighting', '')}")


def observation_text(obs: dict) -> str:
    lines = [event_line(e) for e in obs.get("events") or []]
    if obs.get("setting"):
        lines.append(f"setting: {obs['setting']}")
    lines.append(f"style: {obs.get('style') or '(not said)'}")
    lines.append(f"notes: {obs.get('notes') or '(none)'}")
    return "\n".join(lines)


def events_in(obs: dict, a: float, b: float) -> list[dict]:
    """The observed events that overlap [a, b] (what depicts and the score must be judged on)."""
    return [e for e in obs.get("events") or [] if e["t_end"] > a + 0.05 and e["t_start"] < b - 0.05]


REJUDGE_TOL_S = 0.5


def needs_rejudge(obs: dict, judged: tuple[float, float], played: tuple[float, float]) -> bool:
    """The played slice reaches observed events outside pass 2's window (it was shorter than the shot): those
    frames were never judged, so pass 2 re-judges the slice. A slice inside the window (every event in it was
    judged as showing the line) needs no new call."""
    inside = {id(e) for e in events_in(obs, *judged)}
    a, b = judged
    for e in events_in(obs, *played):
        if id(e) in inside:
            continue
        # Seconds of this unjudged event that would play: a sliver under REJUDGE_TOL_S is not worth a call.
        if min(played[1], e["t_end"]) - max(played[0], e["t_start"]) >= REJUDGE_TOL_S:
            return True
    return False


def snap_to_events(obs: dict, a: float, b: float, clip_s: float) -> tuple[float, float]:
    """Pass 2's window snapped outward to the observed event boundaries it touches (it picks FROM them)."""
    inside = events_in(obs, a, b)
    if not inside:
        return a, b
    return round(max(0.0, inside[0]["t_start"]), 2), round(min(clip_s, inside[-1]["t_end"]), 2)


# Step B: text only. The scorer never sees the clip, so it cannot read the line into it; it judges what the
# blind reviewer wrote. Same rubric and caps as the video prompt, plus the window and the artifacts field.
SCORE_PROMPT = """You are the footage checker for an automatic stock-footage video editor.
Another reviewer watched ONE short stock {media} (frames only, no audio) WITHOUT knowing what it was for and
wrote down what it shows as timestamped events. That observation is LOCKED: you do not see the {media}, you
cannot change or add to the observation, and you judge ONLY from it. Never assume anything it does not say,
and never judge from what the {media} might stand for.

{script_block}{media_cap} length: {clip_s:.1f} s. The shot needs about {need_s:.1f} s.

Locked observation of the {media} (written before anyone knew this line):
\"\"\"{description}\"\"\"

The whole script and the moment are context: they tell you what the video is about and what a viewer of it
expects to see. They never make a clip fit THIS line: a clip that would suit another line of the script, the
topic or the theme in general, but does not show THIS line, is a miss here. If this line is only part of a
sentence, read it as that whole sentence. If the line warns against doing something, a clip that shows that act
being done does not work.

Work in steps, in this order.
1. """ + FIXED_MARKER + """: the same for every clip checked for this line.
   Judge against it exactly as written. Never restate, widen, narrow or reinterpret it, and do not output it.
2. in_s, out_s: {window_rule}
3. seen: one or two plain sentences: what the observed events INSIDE that window show (people, things,
   actions; say so when they call the picture too dark, small or unclear). Only events inside the window count;
   what happens before in_s or after out_s is never part of this shot.
4. depicts: do the events inside that window show line_shows, so a viewer watching this video gets it at once?
   - "yes": it plainly shows line_shows (the same thing or action, from any angle or in any everyday situation),
     and it would not look out of place to a viewer of this video.
   - "partly": it shows only part of line_shows, or shows it in a way or setting a viewer would find odd.
   - "no": it shows something else - a related object or activity, the same category, a symbol, a mood, a
     metaphor, the result or a step only an argument connects, the habit or act the line advises against, or
     the description is too vague or the picture too unclear to tell.
   If an intended shot is given above, "yes" also needs the clip to show that intended shot (something merely
   similar is "partly" at most).
5. setting_fit: the implied setting given above (time of day, indoor/outdoor, kind of place, mood) is what a
   viewer of THIS video expects at this moment, read from its topic and the lines around it. Compare it with
   what the observation (its events and its setting line) shows:
   - "contradicts": it visibly shows a different time of day (bright daylight for a night moment, night for a
     day one), the other side of indoor/outdoor, a clearly different kind of place, or a mood that clashes
     with the line in this video - even when the literal subject or action matches line_shows.
   - "fits": its visible time of day, place and mood match the implied setting.
   - "neutral": it does not show enough of its surroundings to tell (a tight close-up), or no implied setting
     is given.
   setting_reason: a few words on what in the observation (its events and its setting line) fits or contradicts the setting.
6. artifacts: what the observation reports inside that window (or in its notes): "production" (green or blue screen, studio
   lights, stands, crew or set equipment in shot), "stretched" (stretched, squashed, smeared or distorted
   picture), "frozen" (frozen or still frames in a video), "dark" (near-black or too dark to see), else "none".
7. score: 0-10 for this line in this video, for that window only, based on seen, depicts and setting_fit, not
   on what the clip might stand for.
   9-10 = depicts yes and exactly right here; 7-8 = depicts yes, clearly works; 5-6 = depicts partly, usable
   but not ideal; 0-4 = depicts no or setting_fit contradicts (3 or lower when the picture is too unclear).
8. fit_reason: one short sentence on why what was seen does or does not show line_shows.

Return JSON:
- in_s, out_s, seen, depicts, setting_fit, setting_reason, artifacts, score, fit_reason: as above (in that order).
- visible: one sentence describing what is shown in the window.
- main_subject, action: the main subject and what it is doing.
- matches: true when depicts is "yes", setting_fit is not "contradicts", score >= 7, artifacts is "none" and
  the window is readable.
- subject_visible: true if what the viewer must recognise is clearly visible.
- issues: shaky, blurry, text overlay, cut inside clip, or "".
- style: from the observation: live_action (real camera footage or photo), animation, 3d_render,
  motion_graphics, clip_art (illustration, cut-out or vector art) or screen_recording.
- lighting: 0-10 how readable the subject is (information only).
- framing: 2-5 words, shot size + subject.
- time_of_day: day, night, dusk_dawn, or indoor (information only).
{style_rule}"""

WINDOW_RULE_VIDEO = """pick the window FROM the observed events' timestamps: the continuous run of events in
   which line_shows is plainly visible and readable, preferably >= {need_s:.1f} s. Leave out events the
   observation calls too dark, black, blurry or frozen, or that show something else. in_s is the t_start of the
   first event you keep and out_s the t_end of the last; 0 <= in_s < out_s <= {clip_s:.1f}."""
# Re-judge (the slice the edit will play differs from the window pass 2 picked): the window is given.
WINDOW_RULE_FIXED = """the window is FIXED: in_s = {a:.1f}, out_s = {b:.1f} (the exact slice the edit plays).
   Return those two numbers and judge only the events that overlap it."""
WINDOW_RULE_PHOTO = "a still photo: return 0 and {need_s:.1f}."

SCORE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "in_s": {"type": "NUMBER"},
        "out_s": {"type": "NUMBER"},
        "seen": {"type": "STRING"},
        "depicts": {"type": "STRING", "enum": ["yes", "partly", "no"]},
        "setting_fit": VERIFY_SCHEMA["properties"]["setting_fit"],
        "setting_reason": {"type": "STRING"},
        "artifacts": {"type": "STRING", "enum": ["none", "production", "stretched", "frozen", "dark"]},
        "score": {"type": "INTEGER"},
        "fit_reason": {"type": "STRING"},
        "visible": {"type": "STRING"},
        "main_subject": {"type": "STRING"},
        "action": {"type": "STRING"},
        "matches": {"type": "BOOLEAN"},
        "subject_visible": {"type": "BOOLEAN"},
        "issues": {"type": "STRING"},
        "style": VERIFY_SCHEMA["properties"]["style"],
        "lighting": {"type": "INTEGER"},
        "framing": {"type": "STRING"},
        "time_of_day": VERIFY_SCHEMA["properties"]["time_of_day"],
    },
    "required": ["in_s", "out_s", "seen", "depicts", "setting_fit", "setting_reason", "artifacts", "score", "fit_reason", "visible", "main_subject",
                 "action", "matches", "subject_visible", "style", "lighting", "framing", "time_of_day"],
    "propertyOrdering": ["in_s", "out_s", "seen", "depicts", "setting_fit", "setting_reason", "artifacts", "score", "fit_reason", "visible",
                         "main_subject", "action", "matches", "subject_visible", "issues", "style", "lighting",
                         "framing", "time_of_day"],
}

# A production artifact caps the score whatever the line (generic, never a topic rule). `cutout` is set in code
# for a photo with a transparent background (it renders with smeared edge pixels: snow #1194 L5 img_966334).
ARTIFACT_CAP = {"production": 3, "dark": 3, "stretched": 4, "cutout": 4, "frozen": 6}
ARTIFACTS = ("none", "production", "stretched", "frozen", "dark", "cutout")
# Backstop: the blind description names a production artifact but the scorer said "none" (generic words only).
_PRODUCTION_WORDS = re.compile(
    r"\b(green[- ]screen|blue[- ]screen|chroma[- ]?key|studio (?:light|lights|lighting|equipment)|light stands?|"
    r"softbox(?:es)?|film crew|camera crew|clapperboard|boom mic)\b",
    re.I,
)


def norm_artifacts(v: Any, description: str = "") -> str:
    a = str(v or "none").strip().lower()
    a = a if a in ARTIFACTS else "none"
    if a == "none" and description and _PRODUCTION_WORDS.search(description):
        return "production"
    return a


def apply_artifact_cap(entry: dict) -> None:
    """Cap the score and drop `matches` for a clip with a production artifact (logged by the caller)."""
    cap = ARTIFACT_CAP.get(str(entry.get("artifacts") or "none"))
    if cap is None:
        return
    entry["matches"] = False
    if entry.get("score", 0) > cap:
        entry["score"] = cap


def play_window(a: float, b: float, clip_s: float, need_s: float) -> tuple[float, float]:
    """The slice the edit plays for a judged window [a, b]: `need_s` seconds CENTRED in the window (a long window
    used to play from its start: 2339's 0-35 s window played 0-3.3 s, 144635's 0-5 s window played the near-black
    first 2.4 s), grown around the centre when the window is shorter than the need, kept inside the clip, never
    snapped back to 0. Same rule as the web's t2vPlayStart (finisher)."""
    clip_s = max(0.0, float(clip_s or 0))
    need = max(0.1, float(need_s or 0))
    if clip_s <= need:
        return 0.0, round(clip_s, 2)
    mid = (float(a) + float(b)) / 2
    start = min(max(0.0, mid - need / 2), clip_s - need)
    return round(start, 2), round(start + need, 2)


# The slice the edit plays: the planned need plus a margin for the spoken line running longer than its estimate
# (assembly plays voice + pad), so the rendered slice stays inside the verified window.
PLAY_MARGIN_S = 0.3
PLAY_MARGIN_FRAC = 0.1


def play_need(need_s: float) -> float:
    return round(float(need_s or 0) * (1 + PLAY_MARGIN_FRAC) + PLAY_MARGIN_S, 2)


def _loads(text: str) -> Any:
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        # A plain-text description (never written by this version) becomes one event over the clip.
        return {"events": [{"t_start": 0, "t_end": 0, "visible": str(text)[:200], "action": "", "motion": "", "lighting": ""}]}


# Frozen segments inside a clip (V4): frame-to-frame mean luma difference (0-255, 64x36 grey at 4 fps) below
# FROZEN_DIFF for at least FROZEN_MIN_S. Real duplicated frames sit near 0; slow but moving footage (steam,
# drifting aerials) stays above ~0.2 on the shrunk preview (describe-test clips).
FROZEN_DIFF = 0.1
FROZEN_MIN_S = 1.0
FROZEN_FPS = 4


def frozen_spans_from_diffs(diffs: list[float], fps: int = FROZEN_FPS) -> list[tuple[float, float]]:
    spans: list[tuple[float, float]] = []
    start = None
    for k, d in enumerate(list(diffs) + [999.0]):
        if d < FROZEN_DIFF:
            start = k if start is None else start
            continue
        if start is not None and (k - start) / fps >= FROZEN_MIN_S:
            spans.append((round(start / fps, 2), round(k / fps, 2)))
        start = None
    return spans


def _frozen_spans(video: Path) -> list[tuple[float, float]]:
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(video), "-vf", f"fps={FROZEN_FPS},scale=64:36:flags=area,format=gray",
         "-f", "rawvideo", "-"],
        capture_output=True,
    )
    n = 64 * 36
    px = proc.stdout
    if proc.returncode != 0 or len(px) < 2 * n:
        return []
    fr = [px[k:k + n] for k in range(0, len(px) - n + 1, n)]
    diffs = [sum(abs(x - y) for x, y in zip(fr[i], fr[i + 1])) / n for i in range(len(fr) - 1)]
    return frozen_spans_from_diffs(diffs)


def frozen_overlap(spans: list[tuple[float, float]], a: float, b: float) -> float:
    return round(sum(max(0.0, min(b, e) - max(a, s)) for s, e in spans), 2)


# A photo with a transparent background (cut-out PNG): its hidden edge pixels show as smeared or stretched
# edges once the alpha is dropped. Share of pixels under half opacity, 64x36.
CUTOUT_MIN_FRAC = 0.02


def _alpha_fraction(src: Path) -> float:
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(src), "-vf", "format=rgba,alphaextract,scale=64:36,format=gray",
         "-frames:v", "1", "-f", "rawvideo", "-"],
        capture_output=True,
    )
    px = proc.stdout
    if proc.returncode != 0 or not px:
        return 0.0
    return round(sum(1 for b in px if b < 128) / len(px), 3)


def _rendition(c: dict) -> str:
    m = re.search(r"_(tiny|small|medium|large|\d{3,4})\.(mp4|webm|jpg|jpeg|png|webp)\b", str(c.get("previewUrl") or ""), re.I)
    return (m.group(1).lower() if m else "preview")


def describe_key(c: dict) -> tuple[str, str, str] | None:
    """Cache key: provider + providerId + rendition (+ feed and prompt version). AI clips are never cached (they are
    the workspace's own generations, not public stock)."""
    if c.get("kind") == "ai" or str(c.get("provider") or "pixabay") == "replicate" or not c.get("providerId"):
        return None
    kind = "photo" if c.get("kind") == "photo" else "video"
    return (str(c.get("provider") or "pixabay"), str(c.get("providerId")), f"{kind}:{_rendition(c)}:{DESCRIBE_FEED}:{DESCRIBE_VERSION}")


def _cache_get(conn, keys: list[tuple[str, str, str]]) -> dict[tuple[str, str, str], str]:
    """Cached blind descriptions for these keys. A missing table (migration not applied) just means no cache."""
    out: dict[tuple[str, str, str], str] = {}
    if not keys:
        return out
    try:
        with conn.cursor() as cur:
            for k in range(0, len(keys), 200):
                chunk = keys[k:k + 200]
                cur.execute(
                    'SELECT provider, "providerId", rendition, description FROM t2v_clip_descriptions '
                    "WHERE (provider, \"providerId\", rendition) IN (" + ",".join(["(%s,%s,%s)"] * len(chunk)) + ")",
                    [x for key in chunk for x in key],
                )
                for prov, pid, rend, desc in cur.fetchall() or []:
                    out[(prov, pid, rend)] = desc
        conn.commit()
    except Exception as exc:  # noqa: BLE001 — the cache is an optimisation
        log.warning("[t2v:verify:describe_cache] read failed: %s", str(exc)[:200])
        conn.rollback()
    return out


def _cache_put(conn, key: tuple[str, str, str], description: str, model: str, tin: int, tout: int) -> None:
    try:
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO t2v_clip_descriptions (provider, "providerId", rendition, model, description, '
                '"promptTokens", "outputTokens") VALUES (%s,%s,%s,%s,%s,%s,%s) '
                'ON CONFLICT (provider, "providerId", rendition) DO NOTHING',
                (*key, model, description, tin, tout),
            )
        conn.commit()
    except Exception as exc:  # noqa: BLE001
        log.warning("[t2v:verify:describe_cache] write failed: %s", str(exc)[:200])
        conn.rollback()


def score_prompt(*, description: str, is_photo: bool, clip_s: float, need_s: float, block: str, style_rule: str,
                 fixed_window: tuple[float, float] | None = None) -> str:
    media = "photo" if is_photo else "clip"
    if fixed_window and not is_photo:
        rule = WINDOW_RULE_FIXED.format(a=fixed_window[0], b=fixed_window[1])
    else:
        rule = (WINDOW_RULE_PHOTO if is_photo else WINDOW_RULE_VIDEO).format(need_s=need_s, clip_s=clip_s)
    return SCORE_PROMPT.format(
        media=media, media_cap=media.capitalize(),
        script_block=block, clip_s=clip_s, need_s=need_s, description=description.replace('"""', "'''")[:4000],
        window_rule=rule, style_rule=style_rule,
    )


def _idea_line(shot: dict, q) -> str:
    """Reimagine candidates: the shot idea that found them (the clip must show the line AND this shot)."""
    idea = q(shot.get("idea"), 300)
    return f'Intended shot (this clip was found for it): "{idea}"\n' if idea else ""


def _setting_line(shot: dict, q) -> str:
    """The setting this moment implies (web script-context pass: topic + neighbouring lines), '' when unknown."""
    setting = q(shot.get("setting"), 240)
    return f'Implied setting of this moment (from the video and the lines around it): "{setting}"\n' if setting else ""


def _sentence_line(shot: dict, q) -> str:
    """Split scenes: the full sentence this piece belongs to (the piece alone reads like a keyword list)."""
    full = q(shot.get("sentence"), 600)
    if not full or " ".join(full.lower().split()) == " ".join(q(shot.get("narration"), 600).lower().split()):
        return ""
    return f'This line is part of the sentence: "{full}"\n'


def script_block(script: str, shot: dict, video_understanding: str = "", topic: str = "") -> str:
    """The context block of the prompt. Older payloads without a script still get the line, intent and subject."""
    q = lambda v, n=300: str(v or "").replace('"', "'").replace("\n", " ")[:n]  # noqa: E731
    text = str(script or "").strip()
    return SCRIPT_BLOCK.format(
        video_understanding=(f"{q(topic, 200)}. " if topic and video_understanding else "") + (q(video_understanding, 1200) or q(topic, 200) or "(not given)"),
        line_no=shot.get("lineNo") or "?",
        script=text[:8000] if text else "(not given)",
        prev=q(shot.get("prevNarration")) or "(start of video)",
        narration=q(shot.get("narration"), 600),
        next=q(shot.get("nextNarration")) or "(end of video)",
        sentence_line=_sentence_line(shot, q),
        moment=q(shot.get("moment") or shot.get("intent")),
        must_recognise=q(shot.get("subject") or shot.get("intent"), 120),
        idea_line=_idea_line(shot, q),
        setting_line=_setting_line(shot, q),
        search_line=(f'line_shows - what a viewer should SEE for this line (fixed for every clip of this line): "{q(shot.get("lineShows"), 200)}"\n' if shot.get("lineShows") else ""),
    )


def _log_scene(job_id: Any, draft_id: Any, idx: int, shot: dict, chosen: dict | None, ev: list[dict]) -> None:
    """Per-scene log (no URLs): every candidate with score, verdict and reason, plus the top-K."""
    for e in ev:
        picked = bool(chosen and e.get("providerId") == chosen.get("providerId"))
        print("[t2v:verify:candidate]", json.dumps({
            "jobId": job_id, "draftId": draft_id, "sceneIndex": shot.get("lineNo", idx), "sceneId": shot.get("sceneId"),
            "candidateId": e.get("providerId"), "kind": e.get("kind") or "video", "score": e.get("score"),
            "lighting": e.get("lighting"), "matches": e.get("matches"), "verdict": "chosen" if picked else "not_chosen",
            "lineShows": e.get("lineShows") or "", "seen": e.get("seen") or "", "depicts": e.get("depicts"),
            "rawScore": e.get("rawScore"), "reason": e.get("error") or e.get("fitReason") or "",
            # QA/VQ: the verified playback window (depicts/score are on it), pass 2's window, the observed events
            # inside the verified window and any artifact.
            "window": [e.get("inS"), e.get("outS")], "judgedWindow": [e.get("judgedInS"), e.get("judgedOutS")],
            "windowEvents": e.get("windowEvents") or [], "artifacts": e.get("artifacts"), "blind": bool(e.get("blind")),
            "rejudged": bool(e.get("rejudged")),
        }), flush=True)
    print("[t2v:verify:scene]", json.dumps({
        "jobId": job_id, "draftId": draft_id, "sceneIndex": shot.get("lineNo", idx), "sceneId": shot.get("sceneId"),
        "candidates": len(ev), "candidateId": chosen.get("providerId") if chosen else None,
        "score": chosen.get("score") if chosen else None, "verdict": chosen.get("verdict") if chosen else "none",
        "topK": [
            {"candidateId": e.get("providerId"), "score": e.get("score"), "lighting": e.get("lighting")}
            for e in sorted((e for e in ev if not e.get("error")), key=lambda e: (-int(e.get("score", 0)), -int(e.get("lighting", 5))))[:5]
        ],
    }), flush=True)


def _payload(job: dict) -> dict:
    p = job.get("payload") or {}
    if isinstance(p, str):
        p = json.loads(p)
    return p


def _host_allowed(url: str) -> bool:
    try:
        u = urllib.parse.urlparse(url)
    except ValueError:
        return False
    if u.scheme != "https":
        return False
    h = (u.hostname or "").lower()
    return any(h == s or h.endswith("." + s) for s in ALLOWED_HOST_SUFFIXES)


def _download(url: str, dest: Path) -> None:
    if not _host_allowed(url):
        raise RuntimeError("preview_host_not_allowed")
    req = urllib.request.Request(url, headers={"User-Agent": "transovo-t2v-verify/1"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read(MAX_PREVIEW_BYTES + 1)
    if len(data) > MAX_PREVIEW_BYTES:
        raise RuntimeError("preview_too_large")
    if len(data) < 1024:
        raise RuntimeError("preview_empty")
    dest.write_bytes(data)


def _mute_and_shrink(src: Path, dest: Path) -> None:
    """Drop audio, downscale to 360p, cap at 40 s — Gemini only sees frames."""
    proc = subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(src), "-t", "40", "-an",
            "-vf", "scale=-2:360,fps=4", "-c:v", "libx264", "-preset", "veryfast", "-crf", "32",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dest),
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg_mute_failed: {proc.stderr[-300:]}")


def _dhash_frames(video: Path, in_s: float, out_s: float) -> list[str]:
    """64-bit dHash of 3 frames inside the chosen window (25/50/75%). Cheap near-duplicate signal."""
    hashes: list[str] = []
    span = max(0.1, out_s - in_s)
    for frac in (0.25, 0.5, 0.75):
        t = in_s + span * frac
        seek = [] if video.suffix.lower() in (".jpg", ".jpeg", ".png") else ["-ss", f"{t:.2f}"]
        proc = subprocess.run(
            ["ffmpeg", "-v", "error", *seek, "-i", str(video), "-frames:v", "1",
             "-vf", "scale=9:8:flags=area,format=gray", "-f", "rawvideo", "-"],
            capture_output=True,
        )
        px = proc.stdout
        if proc.returncode != 0 or len(px) < 72:
            continue
        bits = 0
        for row in range(8):
            for col in range(8):
                bits = (bits << 1) | (1 if px[row * 9 + col] > px[row * 9 + col + 1] else 0)
        hashes.append(f"{bits:016x}")
    return hashes


# Motion check on the low-res preview already downloaded (no paid call): a video whose window is a frozen
# frame plays as a still (sleep sh3 / sh19). Mean absolute luma difference (0-255) of small grey frames
# against the first frame; below STATIC_DIFF the window is static.
STATIC_DIFF = 1.5
STATIC_MAX_SCORE = 6
MOTION_FRAMES = 6


def _motion(video: Path, in_s: float, out_s: float) -> float | None:
    span = max(0.2, out_s - in_s)
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{in_s:.2f}", "-t", f"{span:.2f}", "-i", str(video),
         "-vf", f"fps={MOTION_FRAMES / span:.4f},scale=32:18:flags=area,format=gray", "-f", "rawvideo", "-"],
        capture_output=True,
    )
    n = 32 * 18
    px = proc.stdout
    if proc.returncode != 0 or len(px) < 2 * n:
        return None
    frames = [px[k:k + n] for k in range(0, len(px) - n + 1, n)]
    first = frames[0]
    return round(max(sum(abs(a - b) for a, b in zip(first, f)) / n for f in frames[1:]), 2)


def near_duplicate(a: list[str], b: list[str]) -> bool:
    for x in a or []:
        for y in b or []:
            if bin(int(x, 16) ^ int(y, 16)).count("1") <= NEAR_DUP_BITS:
                return True
    return False


def _color_stats(video: Path, in_s: float, out_s: float) -> tuple[float, float] | None:
    """Mean HSV saturation and luma (0-1) of 3 tiny frames in the window: cheap B&W / darkness test."""
    sats: list[float] = []
    lums: list[float] = []
    span = max(0.1, out_s - in_s)
    for frac in (0.25, 0.5, 0.75):
        seek = [] if video.suffix.lower() in (".jpg", ".jpeg", ".png") else ["-ss", f"{in_s + span * frac:.2f}"]
        proc = subprocess.run(
            ["ffmpeg", "-v", "error", *seek, "-i", str(video), "-frames:v", "1",
             "-vf", "scale=32:18,format=rgb24", "-f", "rawvideo", "-"],
            capture_output=True,
        )
        px = proc.stdout
        if proc.returncode != 0 or len(px) < 32 * 18 * 3:
            continue
        for k in range(0, len(px) - 2, 3):
            r, g, b = px[k], px[k + 1], px[k + 2]
            mx, mn = max(r, g, b), min(r, g, b)
            sats.append((mx - mn) / mx if mx else 0.0)
            lums.append((0.299 * r + 0.587 * g + 0.114 * b) / 255)
    if not sats:
        return None
    return round(sum(sats) / len(sats), 3), round(sum(lums) / len(lums), 3)


class Ctx:
    """Per-shot edit-quality rule: live action only for realistic styles. Everything about whether a clip fits
    the line and the video is the model's in-context score."""

    def __init__(self, realistic: bool = True):
        self.realistic = realistic


def quality_ok(entry: dict, ctx: Ctx) -> bool:
    return not (ctx.realistic and entry.get("style", LIVE_ACTION) != LIVE_ACTION)


def _window_ok(entry: dict, need_s: float) -> bool:
    return (entry["outS"] - entry["inS"]) >= min(need_s, entry["clipS"]) - 0.05


def scarcity_order(shots: list[dict], evaluated_by_shot: list[list[dict]], realistic: bool = True) -> list[int]:
    """Shot indexes ordered by number of passing candidates, ascending; ties keep story order."""
    ctx = Ctx(realistic=realistic)

    def n_pass(i: int) -> int:
        need_s = float(shots[i].get("needS") or 4.0)
        return sum(1 for e in evaluated_by_shot[i] if passes(e, need_s, ctx))

    return sorted(range(len(shots)), key=lambda i: (n_pass(i), i))


def passes(entry: dict, need_s: float, ctx: Ctx) -> bool:
    if entry.get("error") or "score" not in entry:
        return False
    return bool(entry.get("matches")) and entry["score"] >= ACCEPT_SCORE and quality_ok(entry, ctx) and _window_ok(entry, need_s)


def usable(entry: dict, need_s: float, ctx: Ctx) -> bool:
    """Second tier: score 5-6 (works for the line, not perfect) with the same quality rules."""
    if entry.get("error") or "score" not in entry:
        return False
    return entry["score"] >= USABLE_SCORE and quality_ok(entry, ctx) and _window_ok(entry, need_s)


def fallback_rank(entry: dict, ctx: Ctx) -> float:
    """Best-available ordering: relevance first, then readability (tie-break); non-live clips for a realistic
    style come last."""
    s = float(entry.get("score", 0)) + 0.3 * float(entry.get("lighting", 5))
    if not quality_ok(entry, ctx):
        s -= 20
    return s


PHOTO_NOTE = """
THIS IS A STILL PHOTO, not a video clip. It will be shown with a slow zoom/pan under the line.
Judge it exactly like a clip. style: live_action means a real camera photograph;
illustration, vector art, 3D render, AI-generated imagery or clip art are NOT live_action.
For in_s/out_s return 0 and {need_s:.1f}."""


AI_NOTE = """
THIS CLIP IS AI-GENERATED (a test B-roll option). Judge it exactly like stock.
style: live_action only if it would pass as real camera footage next to stock clips; visible AI artefacts
(melting shapes, warped hands or objects, morphing, impossible physics, garbled text) mean style "3d_render" and score <= 4."""


def _shrink_photo(src: Path, dest: Path) -> None:
    """Re-encode the photo to a small JPEG (cheap Gemini input, strips metadata)."""
    proc = subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vf", "scale='min(640,iw)':-2", "-q:v", "4", str(dest)],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg_photo_failed: {proc.stderr[-300:]}")


def _probe_s(path: Path) -> float:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
            capture_output=True, text=True, check=True,
        ).stdout
        return float(json.loads(out)["format"]["duration"])
    except Exception:
        return 0.0


def _model() -> str:
    from clips_worker.gemini_vision import discover_video_picker_model

    return discover_video_picker_model().strip()


def _media_part(video: Path, mime: str) -> dict:
    return {
        "inlineData": {"mimeType": mime, "data": base64.b64encode(video.read_bytes()).decode("ascii")},
        **({"videoMetadata": {"fps": 1}} if mime.startswith("video/") else {}),
    }


def _gemini_post(model: str, parts: list[dict], gen: dict[str, Any]) -> tuple[str, int, int]:
    """One generateContent call: (text, promptTokens, outputTokens). One transient retry (429/5xx are not
    billed); no paid retry loops."""
    from clips_worker.gemini_vision import GEMINI_BASE, _key

    m = model.lower()
    if not (m.startswith("gemini-3.") or m.startswith("gemini-4.")):
        gen = {**gen, "temperature": 0}
    body = {"contents": [{"role": "user", "parts": parts}], "generationConfig": gen}
    url = f"{GEMINI_BASE}/models/{urllib.parse.quote(model)}:generateContent"
    last = ""
    for attempt in range(2):
        res = requests.post(url, params={"key": _key()}, json=body, timeout=90)
        if res.ok:
            data = res.json()
            text = "".join(str(x.get("text") or "") for x in data["candidates"][0]["content"]["parts"])
            u = data.get("usageMetadata") or {}
            return text, int(u.get("promptTokenCount") or 0), int(u.get("candidatesTokenCount") or 0)
        last = f"gemini_http_{res.status_code}"
        if res.status_code not in (429, 500, 502, 503, 504) or attempt:
            break
        time.sleep(3)
    raise RuntimeError(last)


def _gemini_watch(model: str, video: Path, prompt: str, mime: str = "video/mp4") -> tuple[dict, int, int]:
    """The combined watch-and-judge call (old payloads without lineShows, or T2V_BLIND_DESCRIBE=0)."""
    gen: dict[str, Any] = {
        "responseMimeType": "application/json",
        # The fixed-line_shows prompt gets the schema without line_shows (the checker never writes it).
        "responseSchema": VERIFY_SCHEMA_FIXED if FIXED_MARKER in prompt else VERIFY_SCHEMA,
        # seen + depicts + fit_reason + the window and info fields; 1100 risked truncated JSON (a wasted call).
        "maxOutputTokens": MAX_OUTPUT_TOKENS,
        "mediaResolution": "MEDIA_RESOLUTION_LOW",
    }
    text, tin, tout = _gemini_post(model, [_media_part(video, mime), {"text": prompt}], gen)
    return json.loads(text), tin, tout


def _gemini_describe(model: str, video: Path, mime: str = "video/mp4") -> tuple[str, int, int]:
    """Pass 1: the blind, timestamped observation (no narration, no expected action, no search terms) as a JSON
    string. Same feed as the describe test: the shrunk preview, fps=1, MEDIA_RESOLUTION_LOW."""
    prompt = DESCRIBE_PHOTO_PROMPT if mime.startswith("image/") else DESCRIBE_PROMPT + DESCRIBE_EXTRA
    gen: dict[str, Any] = {"responseMimeType": "application/json", "responseSchema": OBSERVE_SCHEMA,
                           "maxOutputTokens": DESCRIBE_MAX_TOKENS, "mediaResolution": "MEDIA_RESOLUTION_LOW"}
    text, tin, tout = _gemini_post(model, [_media_part(video, mime), {"text": prompt}], gen)
    obs = json.loads(text)
    if not (isinstance(obs, dict) and obs.get("events")):
        raise RuntimeError("describe_empty")
    return json.dumps(obs), tin, tout


def _gemini_score(model: str, prompt: str) -> tuple[dict, int, int]:
    """Step B: text only. Scores the blind description against the fixed lineShows and the script."""
    gen: dict[str, Any] = {"responseMimeType": "application/json", "responseSchema": SCORE_SCHEMA, "maxOutputTokens": MAX_OUTPUT_TOKENS}
    text, tin, tout = _gemini_post(model, [{"text": prompt}], gen)
    return json.loads(text), tin, tout


def _clamp_window(v: dict, clip_s: float, need_s: float) -> tuple[float, float]:
    try:
        a = float(v.get("in_s") or 0)
        b = float(v.get("out_s") or clip_s)
    except (TypeError, ValueError):
        a, b = 0.0, clip_s
    a = max(0.0, min(a, clip_s))
    b = max(a, min(b, clip_s))
    if b - a < 0.5:
        a, b = 0.0, clip_s
    # Grow a too-short window around its centre (still the same verified clip) so the shot
    # covers its narration without looping.
    if b - a < need_s and clip_s >= need_s:
        mid = (a + b) / 2
        a = max(0.0, mid - need_s / 2)
        b = a + need_s
        if b > clip_s:
            b = clip_s
            a = max(0.0, b - need_s)
    return round(a, 2), round(b, 2)


def run_t2v_verify_stock_job(conn, job: dict) -> dict:
    from clips_worker.gemini import _log_usage
    from clips_worker.internal_callback import post_internal

    p = _payload(job)
    draft_id = p.get("draftId")
    workspace_id = p.get("workspaceId")
    project_id = p.get("projectId")
    topic = str(p.get("topic") or "")[:200]
    shots = p.get("shots") or []
    script = str(p.get("script") or "")
    if not draft_id or not workspace_id:
        raise ValueError("T2V_VERIFY_STOCK payload requires draftId and workspaceId")
    model = _model()
    realistic = bool(p.get("realistic", True))
    video_understanding = str(p.get("videoUnderstanding") or "")
    style_rule = (
        "This video uses a realistic (documentary) style: only live_action footage can match; animation, "
        "3d_render, motion_graphics, clip_art and screen_recording must have matches=false."
        if realistic
        else ""
    )
    # Clips/visuals already used by earlier rounds of this run: never pick them (or look-alikes) again.
    used_ids: set[str] = {str(u.get("providerId")) for u in (p.get("used") or []) if u.get("providerId")}
    used_hashes: list[list[str]] = [list(u.get("phash") or []) for u in (p.get("used") or []) if u.get("phash")]
    lock = threading.Lock()
    usage = {"in": 0, "out": 0, "calls": 0, "describe": 0, "score": 0, "describeHits": 0}
    evaluated_by_shot: list[list[dict]] = [[] for _ in shots]
    # Blind descriptions already cached for these candidates (one read; the table is shared across runs).
    describe_cache: dict[tuple[str, str, str], str] = {}
    if BLIND_DESCRIBE:
        keys = sorted({k for sh in shots if str(sh.get("lineShows") or "").strip()
                       for c in (sh.get("candidates") or [])[:MAX_CANDIDATES_PER_SHOT] for k in [describe_key(c)] if k})
        describe_cache.update(_cache_get(conn, keys))

    def shot_ctx(shot: dict) -> Ctx:
        return Ctx(realistic=realistic)

    def verify_shot(idx: int, shot: dict, work: Path) -> None:
        need_s = float(shot.get("needS") or 4.0)
        # The line's fixed line_shows (same for every candidate and every round); None only for old payloads.
        fixed_ls = str(shot.get("lineShows") or "").strip()[:200] or None
        if fixed_ls is None:
            print("[t2v:verify:line_shows_missing]", json.dumps({"draftId": draft_id, "sceneId": shot.get("sceneId")}), flush=True)
        ctx = shot_ctx(shot)
        evaluated = evaluated_by_shot[idx]
        passing = 0
        for c in (shot.get("candidates") or [])[:MAX_CANDIDATES_PER_SHOT]:
            if str(c.get("providerId")) in used_ids:
                continue
            entry: dict[str, Any] = {
                "providerId": str(c.get("providerId")),
                "provider": c.get("provider", "pixabay"),
                "query": c.get("query"),
                "author": str(c.get("author") or "")[:80],
            }
            try:
                is_photo = c.get("kind") == "photo"
                if is_photo:
                    # Photo fallback: a still shown with a slow Ken Burns move; any window length works.
                    raw = work / f"s{idx}_{c.get('providerId')}.jpg"
                    muted = work / f"s{idx}_{c.get('providerId')}_m.jpg"
                    _download(str(c.get("previewUrl") or ""), raw)
                    _shrink_photo(raw, muted)
                    clip_s = max(need_s, 12.0)
                    entry["kind"] = "photo"
                else:
                    raw = work / f"s{idx}_{c.get('providerId')}.mp4"
                    muted = work / f"s{idx}_{c.get('providerId')}_m.mp4"
                    _download(str(c.get("previewUrl") or ""), raw)
                    _mute_and_shrink(raw, muted)
                    clip_s = float(c.get("durationS") or 0) or _probe_s(muted)
                    if c.get("kind") == "ai":
                        entry["kind"] = "ai"
                is_ai = c.get("kind") == "ai"
                blind = BLIND_DESCRIBE and fixed_ls is not None
                described = ""
                if blind:
                    if is_photo:
                        # A cut-out PNG (transparent background) renders with smeared edges (V4).
                        try:
                            if _alpha_fraction(raw) >= CUTOUT_MIN_FRAC:
                                entry["cutout"] = True
                        except Exception:  # noqa: BLE001 — a bonus signal
                            pass
                    # Step A: the blind description, once per unique clip (cache across lines, rounds, reruns).
                    key = describe_key(c)
                    with lock:
                        described = describe_cache.get(key) if key else None
                    if described:
                        with lock:
                            usage["describeHits"] += 1
                    else:
                        described, tin, tout = _gemini_describe(model, muted, "image/jpeg" if is_photo else "video/mp4")
                        with lock:
                            usage["in"] += tin
                            usage["out"] += tout
                            usage["calls"] += 1
                            usage["describe"] += 1
                            if key:
                                describe_cache[key] = described
                                _cache_put(conn, key, described, model, tin, tout)
                    # Pass 2: text only, on the LOCKED timestamped observation vs the FIXED lineShows and script.
                    obs = norm_observation(_loads(described), clip_s)
                    obs_text = observation_text(obs)
                    block = script_block(script, shot, video_understanding, topic)

                    def judge(fixed_window: tuple[float, float] | None = None) -> dict:
                        prompt = score_prompt(description=obs_text, is_photo=is_photo, clip_s=clip_s, need_s=need_s,
                                              block=block, style_rule=style_rule, fixed_window=fixed_window) + (AI_NOTE if is_ai else "")
                        out, tin2, tout2 = _gemini_score(model, prompt)
                        with lock:
                            usage["in"] += tin2
                            usage["out"] += tout2
                            usage["calls"] += 1
                            usage["score"] += 1
                        return out

                    v = judge()
                else:
                    prompt = (prompt_template(fixed_ls is not None) + (PHOTO_NOTE if is_photo else AI_NOTE if is_ai else "")).format(
                        clip_s=clip_s,
                        need_s=need_s,
                        script_block=script_block(script, shot, video_understanding, topic),
                        style_rule=style_rule,
                    )
                    v, tin, tout = _gemini_watch(model, muted, prompt, "image/jpeg" if is_photo else "video/mp4")
                    with lock:
                        usage["in"] += tin
                        usage["out"] += tout
                        usage["calls"] += 1
                # The window pass 2 picked (snapped to the observed events) and the slice the edit will play
                # (play_window: the needed length, centred in it, inside the clip). When that slice does not cover
                # exactly the same observed events, pass 2 re-judges the slice itself (text only), so depicts and
                # the score always describe the frames that play. inS/outS are that VERIFIED slice; the finisher
                # and assembly play it unchanged.
                if is_photo:
                    ja, jb = 0.0, clip_s
                    pa, pb = 0.0, clip_s
                else:
                    ja, jb = _clamp_window(v, clip_s, 0.0)
                    if blind:
                        ja, jb = snap_to_events(obs, ja, jb, clip_s)
                    pa, pb = play_window(ja, jb, clip_s, play_need(need_s))
                    if blind and needs_rejudge(obs, (ja, jb), (pa, pb)):
                        v2 = judge((pa, pb))
                        print("[t2v:verify:rejudge]", json.dumps({
                            "draftId": draft_id, "sceneId": shot.get("sceneId"), "candidateId": c.get("providerId"),
                            "judged": [ja, jb], "played": [pa, pb], "score": v.get("score"), "rescore": v2.get("score"),
                            "depicts": v.get("depicts"), "redepicts": v2.get("depicts"),
                        }), flush=True)
                        entry["rejudged"] = {"window": [ja, jb], "score": v.get("score"), "depicts": v.get("depicts")}
                        v = {**v2, "in_s": pa, "out_s": pb}
                sc, raw_score, dep = capped_score(v)
                entry.update(
                    {
                        # What is literally on screen (written before the fit judgement); stored with fit_reason.
                        # Blind mode: pass 2's summary of the observed events inside the verified window.
                        "seen": str(v.get("seen") or v.get("visible") or "")[:300],
                        "visible": str(v.get("visible") or v.get("seen") or "")[:300],
                        "subject": str(v.get("main_subject") or "")[:120],
                        "action": str(v.get("action") or "")[:120],
                        # The score is the model's, capped by its own literal-depiction call (DEPICTS_CAP);
                        # matches never stands below 7 or when the clip does not plainly show the line.
                        "lineShows": fixed_ls if fixed_ls is not None else str(v.get("line_shows") or "")[:120],
                        "lineShowsFixed": fixed_ls is not None,
                        "depicts": dep,
                        "rawScore": raw_score,
                        "matches": bool(v.get("matches")) and sc >= ACCEPT_SCORE and dep == "yes",
                        "score": sc,
                        "subjectVisible": bool(v.get("subject_visible", True)),
                        # The verified playback window (what depicts/score were judged on) and pass 2's own window.
                        "inS": pa,
                        "outS": pb,
                        "judgedInS": ja,
                        "judgedOutS": jb,
                        "clipS": round(clip_s, 2),
                        "issues": str(v.get("issues") or "")[:200],
                        "style": str(v.get("style") or LIVE_ACTION),
                        "lighting": int(v.get("lighting") if v.get("lighting") is not None else 5),
                        "framing": str(v.get("framing") or "")[:60],
                        "timeOfDay": str(v.get("time_of_day") or "day"),
                        "fitReason": str(v.get("fit_reason") or "")[:200],
                        "settingFit": norm_setting_fit(v.get("setting_fit")) if shot.get("setting") else "neutral",
                        "settingReason": str(v.get("setting_reason") or "")[:160],
                    }
                )
                before_setting = entry["score"]
                if apply_setting_cap(entry):
                    print("[t2v:verify:setting]", json.dumps({
                        "draftId": draft_id, "sceneId": shot.get("sceneId"), "candidateId": c.get("providerId"),
                        "setting": str(shot.get("setting") or "")[:160], "reason": entry["settingReason"],
                        "score": before_setting, "capped": entry["score"],
                    }), flush=True)
                if blind:
                    entry["blind"] = True
                    # QA/VQ: the locked observation and the events inside the verified window.
                    entry["observation"] = obs_text[:DESCRIBED_CHARS]
                    if obs.get("setting"):
                        entry["clipSetting"] = obs["setting"][:200]
                    entry["windowEvents"] = [event_line(e) for e in events_in(obs, pa, pb)][:8]
                    art = norm_artifacts(v.get("artifacts"), obs.get("notes", "") + " " + " ".join(
                        f"{e.get('visible', '')} {e.get('lighting', '')}" for e in events_in(obs, pa, pb)))
                    if entry.pop("cutout", False) and art == "none":
                        art = "cutout"
                    entry["artifacts"] = art
                    if art != "none":
                        before = entry["score"]
                        apply_artifact_cap(entry)
                        print("[t2v:verify:artifact]", json.dumps({
                            "draftId": draft_id, "sceneId": shot.get("sceneId"), "candidateId": c.get("providerId"),
                            "artifacts": art, "score": before, "capped": entry["score"],
                        }), flush=True)
                try:
                    cs = _color_stats(muted, pa, pb)
                    if cs:
                        entry["saturation"], entry["luma"] = cs
                except Exception:  # noqa: BLE001 — colour stats are information only
                    pass
                if not is_photo:
                    try:
                        mv = _motion(muted, pa, pb)
                    except Exception:  # noqa: BLE001 — motion is a cheap extra signal
                        mv = None
                    try:
                        fz = frozen_overlap(_frozen_spans(muted), pa, pb)
                    except Exception:  # noqa: BLE001
                        fz = 0.0
                    if fz:
                        entry["frozenS"] = fz
                    # Frozen for most of the played slice (V4) counts as static too.
                    frozen = fz >= 0.5 * max(0.1, pb - pa)
                    if mv is not None:
                        entry["motion"] = mv
                    if (mv is not None and mv < STATIC_DIFF) or frozen:
                        # A frozen frame placed as video: treated as a still and never an accepted pick.
                        entry["static"] = True
                        if frozen and entry.get("artifacts") in (None, "none"):
                            entry["artifacts"] = "frozen"
                        if entry["score"] > STATIC_MAX_SCORE:
                            entry["score"] = STATIC_MAX_SCORE
                        entry["matches"] = False
                        print("[t2v:verify:static]", json.dumps({
                            "draftId": draft_id, "sceneId": shot.get("sceneId"), "candidateId": c.get("providerId"),
                            "motion": mv, "frozenS": fz, "window": [pa, pb], "rawScore": entry.get("rawScore"), "score": entry["score"],
                        }), flush=True)
                try:
                    entry["phash"] = _dhash_frames(muted, pa, pb)
                except Exception:  # noqa: BLE001 — hash is a bonus signal
                    entry["phash"] = []
            except Exception as exc:  # noqa: BLE001 — candidate-level failure, try next
                entry.update({"error": str(exc)[:200]})
                evaluated.append(entry)
                continue
            evaluated.append(entry)
            if passes(entry, need_s, ctx):
                passing += 1
                # Two passing options give the no-repeat pass a backup without reviewing everything.
                if passing >= 2:
                    break

    t0 = time.time()
    with tempfile.TemporaryDirectory(prefix="t2v-verify-") as td:
        work = Path(td)
        with ThreadPoolExecutor(max_workers=PARALLEL_SHOTS) as pool:
            futs = [pool.submit(verify_shot, i, s, work) for i, s in enumerate(shots)]
            for i, f in enumerate(futs):
                try:
                    f.result()
                except Exception as exc:  # noqa: BLE001 — a shot-level crash never fails the job
                    evaluated_by_shot[i].append({"providerId": "-", "error": f"shot_failed:{str(exc)[:160]}"})

    # No-repeat selection, scarcest shots first (fewest passing clips; ties in story order), so a line with
    # plenty of options never takes another line's only good clip. Never the same clip ID twice, never a
    # near-identical frame (dHash) of an already-picked shot, including picks from earlier rounds.
    results: list[dict | None] = [None] * len(shots)
    for i in scarcity_order(shots, evaluated_by_shot, realistic):
        shot = shots[i]
        need_s = float(shot.get("needS") or 4.0)
        ctx = shot_ctx(shot)
        ev = evaluated_by_shot[i]

        def free(e: dict) -> bool:
            return e["providerId"] not in used_ids and not any(near_duplicate(e.get("phash") or [], h) for h in used_hashes)

        chosen = None
        for e in sorted((e for e in ev if passes(e, need_s, ctx)), key=lambda e: (-depicts_rank(e), -e["score"], -e.get("lighting", 5))):
            if free(e):
                chosen = {**e, "verdict": "accepted"}
                break
        if chosen is None:
            for e in sorted((e for e in ev if usable(e, need_s, ctx)), key=lambda e: (-depicts_rank(e), -fallback_rank(e, ctx))):
                if free(e):
                    chosen = {**e, "verdict": "weak_match"}
                    break
        if chosen is None:
            # A clip contradicting the moment's implied setting is never even a best-available pick.
            for e in sorted((e for e in ev if not e.get("error") and e.get("score", 0) >= FALLBACK_MIN_SCORE
                             and e.get("settingFit") != "contradicts"), key=lambda e: -fallback_rank(e, ctx)):
                if free(e):
                    chosen = {**e, "verdict": "best_available"}
                    break
        if chosen:
            used_ids.add(chosen["providerId"])
            if chosen.get("phash"):
                used_hashes.append(chosen["phash"])
        _log_scene(job.get("id"), draft_id, i, shot, chosen, ev)
        results[i] = {"sceneId": shot.get("sceneId"), "chosen": chosen, "evaluated": ev}

    try:
        if usage["calls"]:
            _log_usage(conn, workspace_id, project_id, model, usage["in"], usage["out"])
    except Exception as exc:  # noqa: BLE001
        log.warning("[t2v:verify] usage log failed: %s", exc)
        conn.rollback()

    summary = {
        "model": model,
        "geminiCalls": usage["calls"],
        # Blind mode: describe calls (one per unique clip not cached yet) + text score calls; both in geminiCalls.
        "describeCalls": usage["describe"],
        "scoreCalls": usage["score"],
        "describeCacheHits": usage["describeHits"],
        "promptTokens": usage["in"],
        "outputTokens": usage["out"],
        "elapsedMs": int((time.time() - t0) * 1000),
        "accepted": sum(1 for r in results if r and r.get("chosen") and r["chosen"].get("verdict") == "accepted"),
        "weak": sum(1 for r in results if r and r.get("chosen") and r["chosen"].get("verdict") == "weak_match"),
        "bestAvailable": sum(1 for r in results if r and r.get("chosen") and r["chosen"].get("verdict") == "best_available"),
        "unmatched": sum(1 for r in results if not (r and r.get("chosen"))),
    }
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE clip_jobs SET payload = payload || %s::jsonb, status='DONE', \"finishedAt\"=NOW(), error=NULL WHERE id=%s",
            (json.dumps({"results": results, "summary": summary}), job["id"]),
        )
    conn.commit()
    print(f"[t2v:verify] draft={draft_id} job={job['id']} {json.dumps(summary)}", flush=True)
    try:
        post_internal(
            "/api/t2v/internal/pipeline-verified",
            {"draftId": draft_id, "workspaceId": workspace_id, "jobId": job["id"]},
        )
    except Exception as exc:  # noqa: BLE001 — web also resumes from the job row on status poll
        log.warning("[t2v:verify] callback failed: %s", exc)
    return summary
