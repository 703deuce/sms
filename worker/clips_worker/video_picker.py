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

from clips_worker.gemini_vision import GEMINI_BASE, _key, discover_video_picker_model
from clips_worker.stage_log import stage_begin, stage_end

MOMENTS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "moments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "t_s": {"type": "number"},
                    "reason": {"type": "string"},
                    "score": {"type": "number"},
                },
                "required": ["t_s", "reason", "score"],
            },
        }
    },
    "required": ["moments"],
}

_SYSTEM = (
    "You watch short-form video for stream/game highlights. "
    "Find visually or emotionally notable moments (gameplay plays, reactions, jump scares, "
    "alerts, face reactions, chat on screen) even when nobody is talking. "
    "Return JSON only. score is 0.0-1.0. t_s is seconds from the start of this clip."
)


def video_picker_enabled() -> bool:
    raw = (os.environ.get("VIDEO_PICKER_ENABLED") or "true").strip().lower()
    return raw not in ("0", "false", "no", "off")


def video_picker_timeout_s() -> float:
    try:
        return max(15.0, float(os.environ.get("VIDEO_PICKER_TIMEOUT_S", "90")))
    except ValueError:
        return 90.0


def video_picker_fps() -> float:
    """Gemini video_metadata.fps — higher samples fast gameplay beats (default 0.5, cap 1.0)."""
    try:
        return min(1.0, max(0.1, float(os.environ.get("VIDEO_PICKER_FPS", "0.5"))))
    except ValueError:
        return 0.5


def video_picker_keep_audio() -> bool:
    raw = (os.environ.get("VIDEO_PICKER_KEEP_AUDIO") or "true").strip().lower()
    return raw not in ("0", "false", "no", "off")


def estimate_gemini_usd(prompt_tokens: int, output_tokens: int) -> float:
    try:
        in_per_m = float(os.environ.get("VIDEO_PICKER_USD_PER_1M_INPUT", "0.10"))
        out_per_m = float(os.environ.get("VIDEO_PICKER_USD_PER_1M_OUTPUT", "0.40"))
    except ValueError:
        in_per_m, out_per_m = 0.10, 0.40
    return (prompt_tokens / 1_000_000) * in_per_m + (output_tokens / 1_000_000) * out_per_m


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
    vf = "scale=480:-2:flags=fast_bilinear"
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


def moments_to_per_second(moments: list[dict], duration_s: int) -> list[float]:
    n = max(1, duration_s)
    curve = [0.0] * n
    for m in moments:
        try:
            t = int(float(m.get("t_s") or 0))
            sc = float(m.get("score") or 0)
        except (TypeError, ValueError):
            continue
        sc = max(0.0, min(1.0, sc))
        for dt in range(-2, 3):
            ti = t + dt
            if 0 <= ti < n:
                decay = 1.0 - abs(dt) * 0.2
                curve[ti] = max(curve[ti], sc * decay)
    return curve


def absolute_moment_ms(moment: dict, range_start_ms: int = 0) -> int:
    if moment.get("t_ms") is not None:
        return int(moment["t_ms"])
    try:
        return range_start_ms + int(float(moment.get("t_s") or 0) * 1000)
    except (TypeError, ValueError):
        return range_start_ms


def format_moments_for_llm(moments: list[dict], limit: int = 40) -> str:
    lines: list[str] = []
    for m in moments[:limit]:
        try:
            t = float(m.get("t_s") or 0)
            sc = float(m.get("score") or 0)
        except (TypeError, ValueError):
            continue
        reason = str(m.get("reason") or "").strip()[:160]
        if reason:
            lines.append(f"- {t:.1f}s score={sc:.2f}: {reason}")
    return "\n".join(lines)


def format_moments_for_window(
    moments: list[dict],
    lo_ms: int,
    hi_ms: int,
    *,
    range_start_ms: int = 0,
    pad_ms: int = 8000,
    limit: int = 24,
) -> str:
    """Timestamped visual notes for a transcript chunk (absolute ms on source)."""
    picked: list[dict] = []
    for m in moments:
        t_ms = absolute_moment_ms(m, range_start_ms)
        if lo_ms - pad_ms <= t_ms <= hi_ms + pad_ms:
            picked.append({**m, "t_s": (t_ms - range_start_ms) / 1000.0})
    return format_moments_for_llm(picked, limit=limit)


def _gemini_transient_status(status: int) -> bool:
    return status == 429 or status >= 500


def _gemini_transient_exc(exc: Exception) -> bool:
    if isinstance(exc, (requests.Timeout, requests.ConnectionError)):
        return True
    name = type(exc).__name__
    return "Timeout" in name or "Connection" in name


