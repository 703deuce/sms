"""Gemini Flash video-watch signal for clip finding (stream + regular)."""
from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import time
from pathlib import Path
from typing import Any

import requests

from clips_worker.gemini_vision import (
    GEMINI_BASE,
    _key,
    discover_video_picker_model,
    gemini_token_pricing_usd,
)
from clips_worker.stage_log import stage_begin, stage_end
from clips_worker.video_picker_prompt import (
    VISUAL_WATCH_PASS1_HINT,
    VISUAL_WATCH_PASS2_HINT,
    build_video_picker_system_prompt,
    min_moments_for_video,
)

_MIN_MOMENT_S = 5.0
_TIME_EPS_S = 0.35
_TIME_RE = re.compile(r"^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$|^(\d+(?:\.\d+)?)s?$")


def _time_field_to_seconds(val: Any, *, duration_s: float) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        s = val.strip().lower().rstrip("s")
        if not s:
            return None
        mm = re.match(r"^(\d+):(\d{1,2}(?:\.\d+)?)$", s)
        if mm:
            return int(mm.group(1)) * 60 + float(mm.group(2))
        m = _TIME_RE.match(s)
        if not m:
            try:
                return float(s)
            except ValueError:
                return None
        if m.group(4) is not None:
            return float(m.group(4))
        h = int(m.group(1) or 0)
        mi = int(m.group(2))
        sec = float(m.group(3))
        return h * 3600 + mi * 60 + sec
    return None


def _coerce_moment_row(row: Any, duration_s: float) -> dict | None:
    if not isinstance(row, dict):
        return None
    r = dict(row)
    for src, dst in (("start", "start_s"), ("end", "end_s"), ("peak", "peak_s"), ("hook", "hook_s")):
        if dst not in r and src in r:
            r[dst] = r[src]
    dur = max(1.0, float(duration_s))
    start = _time_field_to_seconds(r.get("start_s"), duration_s=dur)
    end = _time_field_to_seconds(r.get("end_s"), duration_s=dur)
    if start is None or end is None:
        return None
    peak = _time_field_to_seconds(r.get("peak_s"), duration_s=dur)
    hook = _time_field_to_seconds(r.get("hook_s"), duration_s=dur)
    if peak is None:
        peak = (start + end) / 2
    if hook is None:
        hook = start
    r["start_s"] = start
    r["end_s"] = end
    r["peak_s"] = peak
    r["hook_s"] = hook
    return r


def sanitize_raw_moments(raw_moments: list, duration_s: float) -> tuple[list[dict], dict[str, int]]:
    """Clamp/drop out-of-range model times instead of rejecting the whole response."""
    from clips_worker.decision_log import decision_log

    dur = max(1.0, float(duration_s))
    kept = clamped = dropped = 0
    valid: list[dict] = []
    for row in raw_moments:
        coerced = _coerce_moment_row(row, dur)
        if coerced is None:
            dropped += 1
            decision_log(
                "sanitize",
                "reject",
                reason="coerce_failed",
                input=_sanitize_moment_preview(row),
            )
            continue
        row = coerced
        try:
            start = float(row.get("start_s", 0))
            end = float(row.get("end_s", start))
            peak = float(row.get("peak_s", (start + end) / 2))
            hook = float(row.get("hook_s", start))
        except (TypeError, ValueError):
            dropped += 1
            decision_log("sanitize", "reject", reason="time_parse", input=_sanitize_moment_preview(row))
            continue
        if start >= dur - 3:
            dropped += 1
            decision_log(
                "sanitize",
                "reject",
                reason="start_near_eof",
                start_s=start,
                duration_s=dur,
            )
            continue
        orig = (start, end, peak, hook)
        start = max(0.0, start)
        end = min(end, dur)
        peak = _clamp(peak, start, max(start, end - 0.001))
        hook = _clamp(hook, start, max(start, peak))
        if end - start < _MIN_MOMENT_S:
            start = max(0.0, end - _MIN_MOMENT_S)
        if end - start < _MIN_MOMENT_S:
            dropped += 1
            decision_log("sanitize", "reject", reason="span_too_short", start_s=start, end_s=end)
            continue
        if (round(start, 3), round(end, 3), round(peak, 3), round(hook, 3)) != (
            round(orig[0], 3),
            round(min(orig[1], dur), 3),
            round(orig[2], 3),
            round(orig[3], 3),
        ):
            clamped += 1
            decision_log(
                "sanitize",
                "clamp",
                start_s_before=orig[0],
                end_s_before=orig[1],
                start_s_after=start,
                end_s_after=end,
            )
        valid.append(
            {
                **row,
                "start_s": start,
                "end_s": end,
                "peak_s": peak,
                "hook_s": hook,
            }
        )
        kept += 1
        decision_log(
            "sanitize",
            "keep",
            start_s=start,
            end_s=end,
            peak_s=peak,
            hook_s=hook,
            score=row.get("score"),
        )
    stats = {"kept": kept, "clamped": clamped, "dropped": dropped}
    decision_log("sanitize", "summary", **stats, duration_s=dur)
    return valid, stats


def _sanitize_moment_preview(row: Any) -> dict[str, Any]:
    if not isinstance(row, dict):
        return {"type": type(row).__name__}
    return {
        k: row.get(k)
        for k in ("start_s", "end_s", "peak_s", "hook_s", "score", "what_happened")
        if k in row
    }


_CATEGORY_ITEM = {"type": "string"}

WATCH_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "sections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start_s": {"type": "number"},
                    "end_s": {"type": "number"},
                    "activity": {"type": "string"},
                },
                "required": ["start_s", "end_s", "activity"],
            },
        },
        "moments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start_s": {"type": "number"},
                    "end_s": {"type": "number"},
                    "peak_s": {"type": "number"},
                    "hook_s": {"type": "number"},
                    "category": {"type": "array", "items": _CATEGORY_ITEM},
                    "what_happened": {"type": "string"},
                    "unverified": {"type": "string"},
                    "confidence": {"type": "number"},
                    "why_it_works": {"type": "string"},
                    "touches_edge": {
                        "type": "string",
                        "enum": ["none", "start", "end", "both"],
                    },
                    "score": {"type": "number"},
                },
                "required": [
                    "start_s",
                    "end_s",
                    "peak_s",
                    "hook_s",
                    "category",
                    "what_happened",
                    "unverified",
                    "confidence",
                    "why_it_works",
                    "touches_edge",
                    "score",
                ],
            },
        },
    },
    "required": ["sections", "moments"],
}

# Back-compat alias
MOMENTS_SCHEMA = WATCH_RESPONSE_SCHEMA


def video_picker_enabled() -> bool:
    raw = (os.environ.get("VIDEO_PICKER_ENABLED") or "true").strip().lower()
    return raw not in ("0", "false", "no", "off")


def video_picker_timeout_s() -> float:
    try:
        return max(15.0, float(os.environ.get("VIDEO_PICKER_TIMEOUT_S", "90")))
    except ValueError:
        return 90.0


def video_picker_fps() -> float:
    try:
        return min(1.0, max(0.1, float(os.environ.get("VIDEO_PICKER_FPS", "0.5"))))
    except ValueError:
        return 0.5


def video_picker_user_part_order() -> str:
    # Google video-understanding: place text after the video/frames part (video_first).
    raw = (os.environ.get("VIDEO_PICKER_USER_PART_ORDER") or "video_first").strip().lower()
    if raw in ("transcript_first", "text_first", "transcript_before_video"):
        return "transcript_first"
    return "video_first"


def video_picker_burn_timecode() -> bool:
    raw = (os.environ.get("VIDEO_PICKER_BURN_TIMECODE") or "true").strip().lower()
    return raw not in ("0", "false", "no", "off")


