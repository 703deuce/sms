"""C3 payoff markers: viewer clips and chat !clip/bursts mark the PAYOFF; the setup is looked up earlier.

Pure module (no flags, no I/O). Used by clipfind/c3_seams.py behind CLIPFIND_CHAT_PAYOFF.

Bug this fixes (master a788639): twitch.py / kick.py emit "vod_offset_s", but clip_cues.py:81,112 and
llm_rank_context.py:38 read "vod_offset_ms"/"startMs", so every viewer clip lands at second 0.
"""
from __future__ import annotations

# Twitch viewer clips are cut after the moment: the clip ends near the click and usually holds the
# reaction. Put the payoff 60% into the clip (capped at 12 s in), then let C2 look back for the setup.
VIEWER_PAYOFF_FRAC = 0.6
VIEWER_PAYOFF_MAX_S = 12.0


def viewer_clip_start_s(vc: dict) -> float | None:
    """VOD offset of a viewer clip in seconds, whatever key the fetcher used."""
    for key, scale in (("vod_offset_s", 1.0), ("offset_s", 1.0), ("vod_offset_ms", 0.001), ("startMs", 0.001)):
        v = vc.get(key)
        if v is None or v == "":
            continue
        try:
            return float(v) * scale
        except (TypeError, ValueError):
            continue
    return None


def viewer_clip_payoff_s(vc: dict, *, range_start_s: float = 0.0) -> float | None:
    """Payoff second on the analysed timeline (VOD offset minus the analysed range start)."""
    st = viewer_clip_start_s(vc)
    if st is None:
        return None
    try:
        dur = float(vc.get("duration_s") or vc.get("duration") or 0)
    except (TypeError, ValueError):
        dur = 0.0
    return st - range_start_s + min(VIEWER_PAYOFF_MAX_S, max(0.0, dur) * VIEWER_PAYOFF_FRAC)


def payoff_cue_events(cue_events: list[dict], viewer_clips: list[dict] | None, duration_s: int,
                      *, range_start_s: float = 0.0) -> list[dict]:
    """Return cue events with viewer clips re-placed at their payoff second and every
    chat/viewer event tagged payoff=True. streamer_call events are unchanged.
    Chat cue seconds are already lag-shifted by chat_clip_cue_seconds(lag_s=6) (clip_cues.py:55)."""
    out: list[dict] = []
    for ev in cue_events:
        kind = str(ev.get("kind") or "")
        if kind == "viewer_clip":
            continue
        out.append({**ev, "payoff": True} if kind == "chat_call" else dict(ev))
    for vc in viewer_clips or []:
        p = viewer_clip_payoff_s(vc, range_start_s=range_start_s)
        if p is None or p < 0 or p >= duration_s:
            continue
        out.append({"kind": "viewer_clip", "sec": int(p), "weight": 0.9, "payoff": True,
                    "views": int(vc.get("view_count") or 0)})
    return out


def viewer_cue_curve(viewer_clips: list[dict] | None, duration_s: int, *, range_start_s: float = 0.0) -> list[float]:
    """Same shape as clip_cues.viewer_clip_cue_seconds (1.0 at the second, 0.75 at +-1..2) but at the payoff."""
    out = [0.0] * max(0, duration_s)
    for vc in viewer_clips or []:
        p = viewer_clip_payoff_s(vc, range_start_s=range_start_s)
        if p is None:
            continue
        sec = int(p)
        if 0 <= sec < duration_s:
            out[sec] = 1.0
            for d in (-2, -1, 1, 2):
                if 0 <= sec + d < duration_s:
                    out[sec + d] = max(out[sec + d], 0.75)
    return out


def marker_seconds(cue_events: list[dict]) -> list[float]:
    return sorted(float(ev["sec"]) for ev in cue_events if ev.get("payoff"))
