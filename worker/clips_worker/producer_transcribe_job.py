"""Durable prerecorded Deepgram pass for the producer-only clipper path.

Never runs the legacy moment picker. Deepgram full JSON, per-utterance transcript,
word timing and provider-cost metadata are persisted before the project is READY.
"""
from __future__ import annotations

import json
from pathlib import Path
from tempfile import TemporaryDirectory


def run_producer_transcribe_job(conn, job: dict) -> None:
    from clips_worker.deepgram_transcribe import _http_listen, map_deepgram_words
    from clips_worker.media_transcribe_job import transcribe_cost_usd
    from clips_worker.storage import put_json, sign_url, upload_file

    project_id = str(job["projectId"])
    with conn.cursor() as cur:
        cur.execute(
            'SELECT p."workspaceId", p."uploadId", u.key, u."durationMs" '
            'FROM clip_projects p JOIN clip_uploads u ON u.id=p."uploadId" '
            'WHERE p.id=%s AND u.status=%s',
            (project_id, "COMPLETE"),
        )
        row = cur.fetchone()
    if not row or not row[2]:
        raise RuntimeError("producer_source_missing")
    workspace_id, upload_id, source_key, duration_ms = row
    root = f"ws/{workspace_id}/projects/{project_id}/"
    try:
        raw = _http_listen(audio_url=sign_url(str(source_key), 3600), model="nova-3", paragraphs=True)
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
                "".join(json.dumps(u, ensure_ascii=False) + "\\n" for u in compact),
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
        conn.commit()
    except Exception as exc:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE clip_projects SET status=%s,stage=%s,error=%s,'
                '"updatedAt"=now() WHERE id=%s',
                ("FAILED", "transcription_failed", "We could not transcribe this video.", project_id),
            )
        conn.commit()
        print(f"[clipper:producer_transcribe] failed project={project_id} kind={type(exc).__name__}", flush=True)
        raise