def video_picker_fallback_model() -> str:
    from clips_worker.gemini_vision import DEFAULT_VIDEO_PICKER_FALLBACK_MODEL

    raw = os.environ.get("VIDEO_PICKER_FALLBACK_MODEL")
    if raw is not None and str(raw).strip().lower() in ("", "0", "false", "none", "off"):
        return ""
    return (raw or DEFAULT_VIDEO_PICKER_FALLBACK_MODEL).strip()


def video_picker_labeled_frames() -> bool:
    raw = (os.environ.get("VIDEO_PICKER_LABELED_FRAMES") or "true").strip().lower()
    return raw not in ("0", "false", "no", "off")


def video_picker_keep_audio() -> bool:
    """Picker proxies always keep audio for Gemini (original audio + transcript)."""
    raw = (os.environ.get("VIDEO_PICKER_KEEP_AUDIO") or "true").strip().lower()
    if raw in ("0", "false", "no", "off"):
        return False
    return True


def video_picker_media_resolution() -> str:
    raw = (os.environ.get("VIDEO_PICKER_MEDIA_RES") or "MEDIA_RESOLUTION_LOW").strip().upper()
    if raw in ("LOW", "MEDIA_RESOLUTION_LOW"):
        return "MEDIA_RESOLUTION_LOW"
    if raw in ("MEDIUM", "MEDIA_RESOLUTION_MEDIUM"):
        return "MEDIA_RESOLUTION_MEDIUM"
    if raw in ("HIGH", "MEDIA_RESOLUTION_HIGH"):
        return "MEDIA_RESOLUTION_HIGH"
    return raw if raw.startswith("MEDIA_RESOLUTION_") else "MEDIA_RESOLUTION_LOW"


def video_picker_stream_overlap_s() -> float:
    try:
        v = float(os.environ.get("VIDEO_PICKER_STREAM_OVERLAP_S", "45"))
    except ValueError:
        v = 45.0
    return max(30.0, min(60.0, v))


def estimate_gemini_usd(prompt_tokens: int, output_tokens: int, model: str = "") -> float:
    in_per_m, out_per_m = gemini_token_pricing_usd(model)
    return (prompt_tokens / 1_000_000) * in_per_m + (output_tokens / 1_000_000) * out_per_m


def _gemini_omits_legacy_sampling(model: str) -> bool:
    """Gemini 3+ generateContent rejects legacy temperature/top_p on some models."""
    m = (model or "").lower()
    return m.startswith("gemini-3.") or m.startswith("gemini-4.")


