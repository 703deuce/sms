"""STREAM_ANALYZE: chunk audio, GPU transcribe, merge, rank moments, enqueue STREAM_RENDER."""
from __future__ import annotations

import json
import shutil
import time
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path

from psycopg2.extras import RealDictCursor

from clips_worker.streamer.progress import analyze_progress_payload
from clips_worker.heartbeat import Heartbeat
from clips_worker.pipeline import insert_clips_batch
from clips_worker.storage import download_object, put_json, upload_file
from clips_worker.streamer.chunking import merge_words
from clips_worker.streamer.config import SCRATCH, stream_chat_signal_enabled
from clips_worker.streamer.keys import (
    stream_audio_key,
    stream_candidates_key,
    stream_chat_key,
    stream_signals_key,
)
from clips_worker.streamer.viewer_clips.fetch import fetch_viewer_clips_for_vod
from clips_worker.streamer.chat.resolve import resolve_chat_after_transcribe
from clips_worker.streamer.chat.source import get_chat
from clips_worker.streamer.metadata import enrich_streamer_meta
from clips_worker.streamer.chunk_signals import merge_chunk_signal_curves
from clips_worker.streamer.long_vod_analyze import (
    effective_vod_cost_cap_usd,
    enforce_vod_cost_cap,
    log_stream_analyze_summary,
    resolve_analyze_chunk_plan,
    transcribe_vod_chunks,
)
from clips_worker.streamer.stream_dedupe import dedupe_stream_picks
from clips_worker.streamer.stream_pipeline import clear_stream_vod_error
from clips_worker.streamer.rank import rank_moments
from clips_worker.streamer.signals.chat import chat_bin_metrics, log_clipper_chat
from clips_worker.streamer.collab_detect import CollabDetection, detect_collab, log_collab_detection
from clips_worker.streamer.transcribe_stream import log_stream_transcribe_summary
from clips_worker.streamer.usage import check_cap, job_priority, meter_vod_once


