"""E2 timeline lane state + render timing (mirror of new-app lib/clips/editor/clip-timeline.ts).

All times are OUTPUT ms of the effective edits (after silence / loop-friendly trim and
section order) — the same time base the editor timeline and preview use.
Parity with the web model is asserted by tests/fixtures/timeline_parity.json, which both
vitest (tests/clip-timeline-parity.test.ts) and pytest (tests/test_timeline_lanes.py) load.
"""
from __future__ import annotations

from clips_worker.clip_keep_segments import ordered_keep_segments

LANE_ORDER = ("text", "adjust", "video", "broll", "voice", "music", "sfx")
LANE_TOGGLES = {
    "text": {"mute": False, "hide": True},
    # G4a: adjustment layers (hide = export without them).
    "adjust": {"mute": False, "hide": True},
    "video": {"mute": False, "hide": False},
    "broll": {"mute": False, "hide": True},
    "voice": {"mute": True, "hide": False, "solo": True},
    "music": {"mute": True, "hide": False, "solo": True},
    "sfx": {"mute": True, "hide": False, "solo": True},
}
AUDIO_LANES = ("voice", "music", "sfx")
MUSIC_MIN_MS = 500
HOOK_MIN_MS = 1500
HOOK_MAX_MS = 5000


def normalize_timeline_lanes(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    out: dict = {}
    for lane in LANE_ORDER:
        v = raw.get(lane)
        if not isinstance(v, dict):
            continue
        st: dict = {}
        if v.get("muted") is True and LANE_TOGGLES[lane]["mute"]:
            st["muted"] = True
        if v.get("hidden") is True and LANE_TOGGLES[lane]["hide"]:
            st["hidden"] = True
        if v.get("locked") is True:
            st["locked"] = True
        if v.get("soloed") is True and LANE_TOGGLES[lane].get("solo"):
            st["soloed"] = True
        if st:
            out[lane] = st
    return out or None


def apply_audio_solo(edits: dict) -> dict:
    """G2 solo (mirror of TS applyAudioSolo): while any audio lane / extra audio track is soloed,
    every audio lane / extra audio track that is not soloed is muted."""
    from clips_worker.tracks import REV_DEFAULT, normalize_tracks

    lanes = normalize_timeline_lanes(edits.get("timelineLanes")) or {}
    ts = normalize_tracks(edits.get("tracks"))
    lane_solo = [l for l in AUDIO_LANES if (lanes.get(l) or {}).get("soloed")]
    track_solo = [t for t in (ts or []) if t["kind"] == "audio" and t["id"] not in REV_DEFAULT and t.get("soloed")]
    if not lane_solo and not track_solo:
        return edits
    tl = dict(lanes)
    for l in AUDIO_LANES:
        if not (tl.get(l) or {}).get("soloed"):
            tl[l] = {**(tl.get(l) or {}), "muted": True}
    out = {**edits, "timelineLanes": tl}
    if ts:
        out["tracks"] = [
            {**t, "muted": True} if t["kind"] == "audio" and t["id"] not in REV_DEFAULT and not t.get("soloed") else t
            for t in ts
        ]
    return out


def voice_muted(edits: dict) -> bool:
    lanes = normalize_timeline_lanes(apply_audio_solo(edits).get("timelineLanes")) or {}
    return bool((lanes.get("voice") or {}).get("muted"))


def apply_timeline_lane_state(edits: dict) -> dict:
    """Drop hidden / muted lanes so export renders exactly what the editor preview plays."""
    from clips_worker.tracks import apply_track_state, on_default_track

    # G2: solo first — it only sets mute flags, which the paths below honour.
    edits = apply_audio_solo(edits)
    # G1b: hidden overlay / text tracks and muted audio tracks first (non-default tracks).
    edits = apply_track_state(edits)
    # G1c: takes / track color / track motion (preview applies the same in applyTimelineLaneState).
    from clips_worker.track_render import apply_track_render

    edits = apply_track_render(edits)
    lanes = normalize_timeline_lanes(edits.get("timelineLanes"))
    if not lanes:
        return edits
    out = dict(edits)
    # The E2 lane toggles are the DEFAULT track's state: extra tracks keep their own.
    if (lanes.get("adjust") or {}).get("hidden") and out.get("adjustLayers"):
        out = {**out, "adjustLayers": None}
    if (lanes.get("broll") or {}).get("hidden") and out.get("broll"):
        out["broll"] = [b for b in out["broll"] if not on_default_track(edits, "overlay", str(b.get("id")))]
    hook = out.get("hookOverlay")
    if (lanes.get("text") or {}).get("hidden") and isinstance(hook, dict) and hook.get("enabled"):
        out["hookOverlay"] = {**hook, "enabled": False}
    if (lanes.get("text") or {}).get("hidden") and out.get("textItems"):
        # E4: hiding the Text lane hides text items too
        kept = [t for t in out["textItems"] if not on_default_track(edits, "text", str(t.get("id")))]
        out["textItems"] = kept or None
    audio = out.get("audio")
    if isinstance(audio, dict):
        a = dict(audio)
        if (lanes.get("music") or {}).get("muted") and a.get("music"):
            a["music"] = None
        if (lanes.get("sfx") or {}).get("muted") and a.get("sfx"):
            a["sfx"] = [s for s in a["sfx"] if not on_default_track(edits, "audio", str(s.get("generationId")))]
        if (lanes.get("voice") or {}).get("muted") and a.get("studioSound"):
            a["studioSound"] = None
        out["audio"] = a
    if (lanes.get("voice") or {}).get("muted") and out.get("audioTrack"):
        out["audioTrack"] = None
    return out


def music_window(music: dict | None, duration_ms: int) -> dict | None:
    """{startMs, endMs, inMs} the music bed plays in (default: whole clip from media 0)."""
    if not music:
        return None
    dur = max(0, int(duration_ms))
    start = int(round(float(music.get("startMs") or 0)))
    start = max(0, min(start, max(0, dur - MUSIC_MIN_MS)))
    raw_end = music.get("endMs")
    end = dur if raw_end is None else int(round(float(raw_end)))
    end = max(min(dur, start + MUSIC_MIN_MS), min(end, dur))
    in_ms = max(0, int(round(float(music.get("inMs") or 0))))
    return {"startMs": start, "endMs": end, "inMs": in_ms}


def output_duration_ms(edits: dict) -> int:
    return int(sum(b - a for a, b in ordered_keep_segments(edits)))


def timeline_render_spec(effective_edits: dict) -> dict:
    """Render timing for effective edits — must equal web `renderTimingSpec`."""
    rendered = apply_timeline_lane_state(effective_edits)
    dur = output_duration_ms(rendered)
    hook = rendered.get("hookOverlay") if isinstance(rendered.get("hookOverlay"), dict) else None
    hook_ms = None
    if hook and hook.get("enabled"):
        hook_ms = max(HOOK_MIN_MS, min(HOOK_MAX_MS, int(hook.get("durationMs") or 2500)))
    audio = rendered.get("audio") or {}
    return {
        "durationMs": dur,
        "broll": [
            {"startMs": int(b["startMs"]), "endMs": int(b["endMs"]), "inMs": int(b.get("inMs") or 0)}
            for b in (rendered.get("broll") or [])
        ],
        "music": music_window(audio.get("music"), dur),
        "sfx": [{"atMs": int(s.get("atMs", 0))} for s in (audio.get("sfx") or [])],
        "voiceMuted": voice_muted(effective_edits),
        "hookOverlayMs": hook_ms,
    }