def _picker_timecode_font() -> str:
    candidates = [
        "/usr/share/fonts/truetype/montserrat/Montserrat-Black.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        if Path(path).is_file():
            return path
    return candidates[0]


def _watch_proxy_video_filter() -> str:
    scale = "scale=360:-2:flags=fast_bilinear"
    if not video_picker_burn_timecode():
        return scale
    font = _picker_timecode_font().replace(":", "\\:")
    # pts:hms = HH:MM:SS from first frame of this proxy (matches start_s/end_s).
    tc = (
        f"drawtext=fontfile={font}:text='%{{pts\\:hms}}':fontsize=22:fontcolor=white:"
        f"box=1:boxcolor=black@0.62:boxborderw=8:x=12:y=12"
    )
    return f"{scale},{tc}"


def make_watch_proxy(
    src: Path,
    dest: Path,
    start_s: float = 0.0,
    end_s: float | None = None,
) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-v", "error"]
    if start_s > 0.01:
        cmd.extend(["-ss", f"{start_s:.3f}"])
    cmd.extend(["-i", str(src)])
    if end_s is not None and end_s > start_s:
        cmd.extend(["-t", f"{end_s - start_s:.3f}"])
    vf = _watch_proxy_video_filter()
    if video_picker_keep_audio():
        cmd.extend(
            [
                "-vf",
                vf,
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-crf",
                "32",
                "-c:a",
                "aac",
                "-b:a",
                "64k",
                "-movflags",
                "+faststart",
                str(dest),
            ]
        )
    else:
        cmd.extend(
            [
                "-vf",
                vf,
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-crf",
                "32",
                "-an",
                "-movflags",
                "+faststart",
                str(dest),
            ]
        )
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def max_span_seconds(target_clip_len_s: int | None) -> float:
    return 90.0 if target_clip_len_s is None else float(target_clip_len_s)


def _format_mmss(seconds: float) -> str:
    sec = max(0.0, float(seconds))
    m = int(sec // 60)
    s = sec % 60.0
    return f"{m}:{s:04.1f}"


def format_timestamped_transcript(
    sentences: list[Any],
    range_start_ms: int,
    range_end_ms: int,
) -> str:
    lines: list[str] = []
    for s in sentences:
        end_ms = int(getattr(s, "end_ms", 0))
        start_ms = int(getattr(s, "start_ms", 0))
        if end_ms < range_start_ms or start_ms > range_end_ms:
            continue
        t = (start_ms - range_start_ms) / 1000.0
        end_t = (end_ms - range_start_ms) / 1000.0
        text = str(getattr(s, "text", "") or "").strip()
        if text:
            lines.append(f"[{_format_mmss(t)} | {t:.2f}s–{end_t:.2f}s] {text}")
    return "\n".join(lines) if lines else "(no transcript lines in this range)"


def _apply_max_span(
    start: float,
    end: float,
    peak: float,
    hook: float,
    max_span_s: float,
) -> tuple[float, float, float, float]:
    if end - start <= max_span_s:
        return start, end, peak, hook
    end = start + max_span_s
    peak = min(peak, end - 0.01)
    hook = min(hook, peak)
    hook = max(hook, start)
    return start, end, peak, hook


def _moment_span_s(moment: dict) -> tuple[float, float]:
    return float(moment["start_s"]), float(moment["end_s"])


def _span_overlap_fraction(a: tuple[float, float], b: tuple[float, float]) -> float:
    lo = max(a[0], b[0])
    hi = min(a[1], b[1])
    if hi <= lo:
        return 0.0
    overlap = hi - lo
    shorter = min(a[1] - a[0], b[1] - b[0])
    return overlap / max(shorter, 0.001)


def dedupe_overlapping_video_picker_moments(
    moments: list[dict],
    *,
    overlap_threshold: float | None = None,
    stage: str = "dedupe",
) -> list[dict]:
    """Drop overlapping spans; keep higher score (counts as one beat toward min_moments)."""
    from clips_worker.decision_log import decision_log
    from clips_worker.overlap_policy import PICK_OVERLAP_RATIO

    if overlap_threshold is None:
        overlap_threshold = PICK_OVERLAP_RATIO

    ranked = sorted(moments, key=lambda m: -float(m.get("score") or 0))
    kept: list[dict] = []
    for m in ranked:
        span = _moment_span_s(m)
        beat: dict | None = None
        beat_frac = 0.0
        for k in kept:
            frac = _span_overlap_fraction(span, _moment_span_s(k))
            if frac > overlap_threshold:
                beat = k
                beat_frac = frac
                break
        if beat is not None:
            decision_log(
                stage,
                "drop",
                overlap_fraction=round(beat_frac, 4),
                dropped_start_s=span[0],
                dropped_end_s=span[1],
                dropped_score=float(m.get("score") or 0),
                kept_start_s=float(beat.get("start_s", 0)),
                kept_end_s=float(beat.get("end_s", 0)),
                kept_score=float(beat.get("score") or 0),
            )
            continue
        kept.append(m)
        decision_log(
            stage,
            "keep",
            start_s=span[0],
            end_s=span[1],
            score=float(m.get("score") or 0),
        )
    kept.sort(key=lambda x: -float(x.get("score") or 0))
    return kept


def validate_and_normalize_moments(
    raw: list[dict],
    duration_s: float,
    *,
    chunk_offset_s: float = 0.0,
    max_span_s: float | None = None,
) -> tuple[list[dict], dict[str, int]]:
    """Clamp times, enforce ordering, drop spans <5s; add legacy t_s/reason fields."""
    from clips_worker.decision_log import decision_log

    dur = max(1.0, float(duration_s))
    out: list[dict] = []
    rejects: dict[str, int] = {}
    for row in raw:
        coerced = _coerce_moment_row(row, dur)
        if coerced is None:
            rejects["coerce_failed"] = rejects.get("coerce_failed", 0) + 1
            decision_log("normalize", "reject", reason="coerce_failed", input=_sanitize_moment_preview(row))
            continue
        row = coerced
        try:
            start = _clamp(float(row.get("start_s", 0)), 0.0, dur)
            end = _clamp(float(row.get("end_s", start)), 0.0, dur)
            peak = float(row.get("peak_s", (start + end) / 2))
            hook = float(row.get("hook_s", start))
        except (TypeError, ValueError):
            rejects["time_parse"] = rejects.get("time_parse", 0) + 1
            decision_log("normalize", "reject", reason="time_parse", input=_sanitize_moment_preview(row))
            continue
        if end <= start or (end - start) < _MIN_MOMENT_S:
            rejects["span_too_short"] = rejects.get("span_too_short", 0) + 1
            decision_log(
                "normalize",
                "reject",
                reason="span_too_short",
                start_s=start,
                end_s=end,
            )
            continue
        peak = _clamp(peak, 0.0, dur - 0.001)
        hook = _clamp(hook, 0.0, dur)
        start = _clamp(start, 0.0, dur)
        end = _clamp(end, 0.0, dur)
        if not (start <= hook <= peak < end):
            hook = _clamp(hook, start, end - 0.001)
            peak = _clamp(peak, hook, end - 0.001)
            if not (start <= hook <= peak < end):
                peak = _clamp((start + end) / 2, start + 0.001, end - 0.001)
                hook = _clamp(start + 0.5 * (peak - start), start, peak)
        trim_applied = False
        if max_span_s is not None and max_span_s > 0:
            ns, ne, np, nh = start, end, peak, hook
            start, end, peak, hook = _apply_max_span(start, end, peak, hook, max_span_s)
            if (ns, ne) != (start, end):
                trim_applied = True
                decision_log(
                    "normalize",
                    "max_span_trim",
                    start_s_before=ns,
                    end_s_before=ne,
                    start_s_after=start,
                    end_s_after=end,
                    max_span_s=max_span_s,
                )
        if not (start <= hook <= peak < end):
            rejects["hook_peak_order"] = rejects.get("hook_peak_order", 0) + 1
            decision_log(
                "normalize",
                "reject",
                reason="hook_peak_order",
                start_s=start,
                end_s=end,
                hook_s=hook,
                peak_s=peak,
            )
            continue
        score = max(0.0, min(1.0, float(row.get("score") or 0)))
        edge = str(row.get("touches_edge") or "none").lower()
        if edge not in ("none", "start", "end", "both"):
            edge = "none"
        conf = max(0.0, min(1.0, float(row.get("confidence") or 0.5)))
        unverified = str(row.get("unverified") or "").strip()[:500]
        cats = row.get("category") or []
        if isinstance(cats, str):
            cats = [c.strip() for c in cats.split("+") if c.strip()]
        what = str(row.get("what_happened") or "").strip()
        why = str(row.get("why_it_works") or "").strip()
        m = {
            "start_s": round(start + chunk_offset_s, 3),
            "end_s": round(end + chunk_offset_s, 3),
            "peak_s": round(peak + chunk_offset_s, 3),
            "hook_s": round(hook + chunk_offset_s, 3),
            "category": list(cats)[:6],
            "what_happened": what[:1200],
            "unverified": unverified,
            "confidence": round(conf, 3),
            "why_it_works": why[:600],
            "touches_edge": edge,
            "score": round(score, 3),
            "t_s": round(peak + chunk_offset_s, 3),
            "reason": (what or why)[:200],
        }
        out.append(m)
        decision_log(
            "normalize",
            "keep",
            start_s=m["start_s"],
            end_s=m["end_s"],
            peak_s=m["peak_s"],
            hook_s=m["hook_s"],
            score=m["score"],
            max_span_trim=trim_applied,
        )
    out.sort(key=lambda x: -float(x.get("score") or 0))
    return out, rejects


def collect_time_violations(
    raw_sections: list[dict],
    raw_moments: list[dict],
    duration_s: float,
) -> list[str]:
    """Detect model times past video duration or inverted spans (before clamping)."""
    dur = max(1.0, float(duration_s))
    violations: list[str] = []

    def _check(label: str, key: str, raw_val: Any) -> None:
        try:
            v = float(raw_val)
        except (TypeError, ValueError):
            violations.append(f"{label}.{key}=non_numeric")
            return
        if v > dur + _TIME_EPS_S:
            violations.append(f"{label}.{key}={v:.3f}>{dur:.3f}")
        if v < -_TIME_EPS_S:
            violations.append(f"{label}.{key}={v:.3f}<0")

    for i, sec in enumerate(raw_sections):
        if not isinstance(sec, dict):
            continue
        _check(f"section[{i}]", "start_s", sec.get("start_s", 0))
        _check(f"section[{i}]", "end_s", sec.get("end_s", sec.get("start_s", 0)))
        try:
            a = float(sec.get("start_s", 0))
            b = float(sec.get("end_s", a))
            if b < a - _TIME_EPS_S:
                violations.append(f"section[{i}] inverted {a:.3f}-{b:.3f}")
        except (TypeError, ValueError):
            pass

    for i, row in enumerate(raw_moments):
        if not isinstance(row, dict):
            continue
        for key in ("start_s", "end_s", "peak_s", "hook_s"):
            if key in row and row.get(key) is not None:
                _check(f"moment[{i}]", key, row.get(key))
    return violations


def normalize_sections(raw: list[dict], duration_s: float) -> list[dict]:
    dur = max(1.0, float(duration_s))
    out: list[dict] = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        try:
            start = _clamp(float(row.get("start_s", 0)), 0.0, dur)
            end = _clamp(float(row.get("end_s", start)), 0.0, dur)
        except (TypeError, ValueError):
            continue
        if end <= start + 0.01:
            continue
        activity = str(row.get("activity") or "").strip()[:240]
        out.append(
            {
                "start_s": round(start, 3),
                "end_s": round(end, 3),
                "activity": activity,
            }
        )
    out.sort(key=lambda s: float(s["start_s"]))
    return out


def attach_absolute_ms(moments: list[dict], range_start_ms: int) -> None:
    for m in moments:
        try:
            m["start_ms"] = range_start_ms + int(float(m["start_s"]) * 1000)
            m["end_ms"] = range_start_ms + int(float(m["end_s"]) * 1000)
            m["peak_ms"] = range_start_ms + int(float(m["peak_s"]) * 1000)
            m["hook_ms"] = range_start_ms + int(float(m["hook_s"]) * 1000)
            m["t_ms"] = m["peak_ms"]
        except (TypeError, ValueError):
            pass


def moment_abs_span_ms(moment: dict, range_start_ms: int = 0) -> tuple[int, int]:
    if moment.get("start_ms") is not None and moment.get("end_ms") is not None:
        return int(moment["start_ms"]), int(moment["end_ms"])
    try:
        lo = range_start_ms + int(float(moment.get("start_s", moment.get("t_s", 0))) * 1000)
        hi = range_start_ms + int(float(moment.get("end_s", moment.get("t_s", 0))) * 1000)
        if hi > lo:
            return lo, hi
    except (TypeError, ValueError):
        pass
    t = absolute_moment_ms(moment, range_start_ms)
    return t, t + 1000


def moments_to_per_second(moments: list[dict], duration_s: int) -> list[float]:
    n = max(1, duration_s)
    curve = [0.0] * n
    for m in moments:
        try:
            sc = float(m.get("score") or 0)
            peak = int(float(m.get("peak_s") or m.get("t_s") or 0))
            start = int(float(m.get("start_s") or peak))
            end = int(float(m.get("end_s") or peak + 1))
        except (TypeError, ValueError):
            continue
        sc = max(0.0, min(1.0, sc))
        for ti in range(max(0, start), min(n, end + 1)):
            decay = 1.0 if ti == peak else 0.65
            curve[ti] = max(curve[ti], sc * decay)
    return curve


def absolute_moment_ms(moment: dict, range_start_ms: int = 0) -> int:
    if moment.get("peak_ms") is not None:
        return int(moment["peak_ms"])
    if moment.get("t_ms") is not None:
        return int(moment["t_ms"])
    try:
        return range_start_ms + int(float(moment.get("peak_s") or moment.get("t_s") or 0) * 1000)
    except (TypeError, ValueError):
        return range_start_ms


def format_moments_for_llm(moments: list[dict], limit: int = 40) -> str:
    lines: list[str] = []
    for m in moments[:limit]:
        try:
            ss = float(m.get("start_s", 0))
            es = float(m.get("end_s", ss))
            peak = float(m.get("peak_s") or m.get("t_s") or ss)
            hook = float(m.get("hook_s") or ss)
            sc = float(m.get("score") or 0)
        except (TypeError, ValueError):
            continue
        cats = m.get("category") or []
        cat_s = ",".join(cats) if isinstance(cats, list) else str(cats)
        what = str(m.get("what_happened") or m.get("reason") or "").strip()[:220]
        edge = m.get("touches_edge") or "none"
        if what:
            lines.append(
                f"- {ss:.1f}-{es:.1f}s peak={peak:.1f} hook={hook:.1f} score={sc:.2f} "
                f"[{cat_s}] edge={edge}: {what}"
            )
    return "\n".join(lines)


def format_moments_for_window(
    moments: list[dict],
    lo_ms: int,
    hi_ms: int,
    *,
    range_start_ms: int = 0,
    pad_ms: int = 0,
    limit: int = 24,
) -> str:
    """Moments whose span overlaps the transcript chunk (not point-in-pad)."""
    picked: list[dict] = []
    for m in moments:
        s_ms, e_ms = moment_abs_span_ms(m, range_start_ms)
        if e_ms < lo_ms - pad_ms or s_ms > hi_ms + pad_ms:
            continue
        rel = dict(m)
        rel["start_s"] = (s_ms - range_start_ms) / 1000.0
        rel["end_s"] = (e_ms - range_start_ms) / 1000.0
        picked.append(rel)
    return format_moments_for_llm(picked, limit=limit)


def merge_stream_moments(moments: list[dict], overlap_s: float) -> list[dict]:
    """Dedupe by peak_s within overlap; stitch touches_edge pairs when adjacent."""
    if not moments:
        return []
    ranked = sorted(moments, key=lambda m: -float(m.get("score") or 0))
    kept: list[dict] = []
    for m in ranked:
        try:
            peak = float(m.get("peak_s"))
        except (TypeError, ValueError):
            continue
        if any(abs(peak - float(k.get("peak_s") or 0)) < overlap_s for k in kept):
            continue
        kept.append(dict(m))
    kept.sort(key=lambda m: float(m.get("start_s") or 0))
    stitched: list[dict] = []
    i = 0
    while i < len(kept):
        cur = dict(kept[i])
        if i + 1 < len(kept):
            nxt = kept[i + 1]
            cur_edge = cur.get("touches_edge")
            nxt_edge = nxt.get("touches_edge")
            if cur_edge in ("end", "both") and nxt_edge in ("start", "both"):
                try:
                    if float(nxt.get("start_s")) - float(cur.get("end_s")) < overlap_s * 2:
                        merged = dict(cur)
                        merged["end_s"] = max(float(cur["end_s"]), float(nxt["end_s"]))
                        merged["peak_s"] = max(float(cur["peak_s"]), float(nxt["peak_s"]))
                        merged["score"] = max(float(cur.get("score") or 0), float(nxt.get("score") or 0)) * 0.95
                        merged["touches_edge"] = "none"
                        merged["what_happened"] = (
                            f"{cur.get('what_happened', '')} | {nxt.get('what_happened', '')}"
                        )[:1200]
                        merged["t_s"] = merged["peak_s"]
                        merged["reason"] = str(merged.get("what_happened") or "")[:200]
                        stitched.append(merged)
                        i += 2
                        continue
                except (TypeError, ValueError):
                    pass
        stitched.append(cur)
        i += 1
    return stitched


def resolve_video_picker_stream_ranges(duration_ms: int) -> list[tuple[int, int]]:
    """One picker call per analyzed slice (no overlap chunking for short VODs)."""
    dur = max(1, int(duration_ms))
    if dur <= 20 * 60_000:
        return [(0, dur)]
    from clips_worker.streamer.chunking import plan_chunks

    try:
        chunk_min = max(5, int(os.environ.get("VIDEO_PICKER_STREAM_CHUNK_MIN", "15")))
    except ValueError:
        chunk_min = 15
    chunk_ms = chunk_min * 60_000
    overlap_ms = int(video_picker_stream_overlap_s() * 1000)
    return plan_chunks(dur, chunk_ms, overlap_ms)


def _gemini_transient_status(status: int) -> bool:
    # 429 is quota — retrying burns free-tier budget; fall through to lite model instead.
    return status in (503, 502, 504) or status >= 500


_GEMINI_TRANSIENT_BACKOFF_S = (2.0, 5.0, 12.0, 25.0)


def _log_video_picker_model_fallback(
    *,
    chunk_label: str,
    from_model: str,
    to_model: str,
    reason: str,
    status: int | None = None,
) -> None:
    print(
        f"[clipper:video_picker] ERROR {json.dumps({'event': 'model_fallback', 'chunk': chunk_label, 'from': from_model, 'to': to_model, 'reason': reason, 'status': status})}",
        flush=True,
    )


def _gemini_post_watch(
    active_model: str,
    payload: dict[str, Any],
) -> tuple[requests.Response | None, str, int | None]:
    """POST with transient backoff; returns (response, last_err, last_status)."""
    from clips_worker.picker.picker_errors import gemini_error_log_fields

    last_err = "unknown"
    last_status: int | None = None
    res: requests.Response | None = None
    for _attempt, backoff_s in enumerate(_GEMINI_TRANSIENT_BACKOFF_S):
        try:
            res = requests.post(
                f"{GEMINI_BASE}/models/{active_model}:generateContent",
                params={"key": _key()},
                json=payload,
                timeout=video_picker_timeout_s(),
            )
            last_status = res.status_code
            if res.ok:
                return res, last_err, last_status
            if _gemini_transient_status(res.status_code):
                err_body = res.text or res.reason or "error"
                summary, _quota = gemini_error_log_fields(err_body)
                last_err = summary or err_body[:300]
                time.sleep(backoff_s)
                continue
            err_body = res.text or res.reason or "error"
            summary, _quota = gemini_error_log_fields(err_body)
            last_err = summary or err_body[:300]
            return res, last_err, last_status
        except Exception as exc:
            last_err = str(exc)[:300]
            if _gemini_transient_exc(exc):
                time.sleep(backoff_s)
                continue
            return None, last_err, last_status
    return res, last_err, last_status


def _gemini_transient_exc(exc: Exception) -> bool:
    if isinstance(exc, (requests.Timeout, requests.ConnectionError)):
        return True
    name = type(exc).__name__
    return "Timeout" in name or "Connection" in name


def _log_min_moments_shortfall(duration_s: int, count: int, chunk_label: str) -> None:
    need = min_moments_for_video(int(duration_s))
    if count < need:
        print(
            f"[clipper:video_picker] WARNING min_moments_required={need} moments_returned={count} "
            f"chunk={chunk_label} (keeping model output; no filler)",
            flush=True,
        )


def _extract_watch_audio_b64(video_path: Path, scratch: Path) -> tuple[str, str]:
    """Return (mime_type, base64) for audio muxed from the watch proxy."""
    out = scratch / "watch_audio.m4a"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video_path),
            "-vn",
            "-acodec",
            "copy",
            str(out),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    raw = out.read_bytes()
    if len(raw) < 64:
        wav = scratch / "watch_audio.wav"
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-i",
                str(video_path),
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                str(wav),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        raw = wav.read_bytes()
        return "audio/wav", base64.b64encode(raw).decode("ascii")
    return "audio/mp4", base64.b64encode(raw).decode("ascii")


def _extract_labeled_frames(
    video_path: Path,
    scratch: Path,
    *,
    duration_s: float,
    fps: float,
) -> list[tuple[float, bytes]]:
    out_dir = scratch / "vp_frames"
    if out_dir.is_dir():
        for old in out_dir.glob("f_*.jpg"):
            old.unlink(missing_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    pattern = str(out_dir / "f_%05d.jpg")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(video_path),
            "-vf",
            f"fps={fps}",
            "-q:v",
            "8",
            pattern,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    frames: list[tuple[float, bytes]] = []
    dur = max(1.0, float(duration_s))
    for i, path in enumerate(sorted(out_dir.glob("f_*.jpg"))):
        t = round(i / fps, 3)
        if t > dur + (1.0 / fps):
            break
        frames.append((t, path.read_bytes()))
    return frames


def _labeled_frame_user_parts(
    video_path: Path,
    scratch: Path,
    *,
    duration_s: int,
    user_text: str,
    fps: float,
    part_order: str,
) -> list[dict[str, Any]]:
    frames = _extract_labeled_frames(video_path, scratch, duration_s=float(duration_s), fps=fps)
    if not frames:
        raise RuntimeError("video_picker labeled_frames: no frames extracted")
    audio_mime, audio_b64 = _extract_watch_audio_b64(video_path, scratch)
    frame_parts: list[dict[str, Any]] = [
        {
            "text": (
                f"Visual timeline: {len(frames)} frames at {fps} fps (LOW). "
                "Each [t=…] label is the exact second for the following image.\n"
            ),
        },
    ]
    for t, jpeg in frames:
        frame_parts.append({"text": f"[t={t:.1f}s]"})
        frame_parts.append(
            {
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": base64.b64encode(jpeg).decode("ascii"),
                },
            }
        )
    frame_parts.append({"text": "Original audio for the same timeline (use with transcript):"})
    frame_parts.append({"inline_data": {"mime_type": audio_mime, "data": audio_b64}})
    text_part = {"text": user_text}
    if part_order == "transcript_first":
        return [text_part, *frame_parts]
    return [*frame_parts, text_part]


def _gemini_watch_payload(
    video_path: Path,
    duration_s: int,
    *,
    system: str,
    user_text: str,
    fps: float | None = None,
    media_resolution: str | None = None,
    part_order: str | None = None,
    model: str = "",
    scratch: Path | None = None,
    use_labeled_frames: bool | None = None,
) -> dict[str, Any]:
    use_fps = fps if fps is not None else video_picker_fps()
    order = part_order or video_picker_user_part_order()
    work = scratch or video_path.parent
    labeled = video_picker_labeled_frames() if use_labeled_frames is None else use_labeled_frames
    if labeled:
        user_parts = _labeled_frame_user_parts(
            video_path,
            work,
            duration_s=duration_s,
            user_text=user_text,
            fps=use_fps,
            part_order=order,
        )
    else:
        raw_bytes = video_path.read_bytes()
        if len(raw_bytes) > 18 * 1024 * 1024:
            slim = video_path.parent / f"{video_path.stem}_slim.mp4"
            make_watch_proxy(video_path, slim, 0.0, float(duration_s))
            raw_bytes = slim.read_bytes()
        b64 = base64.b64encode(raw_bytes).decode("ascii")
        # Full-span proxy already trimmed to duration_s — omit start/end offsets (avoid double timeline).
        vmeta: dict[str, Any] = {"fps": use_fps}
        part: dict[str, Any] = {
            "inline_data": {"mime_type": "video/mp4", "data": b64},
            "video_metadata": vmeta,
        }
        text_part = {"text": user_text}
        user_parts = [text_part, part] if order == "transcript_first" else [part, text_part]
    gen_cfg: dict[str, Any] = {
        "responseMimeType": "application/json",
        "responseSchema": WATCH_RESPONSE_SCHEMA,
        "mediaResolution": media_resolution or video_picker_media_resolution(),
    }
    if not _gemini_omits_legacy_sampling(model):
        gen_cfg["temperature"] = 0.35
    elif "3.8-flash" in (model or "").lower():
        # Faster/cheaper watch pass; medium is default on 3.8 but heavy for long video.
        gen_cfg["thinkingConfig"] = {"thinkingLevel": "low"}
    return {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": user_parts}],
        "generationConfig": gen_cfg,
    }


_gemini_daily_quota_exhausted: set[str] = set()


def _uncovered_section_labels(sections: list[dict], moments: list[dict], duration_s: float) -> list[str]:
    if not sections:
        return ["(no sections returned)"]
    covered: list[bool] = [False] * len(sections)
    for m in moments:
        try:
            ms = float(m.get("start_s", 0))
            me = float(m.get("end_s", ms))
        except (TypeError, ValueError):
            continue
        mid = (ms + me) / 2.0
        for i, sec in enumerate(sections):
            try:
                a = float(sec.get("start_s", 0))
                b = float(sec.get("end_s", a))
            except (TypeError, ValueError):
                continue
            if a <= mid <= b:
                covered[i] = True
    out: list[str] = []
    for i, sec in enumerate(sections):
        if covered[i]:
            continue
        act = str(sec.get("activity") or "section")[:80]
        out.append(f"{sec.get('start_s', 0):.0f}-{sec.get('end_s', 0):.0f}s {act}")
    return out


def remember_gemini_daily_quota(model: str, quota: dict | None) -> None:
    if not quota:
        return
    qid = str(quota.get("quotaId") or "")
    if "PerDay" in qid or "per_day" in qid.lower() or "PerDay" in str(quota.get("quotaMetric") or ""):
        _gemini_daily_quota_exhausted.add(model)


def gemini_model_skipped_daily_quota(model: str) -> bool:
    return model in _gemini_daily_quota_exhausted


def _transcript_slice_for_window(transcript_text: str, lo_s: float, hi_s: float) -> str:
    """Keep lines whose [t=…] falls in [lo_s, hi_s], re-based to 0..(hi-lo)."""
    if not transcript_text:
        return ""
    out: list[str] = []
    for line in transcript_text.splitlines():
        m = re.search(r"\[t=([\d.]+)\]", line)
        if not m:
            continue
        t = float(m.group(1))
        if t < lo_s - 0.05 or t > hi_s + 0.05:
            continue
        rel = t - lo_s
        out.append(re.sub(r"\[t=[\d.]+\]", f"[t={rel:.3f}]", line, count=1))
    return "\n".join(out) if out else transcript_text[:8000]


def _moment_overlaps_prior(candidate: dict, orig_start_s: float, orig_end_s: float, *, min_frac: float) -> bool:
    try:
        ns = float(candidate["start_s"])
        ne = float(candidate["end_s"])
    except (TypeError, ValueError, KeyError):
        return False
    lo = max(ns, orig_start_s)
    hi = min(ne, orig_end_s)
    if hi <= lo:
        return False
    overlap = hi - lo
    shorter = min(ne - ns, orig_end_s - orig_start_s)
    return overlap / max(shorter, 0.001) >= min_frac


def reassess_edge_moments(
    moments: list[dict],
    *,
    rel_duration_s: float,
    trim_start_s: float,
    trim_end_s: float,
    src_video: Path | None,
    scratch: Path | None,
    transcript_text: str,
    target_clip_len_s: int | None,
    chunk_label: str,
    is_single_chunk: bool = False,
) -> list[dict]:
    if not moments or src_video is None or scratch is None or not src_video.is_file():
        return moments
    pad = 55.0
    max_span = max_span_seconds(target_clip_len_s)
    from clips_worker.decision_log import decision_log

    out: list[dict] = []
    for m in moments:
        edge = str(m.get("touches_edge") or "none")
        if edge == "none":
            out.append(m)
            continue
        try:
            rs = float(m["start_s"])
            re = float(m["end_s"])
        except (TypeError, ValueError, KeyError):
            out.append(m)
            continue
        at_source_start = is_single_chunk and rs <= 1.5
        at_source_end = is_single_chunk and re >= rel_duration_s - 1.5
        if at_source_start or at_source_end:
            decision_log(
                "reassess_edge",
                "skip",
                chunk=chunk_label,
                edge=edge,
                reason="single_chunk_source_boundary",
            )
            out.append(m)
            continue
        abs_start = trim_start_s + rs
        abs_end = trim_start_s + re
        chunk_lo = float(trim_start_s)
        chunk_hi = float(trim_end_s)
        ext_lo = max(chunk_lo, abs_start - pad)
        ext_hi = min(chunk_hi, abs_end + pad)
        if edge in ("start", "both") and rs <= 1.5 and not is_single_chunk:
            ext_lo = max(0.0, chunk_lo - pad)
        if edge in ("end", "both") and re >= rel_duration_s - 1.5 and not is_single_chunk:
            ext_hi = min(chunk_hi + pad, chunk_hi + pad)
        ext_lo = max(0.0, min(ext_lo, chunk_hi))
        ext_hi = max(ext_lo + 1.0, min(ext_hi, chunk_hi))
        proxy = scratch / f"edge_reassess_{chunk_label}_{len(out)}.mp4"
        make_watch_proxy(src_video, proxy, ext_lo, ext_hi)
        ext_dur = max(1, int(ext_hi - ext_lo))
        rel_transcript = _transcript_slice_for_window(transcript_text, ext_lo, ext_hi)
        edge_user = (
            f"The video is exactly {float(ext_dur):.1f} seconds. Every timestamp must be between 0 and {float(ext_dur):.1f}.\n"
            "Reassess ONLY the prior moment below — adjust start_s/end_s/peak_s/hook_s at the edges if needed. "
            "Do NOT replace it with an unrelated beat. The updated moment MUST overlap the prior span on this timeline "
            f"(prior start_s={rs:.3f} end_s={re:.3f}). Return moments[] with zero or one entry.\n"
            f"Prior moment JSON:\n{json.dumps(m, default=str)[:4000]}\n\n"
            f"TIMESTAMPED TRANSCRIPT (seconds relative to t=0 of this {float(ext_dur):.1f}s proxy, "
            f"source offset {ext_lo:.3f}s):\n{rel_transcript[:12000]}"
        )
        reassessed, _meta = watch_video_file(
            proxy,
            duration_s=ext_dur,
            chunk_label=f"{chunk_label}_edge",
            target_clip_len_s=target_clip_len_s,
            transcript_text=rel_transcript,
            skip_edge_reassess=True,
            trim_start_s=ext_lo,
            trim_end_s=ext_hi,
            user_text_override=edge_user,
        )
        if reassessed:
            best = dict(reassessed[0])
            shift = ext_lo - trim_start_s
            for key in ("start_s", "end_s", "peak_s", "hook_s", "t_s"):
                try:
                    best[key] = round(float(best[key]) + shift, 3)
                except (TypeError, ValueError, KeyError):
                    pass
            if not _moment_overlaps_prior(best, rs, re, min_frac=0.25):
                decision_log(
                    "reassess_edge",
                    "keep_original",
                    chunk=chunk_label,
                    edge=edge,
                    reason="reassess_no_overlap",
                )
                out.append(m)
                continue
            normed, _rej = validate_and_normalize_moments(
                [best],
                rel_duration_s,
                chunk_offset_s=0.0,
                max_span_s=max_span,
            )
            if normed:
                merged = dict(normed[0])
                for key in (
                    "gemini_score",
                    "visual_score",
                    "from_visual_watch",
                    "from_visual",
                    "visual_origin",
                ):
                    if m.get(key) is not None and merged.get(key) is None:
                        merged[key] = m[key]
                decision_log(
                    "reassess_edge",
                    "changed",
                    chunk=chunk_label,
                    edge=edge,
                    before_start_s=rs,
                    before_end_s=re,
                    after_start_s=merged.get("start_s"),
                    after_end_s=merged.get("end_s"),
                )
                out.append(merged)
            elif float(m.get("confidence") or 0) >= 0.35:
                decision_log(
                    "reassess_edge",
                    "keep_original",
                    chunk=chunk_label,
                    edge=edge,
                    reason="reassess_empty_confident",
                )
                out.append(m)
            else:
                decision_log(
                    "reassess_edge",
                    "drop",
                    chunk=chunk_label,
                    edge=edge,
                    reason="reassess_empty_low_confidence",
                )
            continue
        if float(m.get("confidence") or 0) >= 0.35:
            decision_log(
                "reassess_edge",
                "keep_original",
                chunk=chunk_label,
                edge=edge,
                reason="reassess_no_result",
            )
            out.append(m)
        else:
            decision_log(
                "reassess_edge",
                "drop",
                chunk=chunk_label,
                edge=edge,
                reason="reassess_no_result_low_confidence",
            )
    return out or moments


def watch_video_file(
    video_path: Path,
    *,
    duration_s: int,
    chunk_label: str = "upload",
    target_clip_len_s: int | None = None,
    transcript_text: str = "",
    skip_edge_reassess: bool = False,
    source_video: Path | None = None,
    scratch: Path | None = None,
    trim_start_s: float = 0.0,
    trim_end_s: float | None = None,
    model_override: str | None = None,
    fps_override: float | None = None,
    media_resolution_override: str | None = None,
    user_part_order: str | None = None,
    fail_open: bool = True,
    use_labeled_frames: bool | None = None,
    user_text_override: str | None = None,
    is_single_chunk: bool = False,
) -> tuple[list[dict], dict[str, Any]]:
    """Gemini Flash video watch. Fail-open after retries unless fail_open=False."""
    meta: dict[str, Any] = {
        "chunk": chunk_label,
        "frames_est": 0,
        "prompt_tokens": 0,
        "output_tokens": 0,
        "est_usd": 0.0,
        "model": "",
        "ok": False,
        "target_clip_len_s": target_clip_len_s,
    }
    if not video_picker_enabled():
        return [], meta
    if not video_path.is_file() or video_path.stat().st_size < 1024:
        from clips_worker.picker.picker_errors import log_picker_error

        msg = f"video_picker input missing or too small path={video_path.name}"
        log_picker_error("gemini", msg, None)
        meta["error"] = msg
        return [], meta
    t0 = stage_begin("video_picker", chunk=chunk_label)
    from clips_worker.picker.picker_errors import gemini_error_log_fields, log_picker_error

    logged = False

    def _fail_open(err_msg: str, status: int | None = None, quota: dict[str, str] | None = None) -> tuple[list[dict], dict[str, Any]]:
        nonlocal logged
        if not logged:
            log_picker_error("gemini", err_msg, status, quota=quota)
            logged = True
        meta["error"] = err_msg[:200]
        if status is not None:
            meta["status"] = status
        if quota:
            meta["quota"] = quota
        stage_end("video_picker", t0, chunk=chunk_label, error=err_msg[:180], fail_open=True)
        return [], meta

    try:
        model = model_override or discover_video_picker_model()
        primary_model = model
        meta["model"] = model
        meta["model_requested"] = primary_model
        meta["input_mode"] = "labeled_frames" if video_picker_labeled_frames() else "video_mp4"
        fps = fps_override if fps_override is not None else video_picker_fps()
        meta["fps"] = fps
        meta["media_resolution"] = media_resolution_override or video_picker_media_resolution()
        meta["user_part_order"] = user_part_order or video_picker_user_part_order()
        print(
            f"[clipper:video_picker] {json.dumps({'event': 'video_picker_input', 'chunk': chunk_label, 'input_mode': meta['input_mode'], 'part_order': meta['user_part_order'], 'model_requested': primary_model, 'fps': fps})}",
            flush=True,
        )
        meta["frames_est"] = max(1, int(duration_s * fps))
        meta["frames_sent"] = meta["frames_est"] if video_picker_labeled_frames() else None
        meta["min_moments"] = min_moments_for_video(int(duration_s))
        system = build_video_picker_system_prompt(duration_s, target_clip_len_s)
        user_text_base = (
            f"The video is exactly {duration_s:.1f} seconds. Every timestamp must be between 0 and {duration_s:.1f}.\n\n"
            "Use the labeled frame timeline ([t=…] before each image), original audio, "
            "burned-in HH:MM:SS on each frame, and the timestamped transcript together.\n\n"
            f"TIMESTAMPED TRANSCRIPT:\n{transcript_text[:16000] if transcript_text else '(none)'}\n\n"
            f"Return sections and moments JSON for this video only ({duration_s}s max; "
            "all times must match [t=…] labels and transcript)."
        )
        if user_text_override:
            user_text_base = user_text_override
        fallback_model = video_picker_fallback_model()
        meta["burn_timecode"] = video_picker_burn_timecode()
        meta["fallback_model"] = fallback_model
        models_chain: list[str] = [primary_model]
        if fallback_model and fallback_model != primary_model:
            models_chain.append(fallback_model)

        last_err = "unknown"
        last_status: int | None = None
        last_fallback_reason = ""

        def _apply_usage(used_model: str, data: dict[str, Any]) -> None:
            usage = data.get("usageMetadata") or {}
            pt = int(usage.get("promptTokenCount") or 0)
            ot = int(usage.get("candidatesTokenCount") or 0)
            meta["prompt_tokens"] = pt
            meta["output_tokens"] = ot
            in_p, out_p = gemini_token_pricing_usd(used_model)
            meta["pricing_usd_per_1m"] = {"input": in_p, "output": out_p}
            meta["est_usd"] = round(estimate_gemini_usd(pt, ot, used_model), 6)

        from clips_worker.decision_log import decision_log, sanitize_model_json

        for model_idx, active_model in enumerate(models_chain):
            if gemini_model_skipped_daily_quota(active_model):
                last_fallback_reason = "daily_quota_exhausted"
                decision_log(
                    "video_picker",
                    "model_skipped",
                    model=active_model,
                    reason="daily_quota",
                )
                continue
            if model_idx > 0:
                meta["fallback_reason"] = last_fallback_reason
                _log_video_picker_model_fallback(
                    chunk_label=chunk_label,
                    from_model=primary_model,
                    to_model=active_model,
                    reason=last_fallback_reason,
                    status=last_status,
                )

            meta["model"] = active_model
            user_text = user_text_base
            time_invalid_retries = 1
            sections_moment_retries = 1
            shortfall_retries = 1
            parsed_ok: dict[str, Any] | None = None
            model_failed_reason = ""

            while parsed_ok is None:
                payload = _gemini_watch_payload(
                    video_path,
                    duration_s,
                    system=system,
                    user_text=user_text,
                    fps=fps,
                    media_resolution=meta["media_resolution"],
                    part_order=meta["user_part_order"],
                    model=active_model,
                    scratch=scratch or video_path.parent,
                    use_labeled_frames=use_labeled_frames,
                )
                upload_t0 = time.time()
                res, last_err, last_status = _gemini_post_watch(active_model, payload)
                meta["gen_ms"] = int((time.time() - upload_t0) * 1000)

                if res is None or not res.ok:
                    model_failed_reason = f"api_error status={last_status} err={last_err[:120]}"
                    err_body = (res.text if res is not None else last_err) or last_err
                    from clips_worker.picker.picker_errors import (
                        gemini_error_log_fields,
                        parse_retry_delay_seconds,
                    )

                    _summary, quota = gemini_error_log_fields(err_body)
                    if quota:
                        meta["quota"] = quota
                        remember_gemini_daily_quota(active_model, quota)
                    if last_status == 429 or "quota exceeded" in (last_err or "").lower():
                        meta["rate_limited"] = True
                        meta["status"] = last_status or 429
                        decision_log(
                            "video_picker",
                            "model_attempt",
                            model=active_model,
                            chunk=chunk_label,
                            status=last_status or 429,
                            ok=False,
                            retry_reason="rate_limited",
                            quota=quota,
                        )
                        if (
                            active_model == primary_model
                            and not meta.get("primary_429_retried")
                        ):
                            delay = parse_retry_delay_seconds(quota.get("retryDelay"))
                            if delay is not None and delay <= 60:
                                decision_log(
                                    "video_picker",
                                    "retry",
                                    model=active_model,
                                    chunk=chunk_label,
                                    retry_reason="429_retryDelay",
                                    sleep_s=round(delay, 2),
                                    quotaMetric=quota.get("quotaMetric"),
                                    quotaId=quota.get("quotaId"),
                                )
                                time.sleep(delay)
                                meta["primary_429_retried"] = True
                                continue
                    decision_log(
                        "video_picker",
                        "model_attempt",
                        model=active_model,
                        chunk=chunk_label,
                        status=last_status,
                        ok=False,
                        error=model_failed_reason[:200],
                    )
                    break

                try:
                    data = res.json()
                    _apply_usage(active_model, data)
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed_ok = json.loads(text)
                except (KeyError, IndexError, json.JSONDecodeError, TypeError) as exc:
                    model_failed_reason = f"unparseable_output {type(exc).__name__}"
                    parsed_ok = None
                    break

                raw_sections = list(parsed_ok.get("sections") or [])
                raw_moments = list(parsed_ok.get("moments") or [])
                decision_log(
                    "video_picker",
                    "model_response",
                    model=active_model,
                    chunk=chunk_label,
                    status=200,
                    prompt_tokens=meta.get("prompt_tokens"),
                    output_tokens=meta.get("output_tokens"),
                    rawModelJson=sanitize_model_json(
                        {"sections": raw_sections, "moments": raw_moments}
                    ),
                )
                meta["raw_moments_count"] = len(raw_moments)
                if not raw_sections and not raw_moments:
                    model_failed_reason = "empty_sections_and_moments"
                    parsed_ok = None
                    break

                if raw_sections and not raw_moments and sections_moment_retries > 0:
                    sections_moment_retries -= 1
                    decision_log(
                        "video_picker",
                        "retry",
                        model=active_model,
                        chunk=chunk_label,
                        retry_reason="sections_without_moments",
                    )
                    user_text = (
                        user_text_base
                        + "\n\nRETRY: You returned sections but moments[] was empty. "
                        "For every non-trivial section, add at least one moment with numeric "
                        "start_s, end_s, peak_s, hook_s (seconds), score, what_happened, why_it_works."
                    )
                    parsed_ok = None
                    continue

                raw_moments, sanitize_stats = sanitize_raw_moments(raw_moments, float(duration_s))
                meta["sanitize_stats"] = sanitize_stats
                if raw_sections and not raw_moments and sections_moment_retries > 0:
                    sections_moment_retries -= 1
                    decision_log(
                        "video_picker",
                        "retry",
                        model=active_model,
                        chunk=chunk_label,
                        retry_reason="sections_without_moments_after_sanitize",
                    )
                    user_text = (
                        user_text_base
                        + "\n\nRETRY: moments were missing or invalid after parse. "
                        "Return at least one valid moment per major section (numeric start_s/end_s)."
                    )
                    parsed_ok = None
                    continue

                violations = collect_time_violations(raw_sections, raw_moments, float(duration_s))
                if violations:
                    meta["time_violations"] = violations[:12]
                    meta["time_invalid"] = True
                    decision_log(
                        "video_picker",
                        "time_invalid",
                        model=active_model,
                        chunk=chunk_label,
                        violations=violations[:8],
                    )
                    if time_invalid_retries > 0 and len(raw_moments) < int(
                        meta.get("min_moments") or min_moments_for_video(int(duration_s))
                    ):
                        time_invalid_retries -= 1
                        decision_log(
                            "video_picker",
                            "retry",
                            model=active_model,
                            chunk=chunk_label,
                            retry_reason="time_invalid",
                        )
                        user_text = (
                            user_text_base
                            + f"\n\nRETRY: The video is {duration_s:.0f}s long; all times must be < {duration_s:.0f}. "
                            "Fix invalid timestamps (read from [t=…] labels): "
                            + "; ".join(violations[:6])
                        )
                        parsed_ok = None
                        continue
                else:
                    meta["time_invalid"] = False

                meta["sections"] = normalize_sections(raw_sections, float(duration_s))[:24]
                meta["sections_count"] = len(meta["sections"])
                max_span = max_span_seconds(target_clip_len_s)
                moments, normalize_rejects = validate_and_normalize_moments(
                    raw_moments,
                    float(duration_s),
                    chunk_offset_s=0.0,
                    max_span_s=max_span,
                )
                meta["normalize_rejects"] = normalize_rejects
                moments_before_dedupe = len(moments)
                moments = dedupe_overlapping_video_picker_moments(moments, stage="dedupe")
                if not moments:
                    model_failed_reason = "no_valid_moments_after_normalize"
                    meta["normalize_rejects"] = normalize_rejects
                    parsed_ok = None
                    break

                meta["moments_raw"] = moments
                if not skip_edge_reassess and source_video is not None and scratch is not None:
                    t_end = trim_end_s if trim_end_s is not None else trim_start_s + float(duration_s)
                    single_chunk = abs(
                        float(t_end) - float(trim_start_s) - float(duration_s)
                    ) < 2.0 and float(trim_start_s) <= 0.5
                    moments = reassess_edge_moments(
                        moments,
                        rel_duration_s=float(duration_s),
                        trim_start_s=trim_start_s,
                        trim_end_s=t_end,
                        src_video=source_video,
                        scratch=scratch,
                        transcript_text=transcript_text,
                        target_clip_len_s=target_clip_len_s,
                        chunk_label=chunk_label,
                        is_single_chunk=single_chunk,
                    )
                before_final_dedupe = len(moments)
                moments = dedupe_overlapping_video_picker_moments(moments, stage="dedupe_reassess")
                min_need = int(meta.get("min_moments") or min_moments_for_video(int(duration_s)))
                if len(moments) < min_need and shortfall_retries > 0:
                    gap = _uncovered_section_labels(meta.get("sections") or [], moments, float(duration_s))
                    if gap:
                        shortfall_retries -= 1
                        decision_log(
                            "video_picker",
                            "retry",
                            model=active_model,
                            chunk=chunk_label,
                            retry_reason="shortfall_vs_min_moments",
                            have=len(moments),
                            need=min_need,
                            uncovered=gap[:6],
                        )
                        user_text = (
                            user_text_base
                            + f"\n\nRETRY: You returned {len(moments)} moments but need at least {min_need}. "
                            f"Add strong moments covering these uncovered sections (do not duplicate existing beats): "
                            + "; ".join(gap[:8])
                        )
                        parsed_ok = None
                        continue
                meta["moments_deduped"] = {
                    "before": moments_before_dedupe,
                    "after": len(moments),
                    "after_reassess": before_final_dedupe,
                }
                meta["ok"] = True
                meta["model"] = active_model
                meta["model_used"] = active_model
                meta["model_fallback"] = active_model != primary_model
                decision_log(
                    "video_picker",
                    "model_attempt",
                    model=active_model,
                    chunk=chunk_label,
                    status=200,
                    ok=True,
                    prompt_tokens=meta.get("prompt_tokens"),
                    output_tokens=meta.get("output_tokens"),
                    gen_ms=meta.get("gen_ms"),
                    moments=len(moments),
                    sanitize_stats=meta.get("sanitize_stats"),
                    normalize_rejects=meta.get("normalize_rejects"),
                )
                stage_end(
                    "video_picker",
                    t0,
                    chunk=chunk_label,
                    frames=meta["frames_est"],
                    prompt_tokens=meta["prompt_tokens"],
                    output_tokens=meta["output_tokens"],
                    est_usd=meta["est_usd"],
                    moments=len(moments),
                    model_used=active_model,
                    model_fallback=meta["model_fallback"],
                )
                return moments, meta

            last_fallback_reason = model_failed_reason or last_err[:160]
            if model_idx + 1 >= len(models_chain):
                break

        meta["ok"] = False
        meta["model_used"] = models_chain[-1] if models_chain else primary_model
        meta["error"] = last_fallback_reason or last_err
        meta["status"] = last_status
        print(
            f"[clipper:video_picker] ERROR video_picker_failed "
            f"models_tried={models_chain} chunk={chunk_label} "
            f"status={last_status} err={(last_fallback_reason or last_err)[:240]}",
            flush=True,
        )
        stage_end(
            "video_picker",
            t0,
            chunk=chunk_label,
            error=(last_fallback_reason or last_err)[:180],
            fail_open=False,
        )
        from clips_worker.picker.picker_errors import VideoPickerRetryableError

        delay = 90
        if meta.get("rate_limited") and isinstance(meta.get("quota"), dict):
            from clips_worker.picker.picker_errors import parse_retry_delay_seconds

            rd = parse_retry_delay_seconds(meta["quota"].get("retryDelay"))
            if rd is not None:
                delay = int(min(600, max(30, rd + 5)))
        if not fail_open:
            raise VideoPickerRetryableError(
                last_fallback_reason or last_err,
                delay_seconds=delay,
            )
        return _fail_open(last_fallback_reason or last_err, last_status, None)
    except Exception as exc:
        if not fail_open:
            raise
        return _fail_open(str(exc)[:300], last_status, None)


def watch_upload_range(
    src_video: Path,
    *,
    range_start_ms: int,
    range_end_ms: int,
    scratch: Path,
    target_clip_len_s: int | None = None,
    sentences: list[Any] | None = None,
) -> tuple[list[dict], list[float], dict[str, Any]]:
    start_s = max(0.0, range_start_ms / 1000.0)
    end_s = range_end_ms / 1000.0 if range_end_ms > range_start_ms else start_s + 60.0
    duration_s = max(1, int(end_s - start_s))
    proxy = scratch / "video_picker_upload.mp4"
    make_watch_proxy(src_video, proxy, start_s, end_s)
    transcript = (
        format_timestamped_transcript(sentences or [], range_start_ms, range_end_ms)
        if sentences
        else ""
    )
    moments, meta = watch_video_file(
        proxy,
        duration_s=duration_s,
        chunk_label="regular",
        target_clip_len_s=target_clip_len_s,
        transcript_text=transcript,
        source_video=src_video,
        scratch=scratch,
        trim_start_s=start_s,
        trim_end_s=end_s,
        fail_open=False,
    )
    curve = moments_to_per_second(
        [
            {
                **m,
                "start_s": float(m["start_s"]) - start_s,
                "end_s": float(m["end_s"]) - start_s,
                "peak_s": float(m["peak_s"]) - start_s,
            }
            for m in moments
        ],
        duration_s,
    )
    return moments, curve, meta
