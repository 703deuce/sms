"""Gemini Flash video-watch signal for clip finding (stream + regular)."""
from __future__ import annotations

import base64
import json
import os
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
    scale = "scale=480:-2:flags=fast_bilinear"
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
    overlap_threshold: float = 0.5,
) -> list[dict]:
    """Drop >50% overlapping spans; keep higher score (counts as one beat toward min_moments)."""
    ranked = sorted(moments, key=lambda m: -float(m.get("score") or 0))
    kept: list[dict] = []
    for m in ranked:
        span = _moment_span_s(m)
        if any(_span_overlap_fraction(span, _moment_span_s(k)) > overlap_threshold for k in kept):
            continue
        kept.append(m)
    kept.sort(key=lambda x: -float(x.get("score") or 0))
    return kept


def _top_up_distinct_moments(
    kept: list[dict],
    pool: list[dict],
    need: int,
    *,
    overlap_threshold: float = 0.5,
) -> list[dict]:
    """Fill toward min_moments from next-best candidates that are distinct from kept spans."""
    out = list(kept)
    if len(out) >= need:
        return out
    ranked = sorted(pool, key=lambda m: -float(m.get("score") or 0))
    for m in ranked:
        if len(out) >= need:
            break
        span = _moment_span_s(m)
        if any(_span_overlap_fraction(span, _moment_span_s(k)) > overlap_threshold for k in out):
            continue
        out.append(m)
        print(
            f"[clipper:video_picker] min_moments_top_up score={m.get('score')} "
            f"span={span[0]:.1f}-{span[1]:.1f}s distinct={len(out)}/{need}",
            flush=True,
        )
    out.sort(key=lambda x: -float(x.get("score") or 0))
    return out


def validate_and_normalize_moments(
    raw: list[dict],
    duration_s: float,
    *,
    chunk_offset_s: float = 0.0,
    max_span_s: float | None = None,
) -> list[dict]:
    """Clamp times, enforce ordering, drop spans <5s; add legacy t_s/reason fields."""
    dur = max(1.0, float(duration_s))
    out: list[dict] = []
    for row in raw:
        try:
            start = _clamp(float(row.get("start_s", 0)), 0.0, dur)
            end = _clamp(float(row.get("end_s", start)), 0.0, dur)
            peak = float(row.get("peak_s", (start + end) / 2))
            hook = float(row.get("hook_s", start))
        except (TypeError, ValueError):
            continue
        if end <= start or (end - start) < _MIN_MOMENT_S:
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
        if max_span_s is not None and max_span_s > 0:
            start, end, peak, hook = _apply_max_span(start, end, peak, hook, max_span_s)
        if not (start <= hook <= peak < end):
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
    out.sort(key=lambda x: -float(x.get("score") or 0))
    return out


_TIME_EPS_S = 0.35


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
    from clips_worker.streamer.chunking import plan_chunks

    try:
        chunk_min = max(5, int(os.environ.get("VIDEO_PICKER_STREAM_CHUNK_MIN", "15")))
    except ValueError:
        chunk_min = 15
    chunk_ms = chunk_min * 60_000
    overlap_ms = int(video_picker_stream_overlap_s() * 1000)
    return plan_chunks(max(1, duration_ms), chunk_ms, overlap_ms)