def watch_video_file(
    video_path: Path,
    *,
    duration_s: int,
    chunk_label: str = "upload",
) -> tuple[list[dict], dict[str, Any]]:
    """Gemini Flash video watch. Fail-open after retries: log error, return empty moments."""
    meta: dict[str, Any] = {
        "chunk": chunk_label,
        "frames_est": 0,
        "prompt_tokens": 0,
        "output_tokens": 0,
        "est_usd": 0.0,
        "model": "",
        "ok": False,
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
        model = discover_video_picker_model()
        meta["model"] = model
        raw = video_path.read_bytes()
        if len(raw) > 18 * 1024 * 1024:
            slim = video_path.parent / f"{video_path.stem}_slim.mp4"
            make_watch_proxy(video_path, slim, 0.0, float(duration_s))
            raw = slim.read_bytes()
        b64 = base64.b64encode(raw).decode("ascii")
        fps = video_picker_fps()
        meta["fps"] = fps
        meta["frames_est"] = max(1, int(duration_s * fps))
        part: dict[str, Any] = {
            "inline_data": {"mime_type": "video/mp4", "data": b64},
            "video_metadata": {"fps": fps},
        }
        generation_config: dict[str, Any] = {
            "responseMimeType": "application/json",
            "responseSchema": MOMENTS_SCHEMA,
            "temperature": 0.35,
            "mediaResolution": "MEDIA_RESOLUTION_LOW",
        }
        payload = {
            "systemInstruction": {"parts": [{"text": _SYSTEM}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        part,
                        {
                            "text": (
                                f"Video length about {duration_s}s. "
                                "List notable visual moments with t_s in seconds from the start of this clip. "
                                "Include quiet gameplay (fights, clutches, wipes) even when speech is sparse."
                            ),
                        },
                    ],
                }
            ],
            "generationConfig": generation_config,
        }
        last_err = "unknown"
        last_status: int | None = None
        for attempt in range(3):
            try:
                res = requests.post(
                    f"{GEMINI_BASE}/models/{model}:generateContent",
                    params={"key": _key()},
                    json=payload,
                    timeout=video_picker_timeout_s(),
                )
                last_status = res.status_code
                if _gemini_transient_status(res.status_code) and attempt < 2:
                    time.sleep(2**attempt)
                    continue
                if not res.ok:
                    raw = res.text or res.reason or "error"
                    summary, quota = gemini_error_log_fields(raw)
                    last_err = summary or raw[:300]
                    last_status = res.status_code
                    return _fail_open(last_err, res.status_code, quota or None)
                data = res.json()
                usage = data.get("usageMetadata") or {}
                pt = int(usage.get("promptTokenCount") or 0)
                ot = int(usage.get("candidatesTokenCount") or 0)
                meta["prompt_tokens"] = pt
                meta["output_tokens"] = ot
                meta["est_usd"] = round(estimate_gemini_usd(pt, ot), 6)
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                moments = list(parsed.get("moments") or [])
                meta["ok"] = True
                stage_end(
                    "video_picker",
                    t0,
                    chunk=chunk_label,
                    frames=meta["frames_est"],
                    prompt_tokens=pt,
                    output_tokens=ot,
                    est_usd=meta["est_usd"],
                    moments=len(moments),
                )
                return moments, meta
            except Exception as exc:
                last_err = str(exc)[:300]
                if _gemini_transient_exc(exc) and attempt < 2:
                    time.sleep(2**attempt)
                    continue
                return _fail_open(last_err, last_status, None)
        return _fail_open(last_err, last_status, None)
    except Exception as exc:
        return _fail_open(str(exc)[:300], last_status, None)


def watch_upload_range(
    src_video: Path,
    *,
    range_start_ms: int,
    range_end_ms: int,
    scratch: Path,
) -> tuple[list[dict], list[float], dict[str, Any]]:
    start_s = max(0.0, range_start_ms / 1000.0)
    end_s = range_end_ms / 1000.0 if range_end_ms > range_start_ms else start_s + 60.0
    duration_s = max(1, int(end_s - start_s))
    proxy = scratch / "video_picker_upload.mp4"
    make_watch_proxy(src_video, proxy, start_s, end_s)
    moments, meta = watch_video_file(proxy, duration_s=duration_s, chunk_label="regular")
    for m in moments:
        try:
            m["t_ms"] = range_start_ms + int(float(m.get("t_s") or 0) * 1000)
        except (TypeError, ValueError):
            pass
    curve = moments_to_per_second(moments, duration_s)
    return moments, curve, meta
