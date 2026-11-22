"""Durable prerecorded Deepgram pass for the producer-only clipper path.

Never runs the legacy moment picker. Deepgram full JSON, per-utterance transcript,
word timing and provider-cost metadata are persisted before the project is READY.
"""
from __future__ import annotations

import json
import hashlib
import secrets
import uuid
import subprocess
from fractions import Fraction
from datetime import datetime,timezone,timedelta
from pathlib import Path
from tempfile import TemporaryDirectory


def _probe_source(conn, source_url: str, upload_id: str) -> None:
    """Non-billable best-effort ffprobe. Never print subprocess argv or signed URL."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_streams", "-of", "json", source_url],
            capture_output=True, text=True, timeout=45, check=False,
        )
        if result.returncode != 0:
            return
        streams = json.loads(result.stdout).get("streams") or []
        video = next((v for v in streams if v.get("codec_type") == "video"), None)
        has_audio = any(v.get("codec_type") == "audio" for v in streams)
        width = int(video.get("width")) if video and video.get("width") else None
        height = int(video.get("height")) if video and video.get("height") else None
        rate = video.get("avg_frame_rate") or video.get("r_frame_rate") if video else None
        fps = float(Fraction(str(rate))) if rate and rate != "0/0" else None
        if fps is not None and not (0.1 <= fps <= 240):
            fps = None
        rotation = None
        if video:
            tags = video.get("tags") or {}
            raw = tags.get("rotate")
            for datum in video.get("side_data_list") or []:
                if "rotation" in datum:
                    raw = datum["rotation"]
            rotation = int(float(raw)) if raw is not None else None
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE clip_uploads SET width=COALESCE(width,%s),height=COALESCE(height,%s),'
                '"fps"=COALESCE("fps",%s),"rotation"=COALESCE("rotation",%s),'
                '"hasAudio"=COALESCE("hasAudio",%s) WHERE id=%s',
                (width,height,fps,rotation,has_audio,upload_id),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        # Probe failure must never consume a second paid transcription attempt.
        return


def run_producer_transcribe_job(conn, job: dict) -> None:
    from clips_worker.deepgram_transcribe import _http_listen, map_deepgram_words, deepgram_model
    from clips_worker.media_transcribe_job import transcribe_cost_usd
    from clips_worker.storage import put_json, sign_url, upload_file

    project_id = str(job["projectId"])
    with conn.cursor() as cur:
        cur.execute(
            'SELECT p."workspaceId", p."uploadId", u.key, u."durationMs", p.settings '
            'FROM clip_projects p JOIN clip_uploads u ON u.id=p."uploadId" '
            'WHERE p.id=%s AND u.status=%s',
            (project_id, "COMPLETE"),
        )
        row = cur.fetchone()
    try:
        if not row or not row[2]:
            raise RuntimeError("producer_source_missing")
        workspace_id, upload_id, source_key, duration_ms, settings = row
        if isinstance(settings,str): settings=json.loads(settings)
        settings=settings if isinstance(settings,dict) else {}
        root=f"ws/{workspace_id}/projects/{project_id}/"
        media_url=sign_url(str(source_key), 3600)
        _probe_source(conn, media_url, str(upload_id))
        raw = _http_listen(audio_url=media_url,
                           model=deepgram_model(),language=settings.get("asrLanguage") or "en",
                           paragraphs=True,max_attempts=1,
                           timeout_s=min(7200.0,max(600.0,float(duration_ms or 0)/1000*1.5)))
        results = raw.get("results") or {}
        channels = results.get("channels") or []
        alternatives = channels[0].get("alternatives") or [] if channels else []
        alternative = alternatives[0] if alternatives else {}
        words = map_deepgram_words(alternative.get("words") or [])
        if not words:
            raise RuntimeError("producer_transcript_empty")
        utterances = results.get("utterances") or []
        compact = [
            {"start": float(u.get("start") or 0),
             "end": float(u.get("end") or 0),
             "speaker": u.get("speaker"),
             "text": str(u.get("transcript") or "").strip()}
            for u in utterances if isinstance(u, dict)
        ]
        if not compact:
            compact = [{"start": words[0]["s"], "end": words[-1]["e"],
                        "speaker": None, "text": str(alternative.get("transcript") or "")}]
        put_json(root + "deepgram.json", raw)
        put_json(root + "words.json", words)
        with TemporaryDirectory() as tmp:
            local = Path(tmp) / "transcript.compact.jsonl"
            local.write_text(
                "".join(json.dumps(u, ensure_ascii=False) + "\n" for u in compact),
                encoding="utf-8",
            )
            upload_file(root + "transcript.compact.jsonl", local, "application/x-ndjson")
        measured_ms = int(round(max(float(duration_ms or 0) / 1000, words[-1]["e"]) * 1000))
        cost_micros = round(transcribe_cost_usd("deepgram", measured_ms / 1000, 0) * 1_000_000)
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO clip_media_transcripts '
                '(id,"projectId","workspaceId",ref,"refId",status,words,'
                '"durationMs","costUsdMicros",provider,"createdAt","updatedAt") '
                'VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,now(),now()) '
                'ON CONFLICT ("projectId",ref,"refId") DO UPDATE SET '
                'status=EXCLUDED.status,words=EXCLUDED.words,'
                '"durationMs"=EXCLUDED."durationMs",'
                '"costUsdMicros"=EXCLUDED."costUsdMicros",provider=EXCLUDED.provider,'
                '"updatedAt"=now()',
                ("mtr_producer_" + project_id, project_id, workspace_id, "upload",
                 upload_id, "done", json.dumps(words), measured_ms, cost_micros, "deepgram"),
            )
            cur.execute(
                'UPDATE clip_projects SET status=%s,stage=%s,progress=%s,'
                '"transcriptKey"=%s,"updatedAt"=now() WHERE id=%s',
                ("READY", "agent_ready", 100, root + "words.json", project_id),
            )
            # A durable idempotent producer job is created alongside READY, not by the browser.
            id_="caf_"+str(uuid.uuid4())
            token_hash=hashlib.sha256((id_+":"+secrets.token_urlsafe(32)).encode()).hexdigest()
            cur.execute(
                'INSERT INTO clip_agent_finish_jobs '
                '(id,"workspaceId","projectId","clipId","idempotencyKey","tokenHash",'
                '"tokenExpiresAt",status,phase,kind,message,"createdAt","updatedAt") '
                'VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now(),now()) '
                'ON CONFLICT ("clipId","idempotencyKey") DO NOTHING',
                (id_,workspace_id,project_id,'project:'+project_id,
                 'auto-grok-'+project_id,token_hash,
                 datetime.now(timezone.utc)+timedelta(hours=36),'queued','dispatch',
                 'clips','Finding your best moments.'),
            )
        conn.commit()
    except Exception as exc:
        # A failed INSERT/UPDATE leaves psycopg2's transaction aborted.
        # Roll back before recording the terminal failure; never retry paid ASR.
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE clip_projects SET status=%s,stage=%s,error=%s,'
                '"updatedAt"=now() WHERE id=%s',
                ("FAILED", "transcription_failed", "We could not transcribe this video.", project_id),
            )
        conn.commit()
        print(f"[clipper:producer_transcribe] failed project={project_id} kind={type(exc).__name__}", flush=True)
        return  # No automatic paid Deepgram retry.
