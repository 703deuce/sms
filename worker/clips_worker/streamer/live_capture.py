"""Forward live Twitch HLS capture (no Helix archive VOD) for rolling paste/auto-pull."""
from __future__ import annotations

import json
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from clips_worker.streamer.config import SCRATCH
from clips_worker.streamer.rolling_ingest import (
    emit_rolling_session_check,
    log_rolling_pull,
    rolling_chunk_min,
)


def is_twitch_live_capture(vod: dict[str, Any]) -> bool:
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state) if state else {}
    return bool(state.get("liveCapture")) and str(vod.get("platform") or "").lower() == "twitch"


def _parse_iso_ms(ts: str | None) -> int | None:
    if not ts or not str(ts).strip():
        return None
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except (TypeError, ValueError):
        return None


def stream_elapsed_ms(state: dict[str, Any], *, at_ms: int | None = None) -> int:
    """Milliseconds since Helix stream started_at (absolute stream timeline)."""
    started_ms = _parse_iso_ms(str(state.get("streamStartedAt") or ""))
    if started_ms is None:
        return 0
    now_ms = at_ms if at_ms is not None else int(time.time() * 1000)
    return max(0, now_ms - started_ms)


def _channel_login(vod: dict[str, Any], state: dict[str, Any]) -> str:
    return str(
        vod.get("channelLogin")
        or state.get("channelLogin")
        or ""
    ).strip().lower()


def plan_live_capture_window_ms(
    *,
    state: dict[str, Any],
    finalize: bool,
    vod_id: str | None = None,
) -> tuple[int, int] | None | str:
    rolling = dict(state.get("rolling") if isinstance(state.get("rolling"), dict) else {})
    chunk_ms = rolling_chunk_min(state) * 60_000
    last_pulled = int(rolling.get("lastPulledMs") or 0)
    elapsed = stream_elapsed_ms(state)

    if finalize:
        if last_pulled >= elapsed:
            return None
        return last_pulled, elapsed

    if last_pulled <= 0:
        start_ms = max(0, elapsed - chunk_ms)
    else:
        start_ms = last_pulled
    end_ms = min(elapsed, start_ms + chunk_ms)
    if end_ms <= start_ms:
        return None

    elapsed_h, cap_h, rolling, session_mutated = emit_rolling_session_check(
        vod_id=vod_id,
        state=state,
        seed_if_missing=True,
    )
    if session_mutated:
        state["rolling"] = {**(state.get("rolling") if isinstance(state.get("rolling"), dict) else {}), **rolling}
    if elapsed_h > cap_h:
        return "stop_session"

    return start_ms, end_ms


