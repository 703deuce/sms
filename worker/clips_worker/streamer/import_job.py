"""STREAM_IMPORT: metadata; audio-first for vod/highlight; video section only for clip kind."""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from clips_worker.heartbeat import Heartbeat
from clips_worker.import_url import probe_video, upload_source_key
from clips_worker.probe import probe_duration
from clips_worker.storage import download_object, upload_file
from clips_worker.streamer.config import FULL_DOWNLOAD_MAX_MIN, PASTE_MAX_VOD_HOURS, SCRATCH
from clips_worker.streamer.keys import stream_audio_key
from clips_worker.streamer.upload_proxy import (
    build_analysis_proxy,
    should_build_upload_proxy,
    stream_analysis_proxy_key,
)
from clips_worker.streamer.usage import check_cap, job_priority
from clips_worker.streamer.import_cache import cleanup_vod_import_dir, pick_completed_audio, sweep_stale_failed_import_dirs, vod_import_dir
from clips_worker.streamer.ytdlp import download_audio, download_video, metadata, parse_metadata


def _enforce_paste_vod_duration_cap(vod: dict, effective_ms: int) -> None:
    """Rick: ~10 h cap for one-shot paste VOD links only; marathon/rolling uses monthly cap."""
    triggered = str(vod.get("triggeredBy") or "paste").lower()
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state) if state else {}
    mode = str((state or {}).get("processMode") or "").lower()
    if triggered != "paste" or mode in ("marathon", "rolling"):
        return
    max_s = PASTE_MAX_VOD_HOURS * 3600
    if effective_ms > max_s * 1000:
        raise RuntimeError(
            f"VOD is longer than {PASTE_MAX_VOD_HOURS} h for paste import. "
            "Connect your channel for marathon mode, pick a shorter range, or wait for highlight batches."
        )


def _extract_upload_audio(
    src: Path,
    audio_out: Path,
    long_form: bool,
    *,
    range_start_ms: int = 0,
    range_end_ms: int = 0,
) -> None:
    from clips_worker.audio_extract import audio_extract_cmd

    # T6.7: same timestamp-aligned recipe as regular uploads (audio_extract.PTS_ALIGN_AF).
    t_s = None
    if range_end_ms > range_start_ms > 0:
        t_s = (range_end_ms - range_start_ms) / 1000.0
    elif range_end_ms > 0:
        t_s = range_end_ms / 1000.0
    args = audio_extract_cmd(
        src,
        audio_out,
        rate=None,
        mono=False,
        codec="libopus",
        bitrate="64k" if long_form else None,
        ss_s=range_start_ms / 1000.0 if range_start_ms > 0 else None,
        t_s=t_s,
    )
    subprocess.check_call(args)


def _state_for_upload(
    workspace_id: str,
    vod_id: str,
    master_key: str,
    src: Path,
    td: str,
) -> dict:
    """Master stays at master_key; optional 720p proxy for analysis/layout only."""
    state: dict = {"localUploadKey": master_key}
    if should_build_upload_proxy(src.stat().st_size):
        proxy_path = Path(td) / "analysis_proxy.mp4"
        build_analysis_proxy(src, proxy_path)
        proxy_key = stream_analysis_proxy_key(workspace_id, vod_id)
        upload_file(proxy_key, proxy_path, "video/mp4")
        state["analysisProxyKey"] = proxy_key
    return state


def _vod_state_dict(vod: dict) -> dict:
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state) if state else {}
    return state if isinstance(state, dict) else {}


def _rolling_import_mode(vod: dict, payload: dict | None = None) -> bool:
    payload = payload or {}
    if payload.get("rollingTick") is not None:
        return str(vod.get("platform") or "").lower() == "twitch"
    state = _vod_state_dict(vod)
    if state.get("liveCapture") and str(vod.get("platform") or "").lower() == "twitch":
        return True
    mode = str(state.get("processMode") or "").lower()
    return mode == "rolling" and str(vod.get("platform") or "").lower() == "twitch"


def _allow_twitch_growing_vod(vod: dict) -> bool:
    """In-progress Twitch archive only: rolling ingest or live-channel capture — not trim on a finished VOD."""
    if _rolling_import_mode(vod):
        return True
    state = _vod_state_dict(vod)
    if state.get("liveCapture") and str(vod.get("platform") or "").lower() == "twitch":
        return True
    return False


