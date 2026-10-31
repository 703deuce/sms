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


SHARED_FAMILY_PENALTY = 10.0

# T6.7: a face/person crop is only auto-picked when its face is in >= 80% of the sampled
# frames. Below that the clip changes layout mid-way (Ludwig: webcam scene -> full-cam
# scene; Dropped Frames: video segment -> hosts) and the fixed crop shows chat/text there.
STABLE_FACE_PERSIST = 0.8
# T6.7: the per-template tie noise (sha1 * 1e-9) is up to ~4.3, so it decided every pick
# (and with the upload seed always "clip", it was the same fixed ranking for every clip:
# G4 > G3 > G1 ..., I2 > I4 ..., which is why all IRL clips were I2 and gaming without a
# confirmed cam G4). A template that uses detected structure (confirmed facecam, content
# box, a stable face) gets this bonus, which is larger than the noise, so it beats the
# whole-frame templates; the noise still varies the pick *within* a tier.
STRUCTURE_BONUS = 5.0


def in_family(t: dict, lane: str) -> bool:
    """T6.4 (parity with registry.ts templateInFamily): native lane or a shared family."""
    return t.get("lane") == lane or lane in (t.get("families") or [])


def requires_for_family(t: dict, lane: str) -> dict:
    """T6.4: native requires plus the shared family's extras (e.g. C1 in podcast: 1 person)."""
    base = dict(t.get("requires") or {})
    if t.get("lane") == lane:
        return base
    extra = (t.get("familyRequires") or {}).get(lane) or {}
    return {**base, **extra}


def _needs_detected_face(t: dict) -> bool:
    for p in t.get("panels") or []:
        src = str(p.get("src") or "")
        if src in FACE_PANEL_SRCS or src.startswith("person:"):
            return True
    return False


def _face_persist(f: dict) -> float:
    try:
        return float(f.get("persist", 1.0))
    except (TypeError, ValueError, AttributeError):
        return 1.0


def faces_stable(s: dict) -> bool:
    """T6.7: the primary face (faces are sorted by persistence) is on screen >= 80% of the clip.
    Faces without ``persist`` (pre-T6.3 data) count as stable (unchanged behaviour)."""
    faces = s.get("faces")
    if not isinstance(faces, list) or not faces or not isinstance(faces[0], dict):
        return True
    return _face_persist(faces[0]) >= STABLE_FACE_PERSIST


def uses_structure(t: dict, s: dict, lane: str) -> bool:
    req = requires_for_family(t, lane)
    if req.get("facecam") or req.get("contentBox"):
        return True
    faces = s.get("faces")
    return bool(isinstance(faces, list) and faces and _needs_detected_face(t))


def _uses_any_structure(t: dict, lane: str) -> bool:
    req = requires_for_family(t, lane)
    return bool(req.get("facecam") or req.get("contentBox") or _needs_detected_face(t))