def apply_live_capture_pull_plan(
    conn,
    vod: dict[str, Any],
    *,
    finalize: bool,
    job_id: str,
) -> tuple[int, int] | None | str:
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state)
    plan = plan_live_capture_window_ms(state=state, finalize=finalize, vod_id=str(vod.get("id") or ""))
    if plan is None or plan == "stop_session":
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE stream_vods SET state=%s::jsonb, "updatedAt"=NOW() WHERE id=%s',
                (json.dumps(state), vod["id"]),
            )
        conn.commit()
        return plan
    start_ms, end_ms = plan
    rolling = dict(state.get("rolling") or {})
    rolling["lastPullPlannedMs"] = int(end_ms)
    rolling["lastPullAt"] = datetime.now(timezone.utc).isoformat()
    rolling["live"] = True
    state = {**state, "processMode": "rolling", "rolling": rolling}
    project_id = vod["project_id"]
    vod_id = vod["id"]
    window_ms = max(1, end_ms - start_ms)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE stream_vods
            SET "rangeStartMs"=%s, "rangeEndMs"=%s, "durationMs"=%s, state=%s::jsonb, "updatedAt"=NOW()
            WHERE id=%s
            """,
            (start_ms, end_ms, window_ms, json.dumps(state), vod_id),
        )
        cur.execute(
            """
            UPDATE clip_projects
            SET "rangeStartMs"=%s, "rangeEndMs"=%s, "updatedAt"=NOW()
            WHERE id=%s
            """,
            (start_ms, end_ms, project_id),
        )
    conn.commit()
    vod["rangeStartMs"] = start_ms
    vod["rangeEndMs"] = end_ms
    vod["durationMs"] = window_ms
    vod["state"] = state
    log_rolling_pull(
        channel_id=str(vod.get("channelId") or "") or None,
        vod_id=vod_id,
        project_id=project_id,
        job_id=job_id,
        start_ms=start_ms,
        end_ms=end_ms,
        finalize=finalize,
    )
    from clips_worker.decision_log import decision_log

    chunk_min = rolling_chunk_min(state)
    decision_log(
        "stream_import",
        "live_capture_plan",
        login=_channel_login(vod, state),
        chunkMin=chunk_min,
        offset_ms=int(start_ms),
        rangeEndMs=int(end_ms),
        duration_s=max(1, (end_ms - start_ms) // 1000),
        archiveResolveReason=str(state.get("archiveResolveReason") or "")[:120],
        vodId=vod_id,
        jobId=job_id,
    )
    return start_ms, end_ms


def _probe_audio_ms(path: Path) -> int:
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            text=True,
        ).strip()
        return int(float(out) * 1000)
    except (subprocess.CalledProcessError, ValueError):
        return 0


def ingest_live_capture_audio(
    url: str,
    *,
    duration_s: int,
    job_id: str,
    vod_id: str,
    login: str,
    offset_ms: int,
    chunk_min: int,
    archive_resolve_reason: str | None,
    progress_cb: Callable[[float], None] | None = None,
) -> tuple[Path, int, int]:
    """Record ``duration_s`` seconds from the live edge; return path, bytes, audio_ms."""
    from clips_worker.decision_log import decision_log
    from clips_worker.streamer.ytdlp import metadata

    duration_s = max(3, min(int(duration_s), 60 * 60))
    decision_log(
        "stream_import",
        "live_capture_begin",
        login=login,
        chunkMin=chunk_min,
        offset_ms=int(offset_ms),
        duration_s=duration_s,
        archiveResolveReason=(archive_resolve_reason or "")[:120],
        vodId=vod_id,
        jobId=job_id,
    )

    meta = metadata(url, timeout_s=90, allow_twitch_growing_vod=True)
    stream_url = str(meta.get("url") or url)
    work = SCRATCH / "live_capture" / vod_id
    work.mkdir(parents=True, exist_ok=True)
    out = work / f"capture_{int(time.time())}.opus"
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        stream_url,
        "-t",
        str(duration_s),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "libopus",
        "-b:a",
        "24k",
        str(out),
    ]
    try:
        subprocess.run(cmd, check=True, timeout=max(120, duration_s + 90))
    except subprocess.CalledProcessError as exc:
        decision_log(
            "stream_import",
            "live_capture_end",
            login=login,
            chunkMin=chunk_min,
            offset_ms=int(offset_ms),
            bytes=0,
            duration_ms=0,
            ok=False,
            exit_code=exc.returncode,
        )
        raise RuntimeError(f"Live capture failed (ffmpeg exit {exc.returncode})") from exc
    except subprocess.TimeoutExpired as exc:
        decision_log(
            "stream_import",
            "live_capture_end",
            login=login,
            chunkMin=chunk_min,
            offset_ms=int(offset_ms),
            bytes=0,
            duration_ms=0,
            ok=False,
            reason="ffmpeg_timeout",
        )
        raise RuntimeError("Live capture timed out") from exc

    bytes_dl = out.stat().st_size if out.is_file() else 0
    audio_ms = _probe_audio_ms(out)
    if bytes_dl <= 0 or audio_ms <= 0:
        decision_log(
            "stream_import",
            "live_capture_end",
            login=login,
            chunkMin=chunk_min,
            offset_ms=int(offset_ms),
            bytes=bytes_dl,
            duration_ms=audio_ms,
            ok=False,
            reason="empty_capture",
        )
        raise RuntimeError("Live capture produced no audio (stream may not be ready)")

    if progress_cb:
        progress_cb(100.0)
    decision_log(
        "stream_import",
        "live_capture_end",
        login=login,
        chunkMin=chunk_min,
        offset_ms=int(offset_ms),
        bytes=bytes_dl,
        duration_ms=audio_ms,
        ok=True,
    )
    return out, bytes_dl, audio_ms