def _has_pending_stream_import(conn, project_id: str, vod_id: str, *, exclude_job_id: str | None = None) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM clip_jobs
            WHERE "projectId"=%s AND type='STREAM_IMPORT' AND status IN ('QUEUED','RUNNING')
              AND payload->>'vodId'=%s
              AND (%s::text IS NULL OR id <> %s)
            LIMIT 1
            """,
            (project_id, vod_id, exclude_job_id, exclude_job_id),
        )
        return cur.fetchone() is not None


def _has_pending_stream_analyze(conn, project_id: str, vod_id: str) -> bool:
    from clips_worker.streamer.analyze_enqueue import has_pending_stream_analyze

    return has_pending_stream_analyze(conn, project_id, vod_id)


def _rolling_import_idle_done(
    conn,
    *,
    job: dict,
    vod: dict,
    project_id: str,
    vod_id: str,
    post_progress,
    reason: str,
) -> None:
    from clips_worker.streamer.rolling_ingest import rolling_chunk_min

    state = _vod_state_dict(vod)
    rolling = state.get("rolling") if isinstance(state.get("rolling"), dict) else {}
    if rolling.get("live") and not rolling.get("finalize"):
        chunk_min = rolling_chunk_min(state)
        _schedule_rolling_import_tick(
            conn,
            project_id=project_id,
            vod_id=vod_id,
            chunk_min=chunk_min,
            exclude_job_id=str(job["id"]),
        )
    from clips_worker.decision_log import decision_log

    decision_log(
        "streamer",
        "rolling_import_deferred",
        vod_id=vod_id,
        project_id=project_id,
        job_id=str(job["id"]),
        reason=reason,
    )
    print(
        f"[clipper:autopull] rolling_import_deferred vodId={vod_id} projectId={project_id} "
        f"jobId={job['id']} reason={reason}",
        flush=True,
    )
    post_progress(
        job["id"],
        {"projectStatus": "PREPARING", "stage": "live_ingest", "progress": 18, "jobStatus": "DONE"},
    )


def _rolling_preflight_after_meta(
    conn,
    *,
    job: dict,
    vod: dict,
    project_id: str,
    vod_id: str,
    payload: dict,
    post_progress,
    meta_dur_s: float,
) -> bool:
    """Plan rolling window or defer. Returns True when this import job should exit."""
    if not _rolling_import_mode(vod, payload):
        return False
    from clips_worker.streamer.rolling_ingest import (
        apply_rolling_pull_plan,
        rolling_chunk_min,
        stop_rolling_session,
    )

    state = _vod_state_dict(vod)
    live_capture = bool(state.get("liveCapture"))
    if not live_capture and _has_pending_stream_analyze(conn, project_id, vod_id):
        _rolling_import_idle_done(
            conn,
            job=job,
            vod=vod,
            project_id=project_id,
            vod_id=vod_id,
            post_progress=post_progress,
            reason="analyze_pending",
        )
        return True
    if not live_capture and _has_pending_stream_import(
        conn, project_id, vod_id, exclude_job_id=str(job["id"])
    ):
        _rolling_import_idle_done(
            conn,
            job=job,
            vod=vod,
            project_id=project_id,
            vod_id=vod_id,
            post_progress=post_progress,
            reason="import_pending",
        )
        return True

    rolling_finalize = bool(payload.get("rollingFinalize"))
    rolling = state.get("rolling") if isinstance(state.get("rolling"), dict) else {}
    finalize = rolling_finalize or bool(rolling.get("finalize"))
    if state.get("liveCapture"):
        from clips_worker.streamer.live_capture import apply_live_capture_pull_plan

        plan_out = apply_live_capture_pull_plan(
            conn,
            vod,
            finalize=finalize,
            job_id=str(job["id"]),
        )
    else:
        total_ms = int(max(0.0, meta_dur_s) * 1000)
        plan_out = apply_rolling_pull_plan(
            conn,
            vod,
            total_vod_ms=total_ms,
            finalize=finalize,
            job_id=str(job["id"]),
        )
    if plan_out == "stop_session":
        stop_rolling_session(conn, vod_id, reason="max_session_hours")
        post_progress(
            job["id"],
            {"projectStatus": "PREPARING", "stage": "live_ingest", "progress": 18, "jobStatus": "DONE"},
        )
        return True
    if plan_out is None:
        if finalize:
            stop_rolling_session(conn, vod_id, reason="stream_offline")
        elif live_capture:
            _rolling_import_idle_done(
                conn,
                job=job,
                vod=vod,
                project_id=project_id,
                vod_id=vod_id,
                post_progress=post_progress,
                reason="live_capture_not_ready",
            )
        else:
            _rolling_import_idle_done(
                conn,
                job=job,
                vod=vod,
                project_id=project_id,
                vod_id=vod_id,
                post_progress=post_progress,
                reason="no_new_vod_ms",
            )
        return True
    return False


def _complete_rolling_window_import(
    conn,
    *,
    job: dict,
    vod: dict,
    project_id: str,
    vod_id: str,
    payload: dict,
    state: dict,
    meta: dict,
    duration_ms: int,
    post_progress,
    hb,
    analyze_source: str = "rolling_window_complete",
    schedule_growing_tick: bool = False,
) -> None:
    from clips_worker.streamer.rolling_ingest import (
        rolling_chunk_min,
        rolling_pull_overlap_ms,
        seed_rolling_chunk_min,
        stop_rolling_session,
    )
    from clips_worker.streamer.project_cancel import load_project_operator_cancelled
    from datetime import datetime, timezone

    end_ms = int(vod.get("rangeEndMs") or 0)
    window_start_ms = int(vod.get("rangeStartMs") or 0)
    window_end_ms = int(vod.get("rangeEndMs") or end_ms)
    overlap_ms = rolling_pull_overlap_ms()
    from clips_worker.streamer.rolling_state import (
        merge_rolling_last_pulled_ms,
        read_rolling_last_pulled_ms,
        reload_vod_state_dict,
    )
    from clips_worker.decision_log import decision_log

    committed_last = read_rolling_last_pulled_ms(conn, vod_id)
    merged_last = merge_rolling_last_pulled_ms(
        committed_ms=committed_last,
        window_end_ms=window_end_ms,
    )
    prior = reload_vod_state_dict(conn, vod_id) or _vod_state_dict(vod)
    rolling = dict(prior.get("rolling") or {})
    rs = int(vod.get("rangeStartMs") or window_start_ms)
    re = int(vod.get("rangeEndMs") or window_end_ms)
    merged_prior = seed_rolling_chunk_min(
        prior,
        vod_id=vod_id,
        range_start_ms=rs,
        range_end_ms=re,
        channel_chunk_min=None,
    )
    rolling = dict(merged_prior.get("rolling") or rolling)
    prior = merged_prior
    rolling["lastPulledMs"] = merged_last
    rolling["lastPullCompletedAt"] = datetime.now(timezone.utc).isoformat()
    if merged_last > window_end_ms:
        decision_log(
            "streamer",
            "last_pulled_ms_preserved",
            vodId=vod_id,
            jobId=str(job.get("id") or ""),
            committedLastMs=committed_last,
            windowEndMs=window_end_ms,
            lastPulledMs=merged_last,
        )
    process_mode = str(prior.get("processMode") or "").lower()
    merged_state = {
        **prior,
        **state,
        "processMode": "rolling" if process_mode == "rolling" or schedule_growing_tick else prior.get("processMode"),
        "rolling": rolling,
    }

    analyze_id: str | None = None
    live_capture = bool(prior.get("liveCapture"))
    window_audio_key = str(state.get("audioKey") or "")
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE clip_projects
            SET title=COALESCE(%s, title), stage='live_ingest', progress=20, "updatedAt"=NOW()
            WHERE id=%s
            """,
            (meta.get("title"), project_id),
        )
        cur.execute(
            """
            UPDATE stream_vods
            SET title=%s, category=%s, "durationMs"=%s, chapters=%s::jsonb, state=%s::jsonb, "updatedAt"=NOW()
            WHERE id=%s
            """,
            (
                meta.get("title"),
                meta.get("category"),
                duration_ms,
                json.dumps(meta.get("chapters")) if meta.get("chapters") else None,
                json.dumps(merged_state),
                vod_id,
            ),
        )
    if load_project_operator_cancelled(conn, project_id):
        decision_log(
            "streamer",
            "analyze_enqueue_skipped",
            project_id=project_id,
            vod_id=vod_id,
            reason="operator_cancelled",
            source=analyze_source,
            rangeStartMs=window_start_ms,
            rangeEndMs=window_end_ms,
            overlapMs=overlap_ms,
        )
    else:
        from clips_worker.streamer.analyze_enqueue import enqueue_stream_analyze

        analyze_id = enqueue_stream_analyze(
            conn,
            project_id=project_id,
            vod_id=vod_id,
            workspace_id=str(vod.get("workspaceId") or ""),
            triggered_by=str(vod.get("triggeredBy") or "auto"),
            source=analyze_source,
            commit=False,
            range_start_ms=window_start_ms,
            range_end_ms=window_end_ms,
            audio_key=window_audio_key or None,
            media_start_ms=int(state.get("vodStartMs") or window_start_ms),
            allow_queue_behind_pending=live_capture,
        )
    conn.commit()
    if analyze_id:
        print(
            f"[clipper:stream] analyze_enqueued vodId={vod_id} projectId={project_id} jobId={analyze_id} "
            f"windowStartMs={window_start_ms} windowEndMs={window_end_ms} overlapMs={overlap_ms} "
            f"source={analyze_source}",
            flush=True,
        )
    rolling_finalize = bool(payload.get("rollingFinalize"))
    rolling_live = prior.get("rolling") if isinstance(prior.get("rolling"), dict) else {}
    live = bool(rolling_live.get("live")) and not rolling_finalize
    finalize = rolling_finalize or bool(rolling_live.get("finalize"))
    chunk_min = rolling_chunk_min(prior)
    schedule_tick = (live and not finalize) or (schedule_growing_tick and not rolling_finalize)
    if schedule_tick:
        from clips_worker.streamer.rolling_ingest import rolling_autopull_stop_reason

        stop_reason = rolling_autopull_stop_reason(conn, vod)
        if stop_reason:
            stop_rolling_session(conn, vod_id, reason=stop_reason, project_id=project_id)
        else:
            _schedule_rolling_import_tick(
                conn,
                project_id=project_id,
                vod_id=vod_id,
                chunk_min=chunk_min,
                exclude_job_id=str(job["id"]),
            )
    elif finalize:
        stop_rolling_session(conn, vod_id, reason="stream_offline")
    cleanup_vod_import_dir(vod_id)
    hb.update(stage="live_ingest", progress=22)
    post_progress(
        job["id"],
        {
            "projectStatus": "QUEUED",
            "stage": "live_ingest",
            "progress": 22,
            "jobStatus": "DONE",
        },
    )