def eligible(t: dict, s: dict, clip: dict, lane: str | None = None) -> bool:
    req = requires_for_family(t, lane or str(t.get("lane") or ""))
    faces = s.get("faces")
    if isinstance(faces, list) and not faces and _needs_detected_face(t):
        # T6.3: no recurring real face/person -> never auto-pick a face/person zoom template
        # (I5 framed an empty wall). The lane fallback keeps the whole frame.
        return False
    if _needs_detected_face(t) and not faces_stable(s):
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
    only: set[str] | None = None,
) -> tuple[str, str]:
    """``only`` (T6.7 scene map): restrict to the templates that fit the scene's layout."""
    lane = str(s.get("clip_type") or "irl")
    if float(s.get("type_conf") or 0.0) < 0.6:
        return LANE_FALLBACK.get(lane, "I3"), "low_conf"
    cands = [
        tid
        for tid, t in TEMPLATES.items()
        if (only is None or tid in only) and in_family(t, lane) and eligible(t, s, clip, lane)
    ]
    if not cands and only is not None:
        # The scene's structured templates are not eligible (e.g. a webcam scene with no box):
        # its whole-frame / unstructured ones are.
        cands = [
            tid
            for tid in sorted(only)
            if tid in TEMPLATES and in_family(TEMPLATES[tid], lane) and not _uses_any_structure(TEMPLATES[tid], lane)
        ]
    if not cands:
        return LANE_FALLBACK.get(lane, "I3"), "no_eligible"
    cap = max(1, int((batch_size * 0.4) + 0.999))
    scored: list[tuple[float, str]] = []
    for tid in cands:
        t = TEMPLATES[tid]
        sc = fit_score(t, s)
        if uses_structure(t, s, lane):
            sc += STRUCTURE_BONUS
        if t.get("lane") != lane:
            # T6.4: shared-family templates (C1-C6 in podcast) only win when no native template
            # is eligible or the natives hit the batch cap (-100). 10 > max tie noise (~4.3)
            # + face bonus + history penalty, so podcast picks with an eligible native are unchanged.
            sc -= SHARED_FAMILY_PENALTY
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
    scenes = signals.get("scenes") if isinstance(signals.get("scenes"), list) else []
    segments: list[dict] = []
    if scenes:
        # T6.7: one template per scene of the close look's scene map; the clip-level template
        # (what the editor shows / the layout panel highlights) is the longest scene's.
        from clips_worker.t6_scenes import dominant_scene, pick_segments

        segments = pick_segments(signals, scenes, seed)
        dom = dominant_scene(scenes)
        dseg = next(sg for sg in segments if scenes[sg["scene"]] is dom)
        tid, reason, lane = dseg["id"], dseg["reason"], dseg["lane"]
    else:
        tid, reason = pick_template(signals, clip, history, batch_counts, batch_size, seed)
        lane = str(signals.get("clip_type") or "")
    t = TEMPLATES[tid]
    layout = dict(edits.get("layout") or {})
    layout["mode"] = t.get("fallbackMode") or layout.get("mode") or "fit_blur"
    layout["template"] = {
        "id": tid,
        "auto": True,
        "reason": reason,
        # T6.4: a shared template picked for a podcast clip keeps the podcast family in the picker.
        "lane": lane if in_family(t, lane) else t.get("lane"),
        "pickedAt": "v1",
    }
    if scenes:
        # The scene map is authoritative: a facecam box from an earlier (CV/VOD) stage must not
        # override the AI box in geometry (_facecam_region prefers layout.facecam.box).
        fb = signals.get("facecam_box")
        if isinstance(fb, dict):
            layout["facecam"] = {**(layout.get("facecam") or {}), "box": fb}
            if not signals.get("gameplay_box"):
                layout["facecam"].pop("gameplay", None)
        else:
            layout.pop("facecam", None)
    if len(segments) > 1:
        layout["template"]["segments"] = [
            {k: sg[k] for k in ("startS", "endS", "id", "lane", "scene")} for sg in segments
        ]
        # Segment times are seconds from the clip's start (the clip file the close look saw);
        # this is that start on the source timeline (= clips.startMs), for export/editor.
        layout["template"]["segmentsBaseMs"] = int(clip.get("start_ms") or 0)
    print(
        f"[t6:pick] template={tid} lane={layout['template']['lane']!r} reason={reason!r} conf={float(signals.get('type_conf') or 0):.2f}",
        flush=True,
    )
    out = {**edits, "layout": layout}
    if title_auto:
        tsig = signals
        if scenes:
            from clips_worker.t6_scenes import dominant_scene, scene_signals

            tsig = scene_signals(signals, dominant_scene(scenes))
        out = _apply_auto_title_style(out, t, tsig)
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
    title_def = t.get("title") if isinstance(t.get("title"), dict) else {}
    sid, why = pick_title_style(spec, signals, [], allowed=list(title_def.get("allowed") or []))
    tpl["headlineStyle"] = {**hs, "t6Id": sid, "auto": True}
    print(f"[t6:title_pick] t6Id={sid} reason={why}", flush=True)
    return {**edits, "exportTemplate": tpl}
