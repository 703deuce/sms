"""Per-clip layout decision, called before run_speakercrop.

Chooses center_crop, fit_blur, speaker_follow, or full_frame from the source
aspect, a screen-share / gameplay probe, and the median face box from
t6_cv.detect_faces. Clip modes should arrive with layout.mode == "auto";
long-form / YouTube video stay full_frame.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from clips_worker.clip_layout_policy import is_gameplay_content_archetype
from clips_worker.stage_log import stage_event

# Modes the worker is allowed to overwrite (clip-mode default is "auto").
_PENDING_MODES = frozenset({"auto", "", "none"})

# 9:16 crop of a landscape frame uses the full source height.
_TARGET_ASPECT = 9 / 16
_VERTICAL_FULL_FRAME_RATIO = (16 / 9) * 0.98  # h/w at or taller than ~9:16
_FACE_CENTER_TOL = 0.08
_FACE_TINY_H = 0.18
_FACE_LARGE_H = 0.25


def _source_size(video: Path) -> tuple[int, int]:
    try:
        import cv2

        cap = cv2.VideoCapture(str(video))
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        cap.release()
        return w, h
    except Exception:
        return 0, 0


def face_center_crop_fit(
    face: dict[str, Any],
    source_w: int,
    source_h: int,
) -> dict[str, Any]:
    """Whether a 9:16 center crop keeps the face whole, centered, and large enough."""
    if source_w <= 0 or source_h <= 0:
        return {"kept_whole": False, "centered": False, "large_enough": False, "tiny": True}
    crop_w = min(1.0, _TARGET_ASPECT * (source_h / source_w))
    left, right = 0.5 - crop_w / 2.0, 0.5 + crop_w / 2.0
    fx = float(face.get("x") or 0)
    fy = float(face.get("y") or 0)
    fw = float(face.get("w") or 0)
    fh = float(face.get("h") or 0)
    kept_whole = fx >= left - 0.01 and (fx + fw) <= right + 0.01
    cx = fx + fw / 2.0
    centered = abs(cx - 0.5) <= _FACE_CENTER_TOL
    large_enough = fh >= _FACE_LARGE_H or (fw >= 0.20 and fh >= _FACE_TINY_H)
    tiny = fh < _FACE_TINY_H
    return {
        "kept_whole": kept_whole and not tiny,
        "centered": centered,
        "large_enough": large_enough,
        "tiny": tiny,
        "crop_w": round(crop_w, 4),
        "face": {"x": fx, "y": fy, "w": fw, "h": fh, "persist": face.get("persist")},
    }


def choose_clip_layout(
    *,
    source_w: int,
    source_h: int,
    faces: list[dict[str, Any]] | None,
    is_screen_share: bool,
    is_gameplay: bool = False,
    is_longform: bool = False,
) -> tuple[str, str, dict[str, Any]]:
    """Return (mode, reason, inputs) for one clip. Pure; no I/O."""
    inputs: dict[str, Any] = {
        "source_w": source_w,
        "source_h": source_h,
        "is_screen_share": bool(is_screen_share),
        "is_gameplay": bool(is_gameplay),
        "is_longform": bool(is_longform),
        "face_count": 0 if faces is None else len(faces),
    }
    if is_longform:
        return "full_frame", "longform_full_frame", inputs
    if source_w > 0 and source_h >= source_w:
        if source_h / source_w >= _VERTICAL_FULL_FRAME_RATIO:
            return "full_frame", "source_already_vertical_full_frame", inputs
        return "center_crop", "source_already_vertical_center_crop", inputs
    if is_screen_share or is_gameplay:
        return "fit_blur", "screen_share_or_gameplay", inputs
    face = faces[0] if faces else None
    if face:
        fit = face_center_crop_fit(face, source_w, source_h)
        inputs["face_fit"] = fit
        if fit["kept_whole"] and (fit["centered"] or fit["large_enough"]):
            return "center_crop", "face_fits_center_crop", inputs
        return "speaker_follow", "wide_face_needs_tracking", inputs
    return "center_crop", "no_stable_face_center_crop", inputs


def decide_clip_layout(
    video: Path | str,
    *,
    is_longform: bool = False,
    archetype: str | None = None,
    clip_id: str | None = None,
    project_id: str | None = None,
    job_id: str | None = None,
    detect_faces_fn=None,
    probe_screen_share_fn=None,
    source_size_fn=None,
) -> tuple[str, str, dict[str, Any]]:
    path = Path(video)
    size_fn = source_size_fn or _source_size
    source_w, source_h = size_fn(path)
    is_gameplay = is_gameplay_content_archetype(archetype)
    is_ss = False
    if not is_longform and source_w > 0 and source_h < source_w:
        try:
            if probe_screen_share_fn is None:
                from clips_worker.screen_share_detect import probe_screen_share_video

                probe_screen_share_fn = probe_screen_share_video
            verdict = probe_screen_share_fn(str(path))
            is_ss = bool(getattr(verdict, "is_screen_share", verdict))
        except Exception as exc:
            stage_event(
                "layout",
                "screen_share_probe_failed",
                project_id=project_id,
                job_id=job_id,
                clipId=clip_id,
                error=exc,
            )
    faces: list[dict[str, Any]] | None = None
    if not is_longform and not (source_w > 0 and source_h >= source_w) and not is_ss and not is_gameplay:
        try:
            if detect_faces_fn is None:
                from clips_worker.t6_cv import detect_faces

                detect_faces_fn = detect_faces
            faces = detect_faces_fn(path)
        except Exception as exc:
            stage_event(
                "layout",
                "detect_faces_failed",
                project_id=project_id,
                job_id=job_id,
                clipId=clip_id,
                error=exc,
            )
            faces = None
    mode, reason, inputs = choose_clip_layout(
        source_w=source_w,
        source_h=source_h,
        faces=faces,
        is_screen_share=is_ss,
        is_gameplay=is_gameplay,
        is_longform=is_longform,
    )
    stage_event(
        "layout",
        "decision",
        project_id=project_id,
        job_id=job_id,
        clipId=clip_id,
        mode=mode,
        reason=reason,
        inputs=inputs,
    )
    return mode, reason, inputs


def apply_layout_decision(
    edits: dict[str, Any] | None,
    video: Path | str,
    *,
    is_longform: bool = False,
    archetype: str | None = None,
    clip_id: str | None = None,
    project_id: str | None = None,
    job_id: str | None = None,
    settings: dict[str, Any] | None = None,
    detect_faces_fn=None,
    probe_screen_share_fn=None,
    source_size_fn=None,
) -> str | None:
    """If layout.mode is pending (auto), write the decided mode into edits/settings.

    Returns the mode applied, or None when an explicit user/editor mode was left alone.
    Long-form callers should pass is_longform=True or already have full_frame set.
    """
    if not isinstance(edits, dict):
        return None
    layout = edits.get("layout")
    if not isinstance(layout, dict):
        layout = {}
        edits["layout"] = layout
    current = str(layout.get("mode") or "").strip().lower()
    if current not in _PENDING_MODES:
        return None
    mode, _reason, _inputs = decide_clip_layout(
        video,
        is_longform=is_longform,
        archetype=archetype,
        clip_id=clip_id,
        project_id=project_id,
        job_id=job_id,
        detect_faces_fn=detect_faces_fn,
        probe_screen_share_fn=probe_screen_share_fn,
        source_size_fn=source_size_fn,
    )
    layout["mode"] = mode
    if isinstance(settings, dict):
        if isinstance(settings.get("layout"), dict):
            settings["layout"] = {**settings["layout"], "mode": mode}
        settings["layoutMode"] = mode
    return mode
