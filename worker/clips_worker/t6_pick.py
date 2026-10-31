"""Deterministic T6 template auto-pick (P2)."""
from __future__ import annotations

import hashlib
from typing import Any

from clips_worker.t6_registry import TEMPLATES

LANE_FALLBACK = {
    "gaming": "G4",
    "irl": "I3",
    "just_chatting": "C6",
    "podcast": "C6",
}


FACE_PANEL_SRCS = ("face_tight", "active_speaker")


def _needs_detected_face(t: dict) -> bool:
    for p in t.get("panels") or []:
        src = str(p.get("src") or "")
        if src in FACE_PANEL_SRCS or src.startswith("person:"):
            return True
    return False


def eligible(t: dict, s: dict, clip: dict) -> bool:
    req = t.get("requires") or {}
    faces = s.get("faces")
    if isinstance(faces, list) and not faces and _needs_detected_face(t):
        # T6.3: no recurring real face/person -> never auto-pick a face/person zoom template
        # (I5 framed an empty wall). The lane fallback keeps the whole frame.
        return False
    conf = float(s.get("facecam_conf") or 0.0)
    if req.get("facecam") and (conf < 0.85 or not s.get("facecam_box")):
        return False
    if req.get("noBackgroundAction") and s.get("background_action"):
        return False
    if req.get("contentBox") and not s.get("content_box"):
        return False
    pc_min = req.get("personCountMin")
    if pc_min is not None and int(s.get("person_count") or 0) < int(pc_min):
        return False
    max_p = req.get("maxPersons")
    if max_p is not None and int(s.get("person_count") or 0) > int(max_p):
        return False
    max_d = req.get("maxDurationSec")
    if max_d is not None:
        dur_ms = int(clip.get("duration_ms") or clip.get("durationMs") or 0)
        if dur_ms <= 0:
            trim = (clip.get("trim") or {}) if isinstance(clip.get("trim"), dict) else {}
            dur_ms = int(trim.get("out", 0)) - int(trim.get("in", 0))
        if dur_ms > int(max_d) * 1000:
            return False
    return True


def fit_score(t: dict, s: dict) -> float:
    w = t.get("pickWeights") or {}
    score = 0.0
    score += float(w.get("facecam_conf", 0)) * float(s.get("facecam_conf") or 0.0)
    ab = s.get("action_box")
    if isinstance(ab, dict):
        score += float(w.get("action_wide", 0)) * float(ab.get("w") or 0.0)
    faces = s.get("faces")
    if isinstance(faces, list) and faces and _needs_detected_face(t):
        # T6.3: a detected real face prefers the face-crop template (talking clips -> C1/C2/C4).
        score += 1.0
    return score


def pick_template(
    s: dict,
    clip: dict,
    history: list[str],
    batch_counts: dict[str, int],
    batch_size: int,
    seed: str,
) -> tuple[str, str]:
    lane = str(s.get("clip_type") or "irl")
    if float(s.get("type_conf") or 0.0) < 0.6:
        return LANE_FALLBACK.get(lane, "I3"), "low_conf"
    cands = [tid for tid, t in TEMPLATES.items() if t.get("lane") == lane and eligible(t, s, clip)]
    if not cands:
        return LANE_FALLBACK.get(lane, "I3"), "no_eligible"
    cap = max(1, int((batch_size * 0.4) + 0.999))
    scored: list[tuple[float, str]] = []
    for tid in cands:
        t = TEMPLATES[tid]
        sc = fit_score(t, s)
        if tid in history[-2:]:
            sc -= 3.0
        if batch_counts.get(tid, 0) + 1 > cap:
            sc -= 100.0
        tie = int(hashlib.sha1(f"{seed}:{tid}".encode()).hexdigest()[:8], 16)
        scored.append((sc + tie * 1e-9, tid))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return scored[0][1], "scored"


def apply_t6_template_to_edits(
    edits: dict,
    *,
    signals: dict,
    clip: dict,
    history: list[str],
    batch_counts: dict[str, int],
    batch_size: int,
    seed: str,
    title_auto: bool = False,
) -> dict:
    tid, reason = pick_template(signals, clip, history, batch_counts, batch_size, seed)
    t = TEMPLATES[tid]
    layout = dict(edits.get("layout") or {})
    layout["mode"] = t.get("fallbackMode") or layout.get("mode") or "fit_blur"
    layout["template"] = {
        "id": tid,
        "auto": True,
        "reason": reason,
        "lane": t.get("lane"),
        "pickedAt": "v1",
    }
    print(
        f"[t6:pick] template={tid} lane={t.get('lane')!r} reason={reason!r} conf={float(signals.get('type_conf') or 0):.2f}",
        flush=True,
    )
    out = {**edits, "layout": layout}
    if title_auto:
        out = _apply_auto_title_style(out, t, signals)
    return out


def _apply_auto_title_style(edits: dict, t: dict, signals: dict) -> dict:
    """T6.3: T6_TITLE_AUTO was never wired (pick_title_style had no caller). Seed the chip
    from the luminance behind the title; a user's t6Id is never overwritten."""
    if not isinstance(edits.get("exportTemplate"), dict):
        return edits
    tpl = dict(edits["exportTemplate"])
    hs = tpl.get("headlineStyle") if isinstance(tpl.get("headlineStyle"), dict) else {}
    if hs.get("t6Id"):
        return edits
    from clips_worker.t6_geometry import resolve_template_geometry
    from clips_worker.t6_titles import pick_title_style

    spec = resolve_template_geometry(t, signals, edits)
    sid, why = pick_title_style(spec, signals, [])
    tpl["headlineStyle"] = {**hs, "t6Id": sid, "auto": True}
    print(f"[t6:title_pick] t6Id={sid} reason={why}", flush=True)
    return {**edits, "exportTemplate": tpl}
