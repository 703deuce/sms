"""Cheap Gemini vision layout check for uncertain face-count routing (clipper)."""
from __future__ import annotations

import base64
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests

from clips_worker.gemini_vision import GEMINI_BASE, discover_model, _key
from clips_worker.layout_router import CONFIDENCE_GATE, PersonCountSummary

_VISION_LAYOUT_MODEL = (os.environ.get("CLIPPER_VISION_LAYOUT_MODEL") or "").strip()
_MAX_FRAMES = int(os.environ.get("CLIPPER_VISION_LAYOUT_MAX_FRAMES", "4"))
_MAX_WIDTH = int(os.environ.get("CLIPPER_VISION_LAYOUT_MAX_WIDTH", "320"))
_TIMEOUT_S = float(os.environ.get("CLIPPER_VISION_LAYOUT_TIMEOUT_S", "25"))
_PER_CLIP_USD = float(os.environ.get("CLIPPER_VISION_LAYOUT_MAX_USD_PER_CLIP", "0.003"))
_PER_PROJECT_USD = float(os.environ.get("CLIPPER_VISION_LAYOUT_MAX_USD_PER_PROJECT", "0.05"))
_EST_USD_PER_FRAME = float(os.environ.get("CLIPPER_VISION_LAYOUT_EST_USD_PER_FRAME", "0.00008"))

_PROJECT_SPEND: dict[str, float] = {}
_PROJECT_STATS: dict[str, dict[str, float | int]] = {}


def _stats_for(project_id: str | None) -> dict[str, float | int]:
    key = (project_id or "").strip() or "_unknown"
    return _PROJECT_STATS.setdefault(
        key,
        {"trigger_checks": 0, "trigger_calls": 0, "trigger_success": 0, "est_usd": 0.0},
    )


def log_project_vision_stats(project_id: str | None) -> None:
    key = (project_id or "").strip() or "_unknown"
    bucket = _PROJECT_STATS.pop(key, None)
    if not bucket:
        return
    checks = int(bucket.get("trigger_checks") or 0)
    calls = int(bucket.get("trigger_calls") or 0)
    success = int(bucket.get("trigger_success") or 0)
    est = float(bucket.get("est_usd") or 0.0)
    rate = (success / calls) if calls else 0.0
    print(
        f"[clipper:vision] project_summary project={project_id or '-'} "
        f"checks={checks} calls={calls} success={success} trigger_rate={rate:.3f} est_usd_total={est:.5f}",
        flush=True,
    )

_LAYOUT_ENUM = (
    "speaker_follow",
    "split",
    "grid3",
    "grid4",
    "dynamic",
    "fit",
    "screen_pip",
)


@dataclass(frozen=True)
class VisionLayoutAdvice:
    person_count: int
    recommended_layout: str
    confidence: float
    has_corner_webcam_over_gameplay: bool
    is_screen_share: bool
    est_cost_usd: float
    trigger_reason: str


def vision_layout_enabled() -> bool:
    return os.environ.get("CLIPPER_VISION_LAYOUT_ENABLED", "1").strip().lower() not in (
        "0",
        "false",
        "no",
    )


def _layout_model() -> str:
    if _VISION_LAYOUT_MODEL:
        return _VISION_LAYOUT_MODEL
    try:
        return discover_model()
    except Exception:
        return "gemini-2.0-flash-lite"


def _response_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "personCount": {"type": "integer"},
            "peoplePositions": {"type": "array", "items": {"type": "string"}},
            "hasCornerWebcamOverGameplay": {"type": "boolean"},
            "isScreenShare": {"type": "boolean"},
            "recommendedLayout": {"type": "string"},
            "confidence": {"type": "number"},
        },
        "required": [
            "personCount",
            "hasCornerWebcamOverGameplay",
            "isScreenShare",
            "recommendedLayout",
            "confidence",
        ],
    }


