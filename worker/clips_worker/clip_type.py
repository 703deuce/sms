"""Per-clip content type from Gemini first-pass output + facecam detection (T5)."""
from __future__ import annotations

from typing import Any

CLIP_TYPES = frozenset({"gaming", "irl", "just_chatting", "podcast", "other"})
FACECAM_CONFIDENCE_THRESHOLD = 0.45
UPLOAD_FACECAM_MIN_CONF = 0.85


def _norm_content_type(raw: str | None) -> str | None:
    v = (raw or "").strip().lower().replace("-", "_").replace(" ", "_")
    if v in CLIP_TYPES:
        return v
    if v in ("justchatting", "just_chat", "talking", "desk"):
        return "just_chatting"
    if v in ("game", "gaming_stream"):
        return "gaming"
    if v in ("reaction", "creative"):
        return "just_chatting"
    return None


def content_type_from_picker_moment(moment: dict | None, section_activity: str | None = None) -> str:
    if isinstance(moment, dict):
        gui = moment.get("game_ui_visible")
        cam = moment.get("real_camera_footage")
        if gui is True and cam is not True:
            return "gaming"
        if cam is True and gui is not True:
            ct = _norm_content_type(str(moment.get("content_type") or ""))
            return ct if ct in ("just_chatting", "podcast") else "irl"
        ct = _norm_content_type(str(moment.get("content_type") or ""))
        if ct == "gaming" and cam is True:
            return "irl"
        if ct:
            return ct
        cats = moment.get("category") or []
        if isinstance(cats, list):
            cats_l = [str(c).lower() for c in cats]
            if "irl" in cats_l:
                return "irl"
            if "talking" in cats_l or "reaction" in cats_l or "creative" in cats_l:
                return "just_chatting"
    act = (section_activity or "").lower()
    if "irl" in act:
        return "irl"
    if "podcast" in act or "interview" in act:
        return "podcast"
    if "talk" in act or "chat" in act or "reaction" in act:
        return "just_chatting"
    return "other"


def moment_has_explicit_content_type(moment: dict | None) -> bool:
    if not isinstance(moment, dict):
        return False
    return _norm_content_type(str(moment.get("content_type") or "")) is not None


def _upload_type_vote_label(moment: dict | None, section_activity: str | None) -> str:
    t = content_type_from_picker_moment(moment, section_activity)
    return "irl" if t == "other" else t


def upload_project_majority_type(picks: list[dict]) -> str:
    """One default clip type per upload from picker evidence (never ``other``)."""
    labels: list[str] = []
    stream_m: str | None = None
    bool_moment_count = 0
    real_cam_count = 0
    jc_podcast_votes = 0
    for p in picks:
        meta = p.get("aiMeta") or {}
        vm = meta.get("videoMoment")
        section = meta.get("sectionActivity")
        if isinstance(vm, dict):
            gui = vm.get("game_ui_visible")
            cam = vm.get("real_camera_footage")
            if gui is not None or cam is not None:
                bool_moment_count += 1
                if cam is True:
                    real_cam_count += 1
                if gui is True and cam is not True:
                    labels.append("gaming")
                elif cam is True:
                    ct = content_type_from_picker_moment(vm, section)
                    vote = ct if ct in ("just_chatting", "podcast") else "irl"
                    labels.append(vote)
                    if vote in ("just_chatting", "podcast"):
                        jc_podcast_votes += 1
                else:
                    labels.append(_upload_type_vote_label(vm, section))
            else:
                labels.append(_upload_type_vote_label(vm, section))
        else:
            labels.append(_upload_type_vote_label(vm, section))
        if stream_m is None:
            sm = meta.get("streamMajorityType")
            if sm in CLIP_TYPES and sm != "other":
                stream_m = str(sm)
    if bool_moment_count > 0 and real_cam_count >= (bool_moment_count + 1) // 2:
        if jc_podcast_votes > real_cam_count // 2:
            return "just_chatting"
        return "irl"
    maj = stream_majority_clip_type(labels)
    if maj in CLIP_TYPES and maj != "other":
        if maj == "irl" and stream_m == "gaming":
            weak = all(
                not moment_has_explicit_content_type((p.get("aiMeta") or {}).get("videoMoment"))
                for p in picks
            )
            if weak:
                return "gaming"
        return str(maj)
    if stream_m:
        return stream_m
    return "irl"


def upload_should_run_facecam_detect(**_kw) -> bool:
    return True