def _gemini_transient_status(status: int) -> bool:
    return status in (429, 503, 502, 504) or status >= 500


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
        f"[clipper:video_picker] WARNING {json.dumps({'event': 'model_fallback', 'chunk': chunk_label, 'from': from_model, 'to': to_model, 'reason': reason, 'status': status})}",
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
) -> dict[str, Any]:
    use_fps = fps if fps is not None else video_picker_fps()
    order = part_order or video_picker_user_part_order()
    work = scratch or video_path.parent
    if video_picker_labeled_frames():
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
) -> list[dict]:
    if not moments or src_video is None or scratch is None or not src_video.is_file():
        return moments
    pad = 55.0
    max_span = max_span_seconds(target_clip_len_s)
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
        abs_start = trim_start_s + rs
        abs_end = trim_start_s + re
        ext_lo = max(0.0, abs_start - pad)
        ext_hi = abs_end + pad
        if edge in ("start", "both") and rs <= 1.5:
            ext_lo = max(0.0, trim_start_s - pad)
        if edge in ("end", "both") and re >= rel_duration_s - 1.5:
            ext_hi = max(ext_hi, trim_end_s + pad)
        proxy = scratch / f"edge_reassess_{chunk_label}_{len(out)}.mp4"
        make_watch_proxy(src_video, proxy, ext_lo, ext_hi)
        ext_dur = max(1, int(ext_hi - ext_lo))
        edge_user = (
            "Reassess this chunk-edge moment using the expanded video and transcript. "
            "Return moments[] with zero or one updated moment. Do not lower score because of edge; "
            "update boundaries if neighbor context completes the clip. Drop only if confidence would "
            "stay below 0.35 and the moment cannot stand alone.\n"
            f"Prior moment JSON:\n{json.dumps(m, default=str)[:4000]}\n\n"
            f"Timestamped transcript:\n{transcript_text[:12000]}"
        )
        reassessed, _meta = watch_video_file(
            proxy,
            duration_s=ext_dur,
            chunk_label=f"{chunk_label}_edge",
            target_clip_len_s=target_clip_len_s,
            transcript_text=transcript_text,
            skip_edge_reassess=True,
            trim_start_s=ext_lo,
            trim_end_s=ext_hi,
        )
        if reassessed:
            best = dict(reassessed[0])
            shift = ext_lo - trim_start_s
            for key in ("start_s", "end_s", "peak_s", "hook_s", "t_s"):
                try:
                    best[key] = round(float(best[key]) + shift, 3)
                except (TypeError, ValueError, KeyError):
                    pass
            normed = validate_and_normalize_moments(
                [best],
                rel_duration_s,
                chunk_offset_s=0.0,
                max_span_s=max_span,
            )
            if normed:
                out.append(normed[0])
            elif float(m.get("confidence") or 0) >= 0.35:
                out.append(m)
            continue
        if float(m.get("confidence") or 0) >= 0.35:
            out.append(m)
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
            "Use the labeled frame timeline ([t=…] before each image), original audio, "
            "burned-in HH:MM:SS on each frame, and the timestamped transcript together.\n\n"
            f"TIMESTAMPED TRANSCRIPT:\n{transcript_text[:16000] if transcript_text else '(none)'}\n\n"
            f"Return sections and moments JSON for this video only ({duration_s}s max; "
            "all times must match [t=…] labels and transcript)."
        )
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

        for model_idx, active_model in enumerate(models_chain):
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
                )
                res, last_err, last_status = _gemini_post_watch(active_model, payload)

                if res is None or not res.ok:
                    model_failed_reason = f"api_error status={last_status} err={last_err[:120]}"
                    if last_status == 429 or "quota exceeded" in last_err.lower():
                        meta["rate_limited"] = True
                        meta["status"] = last_status or 429
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
                if not raw_sections and not raw_moments:
                    model_failed_reason = "empty_sections_and_moments"
                    parsed_ok = None
                    break

                violations = collect_time_violations(raw_sections, raw_moments, float(duration_s))
                if violations:
                    meta["time_violations"] = violations[:12]
                    meta["time_invalid"] = True
                    print(
                        f"[clipper:video_picker] {json.dumps({'event': 'time_invalid', 'chunk': chunk_label, 'model': active_model, 'violations': violations[:8]})}",
                        flush=True,
                    )
                    if time_invalid_retries > 0:
                        time_invalid_retries -= 1
                        user_text = (
                            user_text_base
                            + "\n\nRETRY: Your prior JSON had invalid timestamps "
                            f"(must be 0..{duration_s}s, read from [t=…] labels): "
                            + "; ".join(violations[:6])
                            + ". Fix all section and moment times before returning."
                        )
                        parsed_ok = None
                        continue
                    model_failed_reason = "time_invalid_after_retry"
                    parsed_ok = None
                    break

                meta["time_invalid"] = False
                meta["sections"] = normalize_sections(raw_sections, float(duration_s))[:24]
                meta["sections_count"] = len(meta["sections"])
                max_span = max_span_seconds(target_clip_len_s)
                moments = validate_and_normalize_moments(
                    raw_moments,
                    float(duration_s),
                    chunk_offset_s=0.0,
                    max_span_s=max_span,
                )
                moments_before_dedupe = len(moments)
                moments = dedupe_overlapping_video_picker_moments(moments)
                if not moments:
                    model_failed_reason = "no_valid_moments_after_normalize"
                    parsed_ok = None
                    break

                meta["moments_raw"] = moments
                if not skip_edge_reassess and source_video is not None and scratch is not None:
                    t_end = trim_end_s if trim_end_s is not None else trim_start_s + float(duration_s)
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
                    )
                before_final_dedupe = len(moments)
                moments = dedupe_overlapping_video_picker_moments(moments)
                need = int(meta.get("min_moments") or min_moments_for_video(int(duration_s)))
                if len(moments) < need:
                    pool = dedupe_overlapping_video_picker_moments(
                        validate_and_normalize_moments(
                            raw_moments,
                            float(duration_s),
                            chunk_offset_s=0.0,
                            max_span_s=max_span,
                        )
                    )
                    moments = _top_up_distinct_moments(moments, pool, need)
                if len(moments) < need and time_invalid_retries > 0:
                    time_invalid_retries -= 1
                    user_text = (
                        user_text_base
                        + f"\n\nRETRY: Return at least {need} distinct moments (after dedupe). "
                        f"You returned {len(moments)}. Add more honestly ranked moments; no duplicate beats."
                    )
                    parsed_ok = None
                    continue
                meta["moments_deduped"] = {
                    "before": moments_before_dedupe,
                    "after": len(moments),
                    "after_reassess": before_final_dedupe,
                }
                _log_min_moments_shortfall(duration_s, len(moments), chunk_label)
                meta["min_moments_met"] = len(moments) >= int(meta.get("min_moments") or 0)
                meta["ok"] = True
                meta["model"] = active_model
                meta["model_used"] = active_model
                meta["model_fallback"] = active_model != primary_model
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
        if not fail_open:
            raise RuntimeError(last_fallback_reason or last_err)
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
    attach_absolute_ms(moments, range_start_ms)
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