def transcript_speaker_count(words_path: Path | None) -> int | None:
    if words_path is None or not words_path.is_file():
        return None
    try:
        words = json.loads(words_path.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(words, list):
        return None
    spks: set[str] = set()
    for w in words:
        if not isinstance(w, dict):
            continue
        raw = w.get("spk", w.get("speaker"))
        if raw is None:
            continue
        spks.add(str(raw))
    return len(spks) if spks else None


def should_call_vision_layout(
    summary: PersonCountSummary,
    *,
    audio_speaker_count: int | None = None,
    corner_webcam_hint: bool = False,
    screen_share_hint: bool = False,
) -> tuple[bool, str]:
    reasons: list[str] = []
    if summary.confidence < CONFIDENCE_GATE:
        reasons.append("low_probe_confidence")
    if summary.n_persons in (1, 2) and summary.confidence < CONFIDENCE_GATE + 0.12:
        reasons.append("borderline_person_count")
    if corner_webcam_hint or screen_share_hint:
        reasons.append("corner_webcam_hint")
    if audio_speaker_count is not None and audio_speaker_count > 0:
        if audio_speaker_count != summary.n_persons and not (
            audio_speaker_count == 1 and summary.n_persons == 2 and corner_webcam_hint
        ):
            reasons.append("audio_probe_mismatch")
    return (len(reasons) > 0, ",".join(reasons))


def _project_budget_ok(project_id: str | None, est_usd: float) -> bool:
    if est_usd > _PER_CLIP_USD:
        return False
    if not project_id:
        return True
    spent = _PROJECT_SPEND.get(project_id, 0.0)
    return spent + est_usd <= _PER_PROJECT_USD


def _record_project_spend(project_id: str | None, est_usd: float) -> None:
    if not project_id:
        return
    _PROJECT_SPEND[project_id] = _PROJECT_SPEND.get(project_id, 0.0) + est_usd


def sample_video_jpegs(video_path: str | Path, *, max_frames: int = _MAX_FRAMES, max_width: int = _MAX_WIDTH) -> list[bytes]:
    try:
        import cv2
    except ImportError:
        return []
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if total < 1:
        cap.release()
        return []
    indices = [int(i) for i in _evenly_spaced_indices(total, max_frames)]
    out: list[bytes] = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok:
            continue
        h, w = frame.shape[:2]
        scale = max_width / max(w, h)
        if scale < 1.0:
            frame = cv2.resize(frame, (max(1, int(w * scale)), max(1, int(h * scale))))
        ok_enc, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 55])
        if ok_enc:
            out.append(buf.tobytes())
    cap.release()
    return out


