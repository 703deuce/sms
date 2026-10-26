"""STREAM_ANALYZE: chunk audio, GPU transcribe, merge, rank moments, enqueue STREAM_RENDER."""
from __future__ import annotations

import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from psycopg2.extras import RealDictCursor

from clips_worker.gpu.base import TranscribeReq
from clips_worker.streamer.chunk_transcribe import transcribe_chunk_with_retry
from clips_worker.streamer.progress import analyze_progress_payload
from clips_worker.heartbeat import Heartbeat
from clips_worker.pipeline import insert_clips_batch
from clips_worker.storage import download_object, put_json, sign_url, upload_file
from clips_worker.streamer.chunking import ffmpeg_slice_opus, merge_words, plan_chunks
from clips_worker.streamer.config import CHUNK_MIN, CHUNK_OVERLAP_S, SCRATCH
from clips_worker.streamer.keys import stream_audio_key, stream_chat_key, stream_chunk_key, stream_signals_key
from clips_worker.streamer.viewer_clips.fetch import fetch_viewer_clips_for_vod
from clips_worker.streamer.chat.source import get_chat
from clips_worker.streamer.metadata import enrich_streamer_meta
from clips_worker.streamer.rank import rank_moments
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

    vod = _load_vod(conn, vod_id)
    workspace_id = vod["workspaceId"]
    project_id = vod["project_id"]
    state = vod.get("state") or {}
    if isinstance(state, str):
        state = json.loads(state)
    settings = vod.get("settings") or {}
    if isinstance(settings, str):
        settings = json.loads(settings)

    audio_key = state.get("audioKey") or stream_audio_key(workspace_id, vod_id)
    duration_ms = int(vod.get("durationMs") or 0)
    if not duration_ms:
        raise RuntimeError("missing durationMs on vod")

    analysed_s = int((vod.get("rangeEndMs") or duration_ms) - (vod.get("rangeStartMs") or 0)) // 1000
    cap_err = check_cap(conn, workspace_id, analysed_s)
    if cap_err:
        raise RuntimeError(cap_err)

    SCRATCH.mkdir(parents=True, exist_ok=True)
    with Heartbeat(job["id"], post_progress, every_s=45) as hb:
        state = meter_vod_once(conn, workspace_id, vod_id, analysed_s, state)
        hb.update(stage="Transcribing", progress=22)
        post_progress(
            job["id"],
            {"projectStatus": "TRANSCRIBING", "stage": "Transcribing", "progress": 22, "jobStatus": "RUNNING"},
        )

        chunk_ms = CHUNK_MIN * 60 * 1000
        overlap_ms = CHUNK_OVERLAP_S * 1000
        ranges = plan_chunks(duration_ms, chunk_ms, overlap_ms)
        chunks_state = state.get("chunks") or {}
        done = {int(k) for k, v in chunks_state.items() if v.get("wordsKey")}

        scratch = (SCRATCH / f"analyze_{vod_id}").resolve()
        scratch.mkdir(parents=True, exist_ok=True)
        audio_path = scratch / "audio.opus"
        download_object(audio_key, audio_path)

        chunk_started = time.time()
        chat_executor = ThreadPoolExecutor(max_workers=1)
        chat_future = chat_executor.submit(get_chat, vod, None)
        all_word_chunks: list[list[dict] | None] = [None] * len(ranges)
        for idx, (start_ms, end_ms) in enumerate(ranges):
            if idx in done:
                wkey = chunks_state[str(idx)]["wordsKey"]
                wp = scratch / f"words_{idx}.json"
                download_object(wkey, wp)
                all_word_chunks[idx] = json.loads(wp.read_text())
                continue

            chunk_path = scratch / f"chunk_{idx}.opus"
            ffmpeg_slice_opus(audio_path, chunk_path, start_ms, end_ms)
            ck = stream_chunk_key(workspace_id, vod_id, idx, "opus")
            upload_file(ck, chunk_path, "audio/opus")

            req = TranscribeReq(
                audio_path=str(chunk_path),
                audio_url=sign_url(ck, expires_s=7200),
                offset_ms=start_ms,
                language=(settings.get("streamer") or {}).get("language"),
            )
            prior = int((chunks_state.get(str(idx)) or {}).get("attempts") or 0)
            res = transcribe_chunk_with_retry(
                conn, req, workspace_id, project_id, idx, prior_attempts=prior
            )
            wkey = stream_chunk_key(workspace_id, vod_id, idx, "words.json")
            put_json(wkey, res.words)
            chunks_state[str(idx)] = {
                "wordsKey": wkey,
                "startMs": start_ms,
                "endMs": end_ms,
                "attempts": prior + 1,
                "done": True,
            }
            state["chunks"] = chunks_state
            state["analyzeStartedAt"] = state.get("analyzeStartedAt") or chunk_started
            _save_state(conn, vod_id, state)
            all_word_chunks[idx] = res.words

            done_n = len([k for k, v in chunks_state.items() if v.get("wordsKey")])
            payload_prog = analyze_progress_payload(
                stage=f"Transcribing {done_n}/{len(ranges)}",
                chunk_done=done_n,
                chunk_total=len(ranges),
                started_at=float(state.get("analyzeStartedAt") or chunk_started),
            )
            if getattr(res, "transcription_engine", None):
                payload_prog["transcriptionEngine"] = res.transcription_engine
            if getattr(res, "fallback_reason", None):
                payload_prog["transcriptionFallbackReason"] = res.fallback_reason
            hb.update(stage=payload_prog["stage"], progress=payload_prog["progress"])
            post_progress(job["id"], payload_prog)

        words = merge_words([c for c in all_word_chunks if c], ranges)
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
            chat_messages, chat_source = chat_future.result()
        except Exception:
            chat_messages, chat_source = None, "none"
        finally:
            chat_executor.shutdown(wait=False)
        if chat_messages:
            from clips_worker.streamer.chat.twitch_gql import save_jsonl_gz

            chat_path = scratch / "chat.jsonl.gz"
            save_jsonl_gz(chat_path, chat_messages)
            ck = stream_chat_key(workspace_id, vod_id)
            upload_file(ck, chat_path, "application/gzip")
            state["chatKey"] = ck
            _save_state(conn, vod_id, state)
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE stream_vods SET "chatSource" = %s, "chatMessages" = %s, "updatedAt" = NOW() WHERE id = %s',
                (chat_source, len(chat_messages) if chat_messages else 0, vod_id),
            )
        conn.commit()
        viewer_clips = fetch_viewer_clips_for_vod(vod, conn)
        picks, signals_payload = rank_moments(
            audio_path=audio_path,
            words=words,
            duration_ms=duration_ms,
            settings=settings,
            chapters=chapters if isinstance(chapters, list) else None,
            chat_messages=chat_messages,
            viewer_clips=viewer_clips or None,
        )
        sig_key = stream_signals_key(workspace_id, vod_id)
        put_json(sig_key, signals_payload)
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
        insert_clips_batch(conn, clip_rows)

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