def resolve_upload_clip_type(
    *,
    moment: dict | None,
    section_activity: str | None,
    upload_project_majority: str | None,
    stream_majority: str | None,
    moment_match_iou: float,
    has_facecam: bool,
    facecam_confidence: float,
) -> dict[str, Any]:
    picker_ct = content_type_from_picker_moment(moment, section_activity)
    project_m = upload_project_majority or stream_majority or "irl"
    if project_m == "other":
        project_m = "irl"
    strong = moment_has_explicit_content_type(moment) and float(moment_match_iou or 0) >= 0.35
    if strong and picker_ct != "other" and picker_ct != "gaming":
        ct = picker_ct
    elif strong and picker_ct == "gaming" and project_m == "gaming":
        ct = "gaming"
    else:
        ct = project_m
    if ct == "other":
        ct = "irl"
    game_evidence = (
        isinstance(moment, dict) and moment.get("game_ui_visible") is True
    ) or project_m == "gaming"
    strong_fc = has_facecam and facecam_confidence >= UPLOAD_FACECAM_MIN_CONF
    real_cam = isinstance(moment, dict) and moment.get("real_camera_footage") is True
    if strong_fc and game_evidence and not real_cam:
        ct = "gaming"
    elif ct == "gaming" and not game_evidence:
        ct = project_m if project_m != "gaming" else "irl"
    return {
        "clipType": ct,
        "hasFacecam": bool(has_facecam),
        "facecamConfidence": round(float(facecam_confidence or 0.0), 3),
    }


def resolve_clip_type(
    *,
    moment: dict | None,
    section_activity: str | None,
    stream_majority: str | None,
    has_facecam: bool,
    facecam_confidence: float,
) -> dict[str, Any]:
    ct = content_type_from_picker_moment(moment, section_activity)
    if ct == "other" and stream_majority in CLIP_TYPES and stream_majority != "other":
        ct = str(stream_majority)
    if ct == "other":
        ct = "irl"
    if has_facecam and facecam_confidence >= FACECAM_CONFIDENCE_THRESHOLD:
        ct = "gaming"
    return {
        "clipType": ct,
        "hasFacecam": bool(has_facecam),
        "facecamConfidence": round(float(facecam_confidence or 0.0), 3),
    }


def video_moment_for_pick(
    video_moments: list[dict] | None,
    start_ms: int,
    end_ms: int,
) -> dict | None:
    if not video_moments:
        return None
    best: dict | None = None
    best_iou = 0.0
    for vm in video_moments:
        try:
            if vm.get("start_ms") is not None:
                v0 = int(vm["start_ms"])
                v1 = int(vm["end_ms"])
            else:
                v0 = int(float(vm.get("start_s", 0)) * 1000)
                v1 = int(float(vm.get("end_s", vm.get("start_s", 0))) * 1000)
        except (TypeError, ValueError):
            continue
        inter = max(0, min(end_ms, v1) - max(start_ms, v0))
        union = max(end_ms, v1) - min(start_ms, v0)
        iou = inter / union if union > 0 else 0.0
        if iou > best_iou:
            best_iou = iou
            best = vm
    return best if best_iou >= 0.15 else None


def video_moment_match_for_pick(
    video_moments: list[dict] | None,
    start_ms: int,
    end_ms: int,
) -> tuple[dict | None, float]:
    if not video_moments:
        return None, 0.0
    best: dict | None = None
    best_iou = 0.0
    for vm in video_moments:
        try:
            if vm.get("start_ms") is not None:
                v0 = int(vm["start_ms"])
                v1 = int(vm["end_ms"])
            else:
                v0 = int(float(vm.get("start_s", 0)) * 1000)
                v1 = int(float(vm.get("end_s", vm.get("start_s", 0))) * 1000)
        except (TypeError, ValueError):
            continue
        inter = max(0, min(end_ms, v1) - max(start_ms, v0))
        union = max(end_ms, v1) - min(start_ms, v0)
        iou = inter / union if union > 0 else 0.0
        if iou > best_iou:
            best_iou = iou
            best = vm
    if best_iou >= 0.15:
        return best, best_iou
    return None, 0.0


def section_activity_for_moment(moment: dict | None, sections: list[dict] | None) -> str | None:
    if not isinstance(moment, dict) or not sections:
        return None
    try:
        m0 = float(moment.get("start_s") or 0)
        m1 = float(moment.get("end_s") or m0)
    except (TypeError, ValueError):
        return None
    mid = (m0 + m1) / 2.0
    for sec in sections:
        if not isinstance(sec, dict):
            continue
        try:
            s0 = float(sec.get("start_s") or 0)
            s1 = float(sec.get("end_s") or s0)
        except (TypeError, ValueError):
            continue
        if s0 <= mid <= s1:
            return str(sec.get("activity") or "")
    return None


def stream_majority_clip_type(types: list[str]) -> str | None:
    counts: dict[str, int] = {}
    for t in types:
        if t == "other":
            t = "irl"
        if t in CLIP_TYPES and t != "other":
            counts[t] = counts.get(t, 0) + 1
    if not counts:
        return None
    return max(counts, key=counts.get)