def _load_vod(conn, vod_id: str) -> dict:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT v.*, p."workspaceId", p.settings, p.id AS project_id, p."transcriptKey"
            FROM stream_vods v
            JOIN clip_projects p ON p.id = v."projectId"
            WHERE v.id = %s
            """,
            (vod_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("vod missing")
    return dict(row)


def _save_state(conn, vod_id: str, state: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE stream_vods SET state = %s::jsonb, "updatedAt" = NOW() WHERE id = %s',
            (json.dumps(state), vod_id),
        )
    conn.commit()


def run_stream_analyze_job(conn, job: dict, post_progress) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    vod_id = payload.get("vodId")
    if not vod_id:
        raise RuntimeError("missing vodId")

    from clips_worker.stage_log import bind_stage_context, stage_span

    vod = _load_vod(conn, vod_id)
    workspace_id = vod["workspaceId"]
    project_id = vod["project_id"]
    bind_stage_context(project_id=str(project_id), job_id=str(job["id"]))
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state)
    settings = vod.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)
    from clips_worker.target_clip_len import enrich_settings_with_clip_length

    settings = enrich_settings_with_clip_length(settings, payload)

    audio_key = state.get("audioKey") or stream_audio_key(workspace_id, vod_id)
    duration_ms = int(vod.get("durationMs") or 0)
    if not duration_ms:
        raise RuntimeError("missing durationMs on vod")

    analysed_s = int((vod.get("rangeEndMs") or duration_ms) - (vod.get("rangeStartMs") or 0)) // 1000
    cap_err = check_cap(conn, workspace_id, analysed_s)
    if cap_err:
        raise RuntimeError(cap_err)
    clear_stream_vod_error(conn, vod_id)

    SCRATCH.mkdir(parents=True, exist_ok=True)
    scratch = (SCRATCH / f"analyze_{vod_id}").resolve()
    try:
        with Heartbeat(job["id"], post_progress, every_s=45) as hb:
            state = meter_vod_once(conn, workspace_id, vod_id, analysed_s, state)
            hb.update(stage="Transcribing", progress=22)
            post_progress(
                job["id"],
                {"projectStatus": "TRANSCRIBING", "stage": "Transcribing", "progress": 22, "jobStatus": "RUNNING"},
            )

            chunk_ms, overlap_ms, ranges = resolve_analyze_chunk_plan(duration_ms)
            state["chunkPlan"] = {
                "v": 1,
                "chunkMs": chunk_ms,
                "overlapMs": overlap_ms,
                "ranges": [{"startMs": s, "endMs": e} for s, e in ranges],
            }
            _save_state(conn, vod_id, state)
            chunk_min = chunk_ms // 60_000
            print(
                f"[clipper:stream] analyze_chunk_plan vodId={vod_id} chunks={len(ranges)} "
                f"chunkMin={chunk_min} overlapS={overlap_ms // 1000}",
                flush=True,
            )
            chunks_state = state.get("chunks") or {}

            scratch.mkdir(parents=True, exist_ok=True)
            audio_path = scratch / "audio.opus"
            with stage_span("source_download", heartbeat=True):
                download_object(audio_key, audio_path)

            probe_video: Path | None = None
            for key_name in ("analysisProxyKey", "localUploadKey"):
                storage_key = state.get(key_name)
                if storage_key:
                    probe_video = scratch / "collab_probe_source.mp4"
                    download_object(str(storage_key), probe_video)
                    break

            collab_cached = state.get("collabDetection")
            if isinstance(collab_cached, dict) and collab_cached.get("provider"):
                detection = CollabDetection(
                    collab_detected=bool(collab_cached.get("collabDetected")),
                    provider=str(collab_cached.get("provider")),
                    signals=collab_cached.get("signals") or {},
                )
            else:
                detection = detect_collab(
                    vod=vod,
                    state=state,
                    settings=settings,
                    video_path=probe_video,
                    scratch=scratch,
                )
                state["collabDetection"] = {
                    "collabDetected": detection.collab_detected,
                    "provider": detection.provider,
                    "signals": detection.signals,
                }
                _save_state(conn, vod_id, state)
            log_collab_detection(vod_id=vod_id, project_id=project_id, detection=detection)
            vod_transcribe_provider = detection.provider
            preflight_est = enforce_vod_cost_cap(
                vod_transcribe_provider,
                analysed_s / 60.0,
                len(ranges),
            )
            cap_usd = effective_vod_cost_cap_usd(analysed_s / 60.0, vod_transcribe_provider)
            print(
                f"[clipper:stream] analyze_cost_preflight vodId={vod_id} est_cost_usd={preflight_est:.4f} "
                f"cap_usd={cap_usd:.4f}",
                flush=True,
            )

            chunk_started = time.time()
            transcribe_fallback: str | None = None
            first_cold_start_s: float | None = None
            chat_executor = ThreadPoolExecutor(max_workers=1)
            if stream_chat_signal_enabled():
                chat_future = chat_executor.submit(get_chat, vod, None)
            else:
                chat_future = Future()
                chat_future.set_result((None, "disabled"))

            def _persist_state(st: dict) -> None:
                _save_state(conn, vod_id, st)

            def _on_chunk(done_n: int, total: int, res) -> None:
                nonlocal transcribe_fallback, first_cold_start_s
                payload_prog = analyze_progress_payload(
                    stage=f"Transcribing {done_n}/{total}",
                    chunk_done=done_n,
                    chunk_total=total,
                    started_at=float(state.get("analyzeStartedAt") or chunk_started),
                )
                if getattr(res, "transcription_engine", None):
                    payload_prog["transcriptionEngine"] = res.transcription_engine
                if getattr(res, "fallback_reason", None):
                    payload_prog["transcriptionFallbackReason"] = res.fallback_reason
                    if vod_transcribe_provider.startswith("modal") and res.transcription_engine == "deepgram":
                        transcribe_fallback = "modal_deepgram"
                    elif detection.collab_detected and res.transcription_engine != "modal_diarize":
                        transcribe_fallback = f"collab_{res.transcription_engine}"
                hb.update(stage=payload_prog["stage"], progress=payload_prog["progress"])
                post_progress(job["id"], payload_prog)

            with stage_span("transcribe", heartbeat=True, chunks=len(ranges)):
                all_word_chunks, chunk_signal_payloads, chunk_metrics = transcribe_vod_chunks(
                    conn=conn,
                    vod_id=vod_id,
                    workspace_id=workspace_id,
                    project_id=project_id,
                    ranges=ranges,
                    audio_path=audio_path,
                    scratch=scratch,
                    state=state,
                    chunks_state=chunks_state,
                    vod_transcribe_provider=vod_transcribe_provider,
                    settings=settings,
                    save_state=_persist_state,
                    on_chunk_progress=_on_chunk,
                )

            words = merge_words([c for c in all_word_chunks if c], ranges)
            audio_minutes = analysed_s / 60.0
            summary_provider = vod_transcribe_provider
            if transcribe_fallback:
                summary_provider = "deepgram"
            log_stream_transcribe_summary(
                vod_id=vod_id,
                project_id=project_id,
                provider=summary_provider,
                audio_minutes=audio_minutes,
                gpu_seconds=chunk_metrics.gpu_seconds,
                cold_start_s=first_cold_start_s,
                fallback=transcribe_fallback,
            )
            transcript_key = vod["transcriptKey"]
            put_json(transcript_key, words)
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE clip_projects SET "transcriptWords" = %s::jsonb, "updatedAt" = NOW() WHERE id = %s',
                    (json.dumps(words), project_id),
                )
            conn.commit()

            post_progress(
                job["id"],
                {"projectStatus": "FINDING_CLIPS", "stage": "Finding moments", "progress": 58, "jobStatus": "RUNNING"},
            )
            chapters = vod.get("chapters")
            if isinstance(chapters, str):
                chapters = json.loads(chapters)
            try:
                with stage_span("chat_resolve", heartbeat=True):
                    chat_messages, chat_source, state = resolve_chat_after_transcribe(chat_future, state)
            finally:
                chat_executor.shutdown(wait=False)
            if state.get("chatError"):
                _save_state(conn, vod_id, state)
            if chat_messages:
                from clips_worker.streamer.chat.twitch_gql import save_jsonl_gz

                chat_path = scratch / "chat.jsonl.gz"
                save_jsonl_gz(chat_path, chat_messages)
                ck = stream_chat_key(workspace_id, vod_id)
                upload_file(ck, chat_path, "application/gzip")
                state["chatKey"] = ck
                state.pop("chatError", None)
                _save_state(conn, vod_id, state)
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE stream_vods SET "chatSource" = %s, "chatMessages" = %s, "updatedAt" = NOW() WHERE id = %s',
                    (chat_source, len(chat_messages) if chat_messages else 0, vod_id),
                )
            conn.commit()
            duration_s = max(1, int(duration_ms / 1000))
            platform = str(vod.get("platform") or "unknown").lower()
            chat_metrics = (
                chat_bin_metrics(chat_messages, duration_s) if chat_messages else None
            )
            chat_used = bool(stream_chat_signal_enabled() and chat_messages)
            log_clipper_chat(
                vod_id=vod_id,
                platform=platform,
                message_count=len(chat_messages) if chat_messages else 0,
                metrics=chat_metrics,
                used=chat_used,
            )
            viewer_clips = fetch_viewer_clips_for_vod(vod, conn)
            vod_signal_curves = merge_chunk_signal_curves(chunk_signal_payloads, duration_s)
            video_signal = None
            video_moments: list[dict] = []
            from clips_worker.video_picker import video_picker_enabled
            from clips_worker.streamer.video_picker_stream import stream_chunk_video_signals

            if video_picker_enabled():
                from clips_worker.video_picker import resolve_video_picker_stream_ranges

                plan_ranges = resolve_video_picker_stream_ranges(duration_ms)
                with stage_span("video_picker", heartbeat=True, chunks=len(plan_ranges)):
                    video_signal, video_moments, _vp_cost = stream_chunk_video_signals(
                        vod=vod,
                        state=state,
                        ranges=plan_ranges,
                        scratch=scratch,
                        job_id=str(job["id"]),
                        target_clip_len_s=settings.get("target_clip_len_s"),
                    )
            with stage_span("rank_moments", heartbeat=True):
                picks, signals_payload = rank_moments(
                    audio_path=audio_path,
                    words=words,
                    duration_ms=duration_ms,
                    settings=settings,
                    chapters=chapters if isinstance(chapters, list) else None,
                    chat_messages=chat_messages,
                    viewer_clips=viewer_clips or None,
                    vod_signal_curves=vod_signal_curves,
                    video_signal=video_signal,
                    video_moments=video_moments,
                )
            picks = dedupe_stream_picks(conn, vod, picks)
            signals_payload["chunkedSignals"] = True
            signals_payload["chunkCount"] = len(chunk_signal_payloads)
            sig_key = stream_signals_key(workspace_id, vod_id)
            put_json(sig_key, signals_payload)
            cand_key = stream_candidates_key(workspace_id, vod_id)
            put_json(
                cand_key,
                {
                    "v": 1,
                    "vodId": vod_id,
                    "candidates": signals_payload.get("candidates") or [],
                    "tierCounts": signals_payload.get("tierCounts"),
                },
            )
            state["candidatesKey"] = cand_key
            state["rankingVersion"] = 2
            _save_state(conn, vod_id, state)
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE stream_vods SET "signalsKey" = %s, "updatedAt" = NOW() WHERE id = %s',
                    (sig_key, vod_id),
                )
            conn.commit()

            clip_rows = []
            for pick in picks:
                clip_id = f"clip_{uuid.uuid4().hex}"
                ai_meta = enrich_streamer_meta(
                    pick.ai_meta,
                    vod=vod,
                    peak_ms=pick.peak_ms,
                    clip_start_ms=pick.start_ms,
                    chapters=chapters if isinstance(chapters, list) else None,
                )
                clip_rows.append(
                    {
                        "id": clip_id,
                        "projectId": project_id,
                        "workspaceId": workspace_id,
                        "title": pick.title,
                        "reason": pick.hook,
                        "startMs": pick.start_ms,
                        "endMs": pick.end_ms,
                        "score": pick.score,
                        "scores": pick.scores,
                        "previewKey": None,
                        "posterKey": None,
                        "wordsKey": None,
                        "cropKey": None,
                        "edits": {},
                        "aiMeta": ai_meta,
                    }
                )
            inserted = insert_clips_batch(conn, clip_rows)
            log_stream_analyze_summary(
                vod_id=vod_id,
                vod_minutes=audio_minutes,
                chunks=len(ranges),
                transcribe_ms=chunk_metrics.transcribe_ms,
                est_cost_usd=chunk_metrics.est_cost_usd,
                clips_out=inserted if inserted else len(clip_rows),
            )

            pri = job_priority(conn, str(vod.get("workspaceId") or ""), vod.get("triggeredBy") or "paste")
            render_id = f"job_{uuid.uuid4().hex}"
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "createdAt")
                    VALUES (%s,%s,'STREAM_RENDER','QUEUED',%s::jsonb,%s,NOW())
                    """,
                    (render_id, project_id, json.dumps({"vodId": vod_id}), pri),
                )
            conn.commit()

        post_progress(
            job["id"],
            {"projectStatus": "RENDERING", "stage": "Rendering clips", "progress": 65, "jobStatus": "DONE"},
        )
    finally:
        shutil.rmtree(scratch, ignore_errors=True)