def _schedule_rolling_import_tick(
    conn,
    *,
    project_id: str,
    vod_id: str,
    chunk_min: int,
    exclude_job_id: str | None = None,
) -> None:
    from clips_worker.decision_log import decision_log

    if _has_pending_stream_import(conn, project_id, vod_id, exclude_job_id=exclude_job_id):
        decision_log(
            "stream_import",
            "rolling_import_deduped",
            project_id=project_id,
            vod_id=vod_id,
            exclude_job_id=exclude_job_id,
            reason="pending_stream_import",
        )
        print(
            f"[clipper:stream] rolling_import_deduped vodId={vod_id} projectId={project_id} "
            f"excludeJobId={exclude_job_id or ''}",
            flush=True,
        )
        return
    new_id = f"job_{uuid.uuid4().hex}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "runAfter", "createdAt")
            VALUES (%s,%s,'STREAM_IMPORT','QUEUED',%s::jsonb,15,NOW() + (%s || ' minutes')::interval,NOW())
            """,
            (new_id, project_id, json.dumps({"vodId": vod_id, "rollingTick": True}), str(chunk_min)),
        )
    conn.commit()
    next_run_after: str | None = None
    range_start: int | None = None
    range_end: int | None = None
    with conn.cursor() as cur:
        cur.execute('SELECT "runAfter" FROM clip_jobs WHERE id=%s', (new_id,))
        ra = cur.fetchone()
        if ra and ra[0]:
            next_run_after = ra[0].isoformat() if hasattr(ra[0], "isoformat") else str(ra[0])
        cur.execute(
            'SELECT "rangeStartMs", "rangeEndMs", state FROM stream_vods WHERE id=%s',
            (vod_id,),
        )
        vr = cur.fetchone()
        tick_state: dict | None = None
        if vr:
            range_start = int(vr[0] or 0)
            range_end = int(vr[1] or 0)
            st = vr[2] or {}
            if isinstance(st, str):
                tick_state = json.loads(st) if st else {}
            elif isinstance(st, dict):
                tick_state = st
    from clips_worker.streamer.rolling_ingest import log_rolling_tick_decision

    log_rolling_tick_decision(
        vod_id=vod_id,
        range_start_ms=range_start,
        range_end_ms=range_end,
        chunk_min=chunk_min,
        next_run_after=next_run_after,
        source="schedule_tick",
        state=tick_state,
    )
    decision_log(
        "stream_import",
        "rolling_import_scheduled",
        job_id=new_id,
        project_id=project_id,
        vod_id=vod_id,
        delay_min=chunk_min,
    )
    print(
        f"[clipper:stream] rolling_import_scheduled vodId={vod_id} projectId={project_id} "
        f"jobId={new_id} delayMin={chunk_min}",
        flush=True,
    )


def _section_from_range(start_ms: int, end_ms: int | None) -> str | None:
    if not start_ms and not end_ms:
        return None
    start_s = max(0, start_ms) / 1000.0
    end_s = (end_ms or 0) / 1000.0
    if end_s <= start_s:
        return None
    return f"*{start_s}-{end_s}"


def _ingest_twitch_hls_window(
    *,
    url: str,
    meta_raw: dict,
    workspace_id: str,
    vod_id: str,
    window_start_ms: int,
    window_end_ms: int,
    job_id: str,
    cache_dir: Path,
) -> tuple[str, str, int, int, dict]:
    """Download HLS window with recorded vodStartMs (auto-pull / growing VOD only)."""
    from clips_worker.decision_log import decision_log
    from clips_worker.streamer.hls_window import fetch_window, resolve_rendition_playlist
    from clips_worker.streamer.keys import stream_window_audio_key, stream_window_capture_video_key

    playlist_url = resolve_rendition_playlist(meta_raw, want="video")
    dest = cache_dir / "window.ts"
    wm = fetch_window(playlist_url, window_start_ms, window_end_ms, dest)
    audio_path = cache_dir / "window.opus"
    from clips_worker.audio_extract import audio_extract_cmd

    subprocess.check_call(
        audio_extract_cmd(wm.path, audio_path, codec="libopus", bitrate="24k", quiet=False),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # FIX1 (B.4d): keep audio aligned with the window's t=0 (= vodStartMs) when audio starts after video.
    from clips_worker.streamer.media_probe import audio_lead_ms

    _lead = audio_lead_ms(wm.path)
    if _lead > 20:
        _padded = cache_dir / "window.pad.opus"
        subprocess.check_call(
            ["ffmpeg", "-y", "-i", str(audio_path), "-af", f"adelay={_lead}:all=1",
             "-c:a", "libopus", "-b:a", "24k", str(_padded)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        _padded.replace(audio_path)
    print(f"[streamer:import] window_audio_lead vod={vod_id} leadMs={_lead}", flush=True)
    video_path = cache_dir / "window.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(wm.path),
            "-c",
            "copy",
            str(video_path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    video_key = stream_window_capture_video_key(workspace_id, vod_id, window_end_ms)
    upload_file(video_key, video_path, "video/mp4")
    audio_key = stream_window_audio_key(workspace_id, vod_id, window_end_ms)
    upload_file(audio_key, audio_path, "audio/opus")
    window_meta = {
        "audioKey": audio_key,
        "videoKey": video_key,
        "vodStartMs": wm.vod_start_ms,
        "vodEndMs": wm.vod_end_ms,
        "requestedStartMs": wm.requested_start_ms,
        "requestedEndMs": wm.requested_end_ms,
        "method": wm.method,
    }
    decision_log(
        "streamer",
        "window_anchor",
        vodId=vod_id,
        jobId=job_id,
        requestedStartMs=wm.requested_start_ms,
        vodStartMs=wm.vod_start_ms,
        deltaMs=int(wm.vod_start_ms - wm.requested_start_ms),
        method=wm.method,
        windowEndMs=window_end_ms,
    )
    return audio_key, video_key, wm.vod_start_ms, wm.vod_end_ms, window_meta


def _maybe_complete_import_from_state(conn, vod: dict, job: dict, project_id: str, vod_id: str, post_progress) -> bool:
    """Idempotent: skip re-download when audio is already in storage."""
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload) if payload else {}
    if _rolling_import_mode(vod, payload):
        return False
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state)
    rolling = state.get("rolling") if isinstance(state.get("rolling"), dict) else {}
    if rolling.get("lastPulledMs") and not state.get("audioKey"):
        return False
    if not state.get("audioKey"):
        return False
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT status FROM clip_jobs
            WHERE "projectId"=%s AND type='STREAM_ANALYZE'
            ORDER BY "createdAt" DESC LIMIT 1
            """,
            (project_id,),
        )
        row = cur.fetchone()
    if row and row[0] in ("QUEUED", "RUNNING", "DONE"):
        post_progress(
            job["id"],
            {"projectStatus": "QUEUED", "stage": "queued", "progress": 25, "jobStatus": "DONE"},
        )
        return True
    pri = job_priority(conn, str(vod.get("workspaceId") or ""), vod.get("triggeredBy") or "paste")
    analyze_id = f"job_{uuid.uuid4().hex}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
            VALUES (%s,%s,'STREAM_ANALYZE','QUEUED',%s::jsonb,%s,NOW())
            """,
            (analyze_id, project_id, json.dumps({"vodId": vod_id}), pri),
        )
    conn.commit()
    post_progress(
        job["id"],
        {"projectStatus": "QUEUED", "stage": "queued", "progress": 25, "jobStatus": "DONE"},
    )
    return True


def _effective_duration_ms(vod: dict, meta_dur_s: float) -> int:
    start = int(vod.get("rangeStartMs") or 0)
    end = vod.get("rangeEndMs")
    if end:
        return max(0, int(end) - start)
    return int(meta_dur_s * 1000)


def _log_import_failed(
    exc: BaseException,
    *,
    vod_id: str,
    job_id: str,
    vod: dict | None,
) -> None:
    from clips_worker.decision_log import decision_log, flush_decision_log
    from clips_worker.streamer.http_download import YtdlpDownloadError

    range_start = int(vod.get("rangeStartMs") or 0) if vod else 0
    range_end = vod.get("rangeEndMs") if vod else None
    section = _section_from_range(range_start, int(range_end) if range_end is not None else None) if vod else None

    exit_code = getattr(exc, "exit_code", None)
    stderr_tail = getattr(exc, "stderr_tail", None)
    reason = getattr(exc, "reason", None) or str(exc)[:500]
    if isinstance(exc, YtdlpDownloadError):
        exit_code = exc.exit_code
        stderr_tail = exc.stderr_tail
        reason = exc.reason or reason
    elif isinstance(exc, subprocess.CalledProcessError):
        exit_code = exc.returncode
        stderr_tail = (getattr(exc, "stderr", None) or str(exc))[-4000:]
        reason = f"ffmpeg failed (exit {exc.returncode})"

    decision_log(
        "stream_import",
        "import_failed",
        vod_id=vod_id,
        job_id=job_id,
        reason=reason,
        exit_code=exit_code,
        stderr_tail=stderr_tail or str(exc)[-2000:],
        range=section,
        rangeStartMs=range_start,
        rangeEndMs=range_end,
    )
    flush_decision_log(force=True)


def run_stream_import_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    vod_id = payload.get("vodId")
    if not vod_id:
        raise RuntimeError("missing vodId")

    from clips_worker.decision_log import bind_decision_log, flush_decision_log, unbind_decision_log

    bind_decision_log(conn, str(job.get("id") or ""))
    vod_snapshot: dict | None = None
    try:
        vod_snapshot = _run_stream_import_job_inner(conn, job, post_progress, payload, vod_id)
    except Exception as exc:
        _log_import_failed(exc, vod_id=vod_id, job_id=str(job.get("id") or ""), vod=vod_snapshot)
        raise
    finally:
        flush_decision_log(force=True)
        unbind_decision_log()


def _run_stream_import_job_inner(conn, job: dict, post_progress, payload: dict, vod_id: str) -> dict | None:
    from clips_worker.gpu.render_warmup import schedule_modal_warmup_background

    schedule_modal_warmup_background()

    from psycopg2.extras import RealDictCursor

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT v.*, p."workspaceId", p.settings, p.id AS project_id, c.login AS channel_login
            FROM stream_vods v
            JOIN clip_projects p ON p.id = v."projectId"
            LEFT JOIN stream_channels c ON c.id = v."channelId"
            WHERE v.id = %s
            """,
            (vod_id,),
        )
        vod = dict(cur.fetchone())
    if not vod:
        raise RuntimeError("vod not found")
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            'SELECT "rangeStartMs", "rangeEndMs" FROM clip_projects WHERE id=%s',
            (vod["project_id"],),
        )
        prow = cur.fetchone()
    if prow:
        prs = int(prow.get("rangeStartMs") or 0)
        pre = int(prow.get("rangeEndMs") or 0)
        if pre > prs:
            vrs = int(vod.get("rangeStartMs") or 0)
            vre = int(vod.get("rangeEndMs") or 0)
            if vre <= vrs or (vrs == 0 and prs > 0):
                vod["rangeStartMs"] = prs
                vod["rangeEndMs"] = pre
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE stream_vods SET "rangeStartMs"=%s, "rangeEndMs"=%s, "updatedAt"=NOW() WHERE id=%s',
                        (prs, pre, vod_id),
                    )
                conn.commit()
    if vod.get("channel_login") and not vod.get("channelLogin"):
        vod["channelLogin"] = vod["channel_login"]

    from clips_worker.decision_log import decision_log

    decision_log(
        "stream_import",
        "import_begin",
        vod_id=vod_id,
        job_id=str(job.get("id") or ""),
        url=vod.get("url"),
        platform=vod.get("platform"),
        triggeredBy=vod.get("triggeredBy"),
        allowGrowing=_allow_twitch_growing_vod(vod),
    )

    def _log_range_plan(v: dict) -> None:
        decision_log(
            "streamer",
            "range_plan",
            vod_id=vod_id,
            job_id=str(job.get("id") or ""),
            rangeStartMs=int(v.get("rangeStartMs") or 0),
            rangeEndMs=int(v.get("rangeEndMs") or 0),
            section=_section_from_range(int(v.get("rangeStartMs") or 0), v.get("rangeEndMs")),
        )

    rolling_tick = payload.get("rollingTick") is not None
    if rolling_tick or _rolling_import_mode(vod, payload):
        from clips_worker.streamer.rolling_ingest import abort_rolling_autopull_if_stopped

        if abort_rolling_autopull_if_stopped(
            conn,
            vod=vod,
            vod_id=vod_id,
            project_id=str(vod["project_id"]),
            job=job,
            post_progress=post_progress,
        ):
            return vod

    if _maybe_complete_import_from_state(conn, vod, job, vod["project_id"], vod_id, post_progress):
        return vod

    url = vod.get("url")
    workspace_id = vod["workspaceId"]
    project_id = vod["project_id"]
    SCRATCH.mkdir(parents=True, exist_ok=True)

    if not url and (vod.get("platform") == "upload" or vod.get("sourceType") == "upload"):
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                'SELECT "uploadId", "rangeStartMs", "rangeEndMs" FROM clip_projects WHERE id=%s',
                (project_id,),
            )
            prow = cur.fetchone()
            cur.execute('SELECT key FROM clip_uploads WHERE id=%s', (prow["uploadId"],))
            urow = cur.fetchone()
        if not prow or not urow:
            raise RuntimeError("missing upload for stream import")
        range_start_ms = int(prow.get("rangeStartMs") or vod.get("rangeStartMs") or 0)
        range_end_ms = int(prow.get("rangeEndMs") or vod.get("rangeEndMs") or 0)
        effective_ms = (
            max(0, range_end_ms - range_start_ms)
            if range_end_ms > range_start_ms
            else int(prow["rangeEndMs"] or vod.get("durationMs") or 0)
        )
        if effective_ms <= 0:
            raise RuntimeError("missing duration on upload")
        cap_err = check_cap(conn, workspace_id, effective_ms // 1000)
        if cap_err:
            raise RuntimeError(cap_err)
        use_long = effective_ms > FULL_DOWNLOAD_MAX_MIN * 60 * 1000
        with Heartbeat(job["id"], post_progress, every_s=45) as hb:
            with tempfile.TemporaryDirectory(dir=SCRATCH) as td:
                src = Path(td) / "upload.mp4"
                download_object(urow["key"], src)
                dur_s = probe_duration(src)
                upload_dur_ms = int(dur_s * 1000)
                if range_end_ms <= range_start_ms and upload_dur_ms > 0:
                    range_end_ms = upload_dur_ms
                duration_ms = effective_ms or upload_dur_ms
                audio_out = Path(td) / "audio.opus"
                _extract_upload_audio(
                    src,
                    audio_out,
                    long_form=use_long,
                    range_start_ms=range_start_ms,
                    range_end_ms=range_end_ms if range_end_ms > range_start_ms else 0,
                )
                audio_key = stream_audio_key(workspace_id, vod_id)
                upload_file(audio_key, audio_out, "audio/opus")
                state = _state_for_upload(workspace_id, vod_id, urow["key"], src, td)
                state["audioKey"] = audio_key
                pri = job_priority(conn, str(vod.get("workspaceId") or ""), vod.get("triggeredBy") or "upload")
                analyze_id = f"job_{uuid.uuid4().hex}"
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE stream_vods SET "durationMs"=%s, state=%s::jsonb, "updatedAt"=NOW() WHERE id=%s',
                        (duration_ms, json.dumps(state), vod_id),
                    )
                    cur.execute(
                        """
                        INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
                        VALUES (%s,%s,'STREAM_ANALYZE','QUEUED',%s::jsonb,%s,NOW())
                        """,
                        (analyze_id, project_id, json.dumps({"vodId": vod_id}), pri),
                    )
                conn.commit()
        post_progress(
            job["id"],
            {"projectStatus": "QUEUED", "stage": "queued", "progress": 25, "jobStatus": "DONE"},
        )
        return vod

    if not url:
        raise RuntimeError("missing stream url")

    allow_growing = _allow_twitch_growing_vod(vod)
    from clips_worker.streamer.twitch_archive_resolve import guard_twitch_growing_archive_url

    guard_twitch_growing_archive_url(vod, url, allow_growing=allow_growing)

    with Heartbeat(job["id"], post_progress, every_s=45) as hb:
        hb.update(stage="Downloading", progress=5)
        post_progress(
            job["id"],
            {"projectStatus": "PREPARING", "stage": "Downloading", "progress": 5, "jobStatus": "RUNNING"},
        )
        allow_growing = _allow_twitch_growing_vod(vod)
        rolling_finalize = bool(payload.get("rollingFinalize"))
        meta_raw = metadata(url, allow_twitch_growing_vod=allow_growing)
        meta = parse_metadata(meta_raw)
        dur_s = meta["duration_s"] or 0
        if _rolling_preflight_after_meta(
            conn,
            job=job,
            vod=vod,
            project_id=project_id,
            vod_id=vod_id,
            payload=payload,
            post_progress=post_progress,
            meta_dur_s=float(dur_s),
        ):
            cleanup_vod_import_dir(vod_id)
            return vod
        _log_range_plan(vod)
        effective_ms = _effective_duration_ms(vod, dur_s)
        _enforce_paste_vod_duration_cap(vod, effective_ms)
        cap_err = check_cap(conn, workspace_id, effective_ms // 1000)
        if cap_err:
            raise RuntimeError(cap_err)

        kind = vod.get("sourceType") or "vod"
        section = _section_from_range(int(vod.get("rangeStartMs") or 0), vod.get("rangeEndMs"))

        # Paste Twitch/Kick vod/highlight: never download full MP4 to worker disk (Rick storage contract).
        if kind != "clip":
            print(
                f"[clipper:stream] import_audio_only vodId={vod_id} projectId={project_id} "
                f"kind={kind} effectiveMs={effective_ms}",
                flush=True,
            )
            post_progress(
                job["id"],
                {
                    "projectStatus": "PREPARING",
                    "stage": "Downloading audio",
                    "progress": 8,
                    "jobStatus": "RUNNING",
                },
            )

            from clips_worker.progress_throttle import ThrottledProgressPoster

            throttled = ThrottledProgressPoster(post_progress, job["id"])

            def on_pct(pct: float) -> None:
                prog = 8 + int(min(12, pct * 0.12))
                hb.update(stage="Downloading audio", progress=prog)
                throttled.post(
                    {
                        "projectStatus": "PREPARING",
                        "stage": "Downloading audio",
                        "progress": prog,
                        "jobStatus": "RUNNING",
                    },
                )

            from clips_worker.streamer.audio_first_ingest import (
                delete_local_ingest_file,
                ingest_vod_audio,
                stream_audio_first_ingest_enabled,
            )
            from clips_worker.streamer.live_capture import ingest_live_capture_window, is_twitch_live_capture
            from clips_worker.streamer.rolling_ingest import rolling_chunk_min

            prior_state = _vod_state_dict(vod)
            if is_twitch_live_capture(vod):
                window_start = int(vod.get("rangeStartMs") or 0)
                window_end = int(vod.get("rangeEndMs") or 0)
                chunk_s = max(3, (window_end - window_start) // 1000)
                login = str(
                    prior_state.get("channelLogin") or vod.get("channelLogin") or vod.get("channel_login") or ""
                )
                capture_video, capture_audio, _, audio_ms = ingest_live_capture_window(
                    url,
                    duration_s=chunk_s,
                    job_id=str(job["id"]),
                    vod_id=vod_id,
                    login=login,
                    offset_ms=window_start,
                    chunk_min=rolling_chunk_min(prior_state),
                    archive_resolve_reason=str(prior_state.get("archiveResolveReason") or ""),
                    progress_cb=on_pct,
                )
                duration_ms = audio_ms or max(1, window_end - window_start)
                from clips_worker.streamer.keys import stream_window_audio_key, stream_window_capture_video_key

                audio_key = stream_window_audio_key(workspace_id, vod_id, window_end)
                video_key = stream_window_capture_video_key(workspace_id, vod_id, window_end)
                upload_file(audio_key, capture_audio, "audio/opus")
                upload_file(video_key, capture_video, "video/mp4")
                try:
                    capture_audio.unlink(missing_ok=True)
                    capture_video.unlink(missing_ok=True)
                except OSError:
                    pass
                from clips_worker.streamer.rolling_ingest import mark_rolling_pull_complete

                mark_rolling_pull_complete(
                    conn,
                    vod_id,
                    window_end,
                    start_ms=window_start,
                    job_id=str(job["id"]),
                )
                state = {
                    **prior_state,
                    "audioKey": audio_key,
                    "windowCaptureVideoKey": video_key,
                    "windowCaptureEndMs": window_end,
                    "importMeta": {"tags": meta.get("tags") or [], "liveCapture": True},
                }
                from clips_worker.streamer.channel_resolve import resolve_vod_channel_fields

                ch_fields = resolve_vod_channel_fields(vod, meta, url)
                if ch_fields.get("login"):
                    state["channelLogin"] = ch_fields["login"]
                if ch_fields.get("display"):
                    state["channelDisplayName"] = ch_fields["display"]
                _complete_rolling_window_import(
                    conn,
                    job=job,
                    vod=vod,
                    project_id=project_id,
                    vod_id=vod_id,
                    payload=payload,
                    state=state,
                    meta=meta,
                    duration_ms=duration_ms,
                    post_progress=post_progress,
                    hb=hb,
                    analyze_source="live_capture_window",
                )
                return vod

            window_start_ms = int(vod.get("rangeStartMs") or 0)
            window_end_ms = int(vod.get("rangeEndMs") or 0)
            platform = str(vod.get("platform") or "").lower()
            prior_state = _vod_state_dict(vod)
            growing = bool(meta_raw.get("growing_vod"))
            rolling_window = bool(
                _rolling_import_mode(vod, payload) or (allow_growing and growing)
            )
            use_hls = platform == "twitch" and rolling_window and window_end_ms > window_start_ms

            if use_hls:
                cache_dir = vod_import_dir(vod_id)
                cache_dir.mkdir(parents=True, exist_ok=True)
                audio_key, video_key, vod_start, vod_end, wmeta = _ingest_twitch_hls_window(
                    url=url,
                    meta_raw=meta_raw,
                    workspace_id=workspace_id,
                    vod_id=vod_id,
                    window_start_ms=window_start_ms,
                    window_end_ms=window_end_ms,
                    job_id=str(job["id"]),
                    cache_dir=cache_dir,
                )
                from clips_worker.streamer.rolling_ingest import mark_rolling_pull_complete

                mark_rolling_pull_complete(
                    conn,
                    vod_id,
                    vod_end,
                    start_ms=window_start_ms,
                    job_id=str(job["id"]),
                )
                windows = dict(prior_state.get("windows") or {})
                windows[str(window_end_ms)] = wmeta
                state = {
                    **prior_state,
                    "audioKey": audio_key,
                    "vodStartMs": vod_start,
                    "windows": windows,
                    "importMeta": {"tags": meta.get("tags") or []},
                }
                if video_key:
                    state["windowCaptureVideoKey"] = video_key
                    state["windowCaptureEndMs"] = window_end_ms
                duration_ms = max(1, window_end_ms - window_start_ms)
                from clips_worker.streamer.channel_resolve import resolve_vod_channel_fields

                ch_fields = resolve_vod_channel_fields(vod, meta, url)
                if ch_fields.get("login"):
                    state["channelLogin"] = ch_fields["login"]
                if ch_fields.get("display"):
                    state["channelDisplayName"] = ch_fields["display"]
                if _rolling_import_mode(vod, payload):
                    _complete_rolling_window_import(
                        conn,
                        job=job,
                        vod=vod,
                        project_id=project_id,
                        vod_id=vod_id,
                        payload=payload,
                        state=state,
                        meta=meta,
                        duration_ms=duration_ms,
                        post_progress=post_progress,
                        hb=hb,
                    )
                    cleanup_vod_import_dir(vod_id)
                    return vod
                if allow_growing and growing and not rolling_finalize:
                    if duration_ms <= 0:
                        _rolling_import_idle_done(
                            conn,
                            job=job,
                            vod=vod,
                            project_id=project_id,
                            vod_id=vod_id,
                            post_progress=post_progress,
                            reason="no_audio_downloaded",
                        )
                        cleanup_vod_import_dir(vod_id)
                        return vod
                    _complete_rolling_window_import(
                        conn,
                        job=job,
                        vod=vod,
                        project_id=project_id,
                        vod_id=vod_id,
                        payload=payload,
                        state=state,
                        meta=meta,
                        duration_ms=duration_ms,
                        post_progress=post_progress,
                        hb=hb,
                        analyze_source="growing_live_import",
                        schedule_growing_tick=True,
                    )
                    cleanup_vod_import_dir(vod_id)
                    return vod

            staged_audio: Path | None = None
            if stream_audio_first_ingest_enabled():
                staged_audio, _ingest_metrics = ingest_vod_audio(
                    url,
                    job_id=str(job["id"]),
                    vod_id=vod_id,
                    section=section,
                    progress_cb=on_pct,
                )
                audio_path = staged_audio
            else:
                cache_dir = vod_import_dir(vod_id)
                audio_out = str(cache_dir / "audio.%(ext)s")
                download_audio(url, audio_out, section=section, progress_cb=on_pct, workdir=str(cache_dir))
                audio_path = pick_completed_audio(cache_dir)
            if audio_path is None:
                raise RuntimeError("audio download incomplete (no finished audio file)")
            duration_ms = effective_ms or int(dur_s * 1000)
            audio_key = stream_audio_key(workspace_id, vod_id)
            upload_file(audio_key, audio_path, "audio/opus")
            if staged_audio is not None:
                delete_local_ingest_file(staged_audio)
            prior_state = _vod_state_dict(vod)
            state = {
                **prior_state,
                "audioKey": audio_key,
                "importMeta": {"tags": meta.get("tags") or []},
            }
            from clips_worker.streamer.channel_resolve import resolve_vod_channel_fields

            ch_fields = resolve_vod_channel_fields(vod, meta, url)
            if ch_fields.get("login"):
                state["channelLogin"] = ch_fields["login"]
            if ch_fields.get("display"):
                state["channelDisplayName"] = ch_fields["display"]
            growing = bool(meta_raw.get("growing_vod"))
            if _rolling_import_mode(vod, payload):
                _complete_rolling_window_import(
                    conn,
                    job=job,
                    vod=vod,
                    project_id=project_id,
                    vod_id=vod_id,
                    payload=payload,
                    state=state,
                    meta=meta,
                    duration_ms=duration_ms,
                    post_progress=post_progress,
                    hb=hb,
                )
                return vod
            if allow_growing and growing and not rolling_finalize:
                if duration_ms <= 0:
                    _rolling_import_idle_done(
                        conn,
                        job=job,
                        vod=vod,
                        project_id=project_id,
                        vod_id=vod_id,
                        post_progress=post_progress,
                        reason="no_audio_downloaded",
                    )
                    cleanup_vod_import_dir(vod_id)
                    return vod
                _complete_rolling_window_import(
                    conn,
                    job=job,
                    vod=vod,
                    project_id=project_id,
                    vod_id=vod_id,
                    payload=payload,
                    state=state,
                    meta=meta,
                    duration_ms=duration_ms,
                    post_progress=post_progress,
                    hb=hb,
                    analyze_source="growing_live_import",
                    schedule_growing_tick=True,
                )
                return vod
            pri = job_priority(conn, str(vod.get("workspaceId") or ""), vod.get("triggeredBy") or "paste")
            analyze_id = f"job_{uuid.uuid4().hex}"
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE clip_projects
                    SET title=COALESCE(%s, title), stage='Downloading audio', progress=20, "updatedAt"=NOW()
                    WHERE id=%s
                    """,
                    (meta.get("title"), project_id),
                )
                cur.execute(
                    """
                    UPDATE stream_vods
                    SET title=%s, category=%s, "durationMs"=%s, chapters=%s::jsonb, state=%s::jsonb, "updatedAt"=NOW()
                    WHERE id=%s
                    """,
                    (
                        meta.get("title"),
                        meta.get("category"),
                        duration_ms,
                        json.dumps(meta.get("chapters")) if meta.get("chapters") else None,
                        json.dumps(state),
                        vod_id,
                    ),
                )
                cur.execute(
                    """
                    INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
                    VALUES (%s,%s,'STREAM_ANALYZE','QUEUED',%s::jsonb,%s,NOW())
                    """,
                    (analyze_id, project_id, json.dumps({"vodId": vod_id}), pri),
                )
            conn.commit()
            cleanup_vod_import_dir(vod_id)
            sweep_stale_failed_import_dirs(conn=conn)
            post_progress(
                job["id"],
                {"projectStatus": "QUEUED", "stage": "queued", "progress": 25, "jobStatus": "DONE"},
            )
            return vod

        print(
            f"[clipper:stream] import_clip_section vodId={vod_id} projectId={project_id} kind=clip",
            flush=True,
        )
        usage = shutil.disk_usage(SCRATCH)
        est = int(dur_s * 2_000_000)
        if usage.free < est * 2:
            raise RuntimeError("Not enough scratch disk for this download")

        def on_pct(pct: float) -> None:
            prog = 5 + int(min(20, pct * 0.2))
            hb.update(stage="Downloading", progress=prog)
            post_progress(
                job["id"],
                {"projectStatus": "PREPARING", "stage": "Downloading", "progress": prog, "jobStatus": "RUNNING"},
            )

        cache_dir = vod_import_dir(vod_id)
        dest = str(cache_dir / "source.mp4")

        download_video(url, dest, section=section, progress_cb=on_pct, workdir=str(cache_dir))
        path = Path(dest)
        dur_s, width, height = probe_video(path)
        duration_ms = int(round(dur_s * 1000))
        size = path.stat().st_size

        upload_id = f"upl_{uuid.uuid4().hex}"
        key = upload_source_key(workspace_id, upload_id, "mp4")
        upload_file(key, path, "video/mp4")

        audio_out = cache_dir / "audio.opus"
        from clips_worker.audio_extract import audio_extract_cmd

        subprocess.check_call(audio_extract_cmd(path, audio_out, rate=None, mono=False, codec="libopus"))
        audio_key = stream_audio_key(workspace_id, vod_id)
        upload_file(audio_key, audio_out, "audio/opus")
        state = {
            "audioKey": audio_key,
            "localUploadKey": key,
            "importMeta": {"tags": meta.get("tags") or []},
        }
        pri = job_priority(conn, str(vod.get("workspaceId") or ""), vod.get("triggeredBy") or "paste")
        analyze_id = f"job_{uuid.uuid4().hex}"

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO clip_uploads (id, "workspaceId", key, filename, bytes, mime, "durationMs", width, height, status, "createdAt")
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'COMPLETE',NOW())
                """,
                (upload_id, workspace_id, key, "stream.mp4", size, "video/mp4", duration_ms, width, height),
            )
            cur.execute(
                """
                UPDATE clip_projects
                SET "uploadId"=%s, title=COALESCE(%s, title), "rangeEndMs"=GREATEST("rangeEndMs", %s),
                    stage='Downloading audio', progress=20, "updatedAt"=NOW()
                WHERE id=%s
                """,
                (upload_id, meta.get("title"), duration_ms, project_id),
            )
            cur.execute(
                """
                UPDATE stream_vods SET title=%s, category=%s, "durationMs"=%s, chapters=%s::jsonb, state=%s::jsonb, "updatedAt"=NOW()
                WHERE id=%s
                """,
                (
                    meta.get("title"),
                    meta.get("category"),
                    duration_ms,
                    json.dumps(meta.get("chapters")) if meta.get("chapters") else None,
                    json.dumps(state),
                    vod_id,
                ),
            )
            cur.execute(
                """
                INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
                VALUES (%s,%s,'STREAM_ANALYZE','QUEUED',%s::jsonb,%s,NOW())
                """,
                (analyze_id, project_id, json.dumps({"vodId": vod_id}), pri),
            )
        conn.commit()
        cleanup_vod_import_dir(vod_id)

    sweep_stale_failed_import_dirs(conn=conn)

    post_progress(
        job["id"],
        {"projectStatus": "QUEUED", "stage": "queued", "progress": 25, "jobStatus": "DONE"},
    )
    return vod