def _evenly_spaced_indices(total: int, n: int) -> list[int]:
    if n <= 1:
        return [max(0, total // 2)]
    if total <= n:
        return list(range(total))
    step = max(1, (total - 1) // (n - 1))
    return [min(total - 1, i * step) for i in range(n)]


def _parse_advice(raw: dict[str, Any], est_cost: float, trigger_reason: str) -> VisionLayoutAdvice:
    layout = str(raw.get("recommendedLayout") or "speaker_follow").strip()
    if layout not in _LAYOUT_ENUM:
        layout = "speaker_follow"
    n = max(0, min(8, int(raw.get("personCount") or 0)))
    conf = float(raw.get("confidence") or 0.0)
    return VisionLayoutAdvice(
        person_count=n,
        recommended_layout=layout,
        confidence=max(0.0, min(1.0, conf)),
        has_corner_webcam_over_gameplay=bool(raw.get("hasCornerWebcamOverGameplay")),
        is_screen_share=bool(raw.get("isScreenShare")),
        est_cost_usd=est_cost,
        trigger_reason=trigger_reason,
    )


def call_vision_layout_gemini(jpegs: list[bytes], *, audio_speaker_count: int | None) -> dict[str, Any]:
    if not jpegs:
        raise RuntimeError("no_frames")
    model = _layout_model()
    parts: list[dict] = []
    for i, jpeg in enumerate(jpegs):
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(jpeg).decode()}})
        parts.append({"text": f"Frame {i + 1} of {len(jpegs)} (low resolution)."})
    spk_line = (
        f"Transcript diarization suggests {audio_speaker_count} speaker(s)."
        if audio_speaker_count
        else "Transcript speaker count unknown."
    )
    parts.append(
        {
            "text": (
                "You are routing a short social clip reframer. "
                f"{spk_line} "
                "Return JSON only. Count distinct people visible as speakers (not duplicate faces of one person). "
                "Corner webcam over gameplay/slides counts as ONE person — use screen_pip or speaker_follow, never split. "
                "Two people both on camera and conversing → split or dynamic. "
                "One talking head → speaker_follow. "
                "peoplePositions: short tags like left, center, corner_br, gameplay."
            ),
        }
    )
    res = requests.post(
        f"{GEMINI_BASE}/models/{model}:generateContent",
        params={"key": _key()},
        json={
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": _response_schema(),
                "temperature": 0.2,
            },
        },
        timeout=_TIMEOUT_S,
    )
    if not res.ok:
        raise RuntimeError(res.text[:300])
    data = res.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def maybe_vision_layout_advice(
    video: Path,
    summary: PersonCountSummary,
    *,
    words_path: Path | None = None,
    project_id: str | None = None,
    corner_webcam_hint: bool = False,
    screen_share_hint: bool = False,
) -> VisionLayoutAdvice | None:
    if not vision_layout_enabled():
        return None
    audio_n = transcript_speaker_count(words_path)
    should, reason = should_call_vision_layout(
        summary,
        audio_speaker_count=audio_n,
        corner_webcam_hint=corner_webcam_hint,
        screen_share_hint=screen_share_hint,
    )
    if not should:
        return None
    stats = _stats_for(project_id)
    stats["trigger_checks"] = int(stats.get("trigger_checks") or 0) + 1
    jpegs = sample_video_jpegs(video)
    if not jpegs:
        return None
    est_cost = len(jpegs) * _EST_USD_PER_FRAME
    if not _project_budget_ok(project_id, est_cost):
        return None
    stats["trigger_calls"] = int(stats.get("trigger_calls") or 0) + 1
    t0 = time.perf_counter()
    try:
        raw = call_vision_layout_gemini(jpegs, audio_speaker_count=audio_n)
        advice = _parse_advice(raw, est_cost, reason)
        _record_project_spend(project_id, est_cost)
        stats["trigger_success"] = int(stats.get("trigger_success") or 0) + 1
        stats["est_usd"] = float(stats.get("est_usd") or 0.0) + est_cost
        ms = int((time.perf_counter() - t0) * 1000)
        print(
            f"[clipper:vision] ok ms={ms} est_usd={est_cost:.5f} trigger={reason} "
            f"probe_n={summary.n_persons} probe_conf={summary.confidence:.3f} "
            f"vision_n={advice.person_count} layout={advice.recommended_layout} "
            f"vision_conf={advice.confidence:.3f} corner_pip={advice.has_corner_webcam_over_gameplay} "
            f"project={project_id or '-'}",
            flush=True,
        )
        return advice
    except Exception as exc:
        ms = int((time.perf_counter() - t0) * 1000)
        print(
            f"[clipper:vision] fallback ms={ms} trigger={reason} err={type(exc).__name__} project={project_id or '-'}",
            flush=True,
        )
        return None


def apply_vision_layout_to_summary(
    summary: PersonCountSummary,
    advice: VisionLayoutAdvice,
) -> PersonCountSummary:
    conf = max(summary.confidence, advice.confidence * 0.85)
    n = advice.person_count
    if advice.has_corner_webcam_over_gameplay or advice.is_screen_share:
        n = min(n, 1) if n <= 2 else n
    return PersonCountSummary(
        n_persons=max(0, n),
        confidence=conf,
        mean_embed_coverage=summary.mean_embed_coverage,
    )


def layout_from_vision_advice(
    advice: VisionLayoutAdvice,
    user_layout: str,
    summary: PersonCountSummary,
) -> tuple[str, bool]:
    from clips_worker.layout_router import route_multiperson_layout

    if advice.is_screen_share or advice.has_corner_webcam_over_gameplay:
        if advice.person_count <= 1:
            return "screen_pip", True
    rec = advice.recommended_layout
    if rec == "screen_pip":
        return "screen_pip", True
    if rec in ("fit", "speaker_follow"):
        return rec if rec != "speaker_follow" else "speaker_follow", rec != "speaker_follow"
    adj = apply_vision_layout_to_summary(summary, advice)
    return route_multiperson_layout(adj, user_layout)
