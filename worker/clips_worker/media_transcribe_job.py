"""E5b MEDIA_TRANSCRIBE: on-demand transcript of a project's own media (uploaded clip / Rooms take).

Queued by the web app only after the user accepted the shown cost. Reuses the clip transcription path
(transcribe_provider.transcribe_audio_request: Deepgram primary, GPU / local Whisper fallback) on a
16 kHz mono WAV of the media. Writes MEDIA-time words + the actual cost to clip_media_transcripts.
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path

DEEPGRAM_USD_PER_MIN_DEFAULT = 0.0043
L4_USD_PER_GPU_S_DEFAULT = 0.000222



def _env_float(name: str, default: float) -> float:
    try:
        v = float(os.environ.get(name, ""))
        return v if 0 < v < 1 else default
    except ValueError:
        return default


def transcribe_cost_usd(provider: str, duration_s: float, gpu_seconds: float) -> float:
    if provider == "deepgram":
        sec = max(15.0, float(int(duration_s + 0.999)))
        return sec / 60.0 * _env_float("CLIPS_TRANSCRIBE_USD_PER_MIN", DEEPGRAM_USD_PER_MIN_DEFAULT)
    if provider == "local":
        return 0.0
    return max(0.0, gpu_seconds) * _env_float("MODAL_L4_USD_PER_GPU_S", L4_USD_PER_GPU_S_DEFAULT)


def extract_wav(src: Path, out: Path) -> float:
    """16 kHz mono PCM WAV; returns its duration (s)."""
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(out)],
        stdout=subprocess.DEVNULL,
    )
    try:
        return float(
            subprocess.check_output(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)], text=True
            ).strip()
        )
    except (subprocess.CalledProcessError, ValueError):
        return 0.0


def clean_words(words: list[dict]) -> list[dict]:
    out = []
    for w in words or []:
        try:
            item = {"w": str(w.get("w") or w.get("word") or "").strip(), "s": round(float(w["s"]), 3), "e": round(float(w["e"]), 3)}
        except (KeyError, TypeError, ValueError):
            continue
        if not item["w"] or item["e"] < item["s"]:
            continue
        if w.get("p") is not None:
            item["p"] = w["p"]
        if w.get("spk") is not None:
            item["spk"] = w["spk"]
        out.append(item)
    return out


def run_media_transcribe_job(conn, job: dict) -> None:
    from clips_worker.gpu.base import TranscribeReq
    from clips_worker.media_sources import _TAKE_SQL, _UPLOAD_SQL  # E5 project-scoped media lookups
    from clips_worker.storage import download_object
    from clips_worker.transcribe_provider import transcribe_audio_request

    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload or "{}")
    tid = str(payload.get("transcriptId") or "")
    project_id = str(job.get("projectId") or "")
    with conn.cursor() as cur:
        cur.execute(
            'SELECT ref, "refId", "workspaceId" FROM clip_media_transcripts WHERE id = %s AND "projectId" = %s',
            (tid, project_id),
        )
        row = cur.fetchone()
    if not row:
        print(f"[clipper:media_transcribe] missing transcript={tid}", flush=True)
        return
    ref, ref_id, workspace_id = row
    with conn.cursor() as cur:
        cur.execute('UPDATE clip_media_transcripts SET status = %s, "updatedAt" = now() WHERE id = %s', ("running", tid))
    conn.commit()
    status, words, lang, dur_ms, cost, provider, err = "failed", None, None, None, None, None, None
    try:
        with conn.cursor() as cur:
            if ref == "upload":
                cur.execute(_UPLOAD_SQL, (ref_id, workspace_id, project_id, "COMPLETE"))
            else:
                cur.execute(_TAKE_SQL, (ref_id, project_id, workspace_id))
            key_row = cur.fetchone()
        if not key_row or not key_row[0]:
            raise RuntimeError("media_missing")
        with tempfile.TemporaryDirectory() as td:
            tdp = Path(td)
            src = tdp / "media.bin"
            download_object(str(key_row[0]), src)
            wav = tdp / "audio.wav"
            dur_s = extract_wav(src, wav)
            res, meta = transcribe_audio_request(conn, TranscribeReq(audio_path=str(wav)), workspace_id, project_id)
            words = clean_words(res.words)
            lang = res.language
            dur_ms = int(round((dur_s or res.duration_s) * 1000))
            provider = res.provider
            cost = transcribe_cost_usd(res.provider, dur_s or res.duration_s, res.gpu_seconds)
            status = "done"
            print(
                f"[clipper:media_transcribe] {json.dumps({'transcript': tid, 'words': len(words), 'provider': provider, 'engine': meta.transcription_engine, 'cost_usd': round(cost, 6)})}",
                flush=True,
            )
    except Exception as exc:  # noqa: BLE001 — recorded on the row, the job itself completes
        err = f"{type(exc).__name__}: {exc}"[:300]
        print(f"[clipper:media_transcribe] failed transcript={tid} err={err}", flush=True)
    finally:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE clip_media_transcripts SET status = %s, words = %s::jsonb, language = %s, "durationMs" = %s, '
                '"costUsdMicros" = %s, provider = %s, error = %s, "updatedAt" = now() WHERE id = %s',
                (
                    status,
                    json.dumps(words) if words is not None else None,
                    lang,
                    dur_ms,
                    int(round(cost * 1e6)) if cost is not None else None,
                    provider,
                    err,
                    tid,
                ),
            )
        conn.commit()
