"""T2V_ASSEMBLE worker job (sketch wired to existing worker helpers).

Register (additive):
  job_types.py      JOB_TYPES += ("T2V_ASSEMBLE",)
  main.py           DISPATCH["T2V_ASSEMBLE"] = handle_t2v_assemble   (same progress wrapper as
                    handle_script_composition_render, incl. post_progress_terminal)
  main.py           add "T2V_ASSEMBLE" to the retry/terminal type tuple (~line 552)

Payload: {"draftId", "projectId", "workspaceId", "revision", "sceneIds": [..] | null (null = all)}
Stages / progress (posted to /api/clips/internal/jobs/{id}/progress, rendered by the T2V
generation screen):  voice 5-45, media 45-60, assemble 60-85, upload 85-95, composition 95-100.
"""
from __future__ import annotations

import hashlib
import json
import tempfile
from pathlib import Path

import requests

from clips_worker.storage import download_object, upload_file, put_json
from clips_worker.t2v.assemble import Scene, SceneMedia, assemble
from clips_worker.t2v.tts_alignment import words_from_alignment

ASPECT_DIMS = {"16:9": (1280, 720), "9:16": (720, 1280), "1:1": (1080, 1080), "4:5": (1080, 1350)}
ELEVEN_TTS = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128"


def tts_hash(sc: dict) -> str:
    # The hash is computed ONCE in TS (lib/server/ai/elevenlabs-tts.ts ttsHash) when narration/voice
    # changes and stored in scene.voice.hash. Never recompute in Python (JSON float formatting differs).
    return sc["voice"]["hash"]


def tts_scene(api_key: str, text: str, voice: dict, prev_text: str | None, next_text: str | None) -> tuple[bytes, dict]:
    """POST /v1/text-to-speech/{voice_id}/with-timestamps (ElevenLabs API reference)."""
    body = {
        "text": text,
        "model_id": voice.get("modelId", "eleven_v4"),
        "voice_settings": {k: v for k, v in {
            "stability": voice.get("stability"), "similarity_boost": voice.get("similarityBoost"),
            "style": voice.get("style"), "speed": voice.get("speed")}.items() if v is not None},
    }
    if voice.get("languageCode"):
        body["language_code"] = voice["languageCode"]
    if prev_text:
        body["previous_text"] = prev_text  # prosody continuity across scenes
    if next_text:
        body["next_text"] = next_text
    r = requests.post(ELEVEN_TTS.format(voice_id=voice["voiceId"]), json=body,
                      headers={"xi-api-key": api_key}, timeout=120)
    r.raise_for_status()
    data = r.json()  # {"audio_base64", "alignment", "normalized_alignment"}
    import base64
    return base64.b64decode(data["audio_base64"]), data.get("alignment") or {}


def run_t2v_assemble_job(conn, job: dict, progress) -> None:
    p = job["payload"]
    with conn.cursor() as cur:
        cur.execute('SELECT document, revision FROM t2v_drafts WHERE id=%s', (p["draftId"],))
        doc, revision = cur.fetchone()
    w, h = ASPECT_DIMS[doc["settings"]["aspect"]]
    voice = doc["voice"]
    api_key = __import__("os").environ["ELEVENLABS_API_KEY"]

    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        scenes: list[Scene] = []
        all_words: list[dict] = []
        n = len(doc["scenes"])
        for idx, sc in enumerate(doc["scenes"]):
            progress(job["id"], {"jobStatus": "RUNNING", "stage": "voice", "progress": 5 + int(40 * idx / max(1, n))})
            vo_path = None
            vo_s = 0.0
            if sc["narration"].strip() and not sc.get("muted"):
                hsh = tts_hash(sc)
                cached = _voice_cache_get(conn, p["workspaceId"], hsh)
                vo_path = work / f"vo_{idx}.mp3"
                if cached:
                    download_object(cached["storageKey"], vo_path)
                    alignment = cached["alignment"]
                else:
                    prev_t = doc["scenes"][idx - 1]["narration"] if idx else None
                    next_t = doc["scenes"][idx + 1]["narration"] if idx + 1 < n else None
                    audio, alignment = tts_scene(api_key, sc["narration"], voice, prev_t, next_t)
                    vo_path.write_bytes(audio)
                    key = f"ws/{p['workspaceId']}/t2v/voice/{hsh}.mp3"
                    upload_file(key, vo_path, "audio/mpeg")
                    _voice_cache_put(conn, p["workspaceId"], hsh, voice, sc["narration"], key, vo_path, alignment)
                ends = alignment.get("character_end_times_seconds") or [0]
                vo_s = float(ends[-1])
                sc["_alignment"] = alignment
            dur_s = max((sc.get("minDurMs") or 2000) / 1000, vo_s + (sc.get("padMs") or 400) / 1000)
            media_path = _fetch_media(sc.get("media"), work, idx)
            m = sc.get("media") or {}
            scenes.append(Scene(
                id=sc["id"], dur_s=dur_s,
                media=SceneMedia(kind=m.get("kind", "color"), path=media_path, src_in_s=(m.get("srcInMs") or 0) / 1000,
                                 focal_x=m.get("focalX", 0.5), focal_y=m.get("focalY", 0.5),
                                 ken_burns=m.get("kenBurns", "zoom_in"), color=m.get("color", "0x111111")),
                transition=sc.get("transition", "fade"), transition_s=(sc.get("transitionMs") or 500) / 1000,
                vo_path=vo_path,
            ))

        progress(job["id"], {"jobStatus": "RUNNING", "stage": "assemble", "progress": 60})
        out = assemble(scenes, work / "asm", w=w, h=h, fps=30)
        t0 = 0.0
        for idx, sc in enumerate(doc["scenes"]):
            if sc.get("_alignment"):
                all_words += words_from_alignment(sc["_alignment"], t0, sc["slot"], 0)
            t0 += scenes[idx].dur_s

        progress(job["id"], {"jobStatus": "RUNNING", "stage": "upload", "progress": 85})
        src_key = f"ws/{p['workspaceId']}/projects/{p['projectId']}/t2v/source_r{revision}.mp4"
        upload_file(src_key, out["source"], "video/mp4")
        # Words go to ClipProject.transcriptKey (projectWordsKey) in the same {w,s,e,i,spk} shape Deepgram writes.
        put_json(_project_words_key(conn, p["projectId"]), {"words": all_words})
        # Then: upsert ClipUpload(kind t2v_source) -> ClipProject.uploadId, durationMs, status READY;
        # upsert ScriptMediaAsset; POST internal callback /api/t2v/internal/assembled with
        # {draftId, revision, sceneStartsMs, durationMs} -> TS draftToComposition() writes the composition.
        progress(job["id"], {"jobStatus": "DONE", "stage": "done", "progress": 100,
                             "result": {"sourceKey": src_key, "durationMs": out["durationMs"],
                                        "sceneStartsMs": out["sceneStartsMs"]}})


# --- helpers (implement against existing tables; kept thin on purpose) -----------------------

def _voice_cache_get(conn, ws: str, hsh: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute('SELECT "storageKey", alignment FROM t2v_voice_clips WHERE "workspaceId"=%s AND hash=%s', (ws, hsh))
        row = cur.fetchone()
    return {"storageKey": row[0], "alignment": row[1]} if row else None


def _voice_cache_put(conn, ws, hsh, voice, text, key, path, alignment) -> None:
    ...  # INSERT ... ON CONFLICT ("workspaceId", hash) DO NOTHING; also AiUsage row (provider elevenlabs, chars)


def _fetch_media(media: dict | None, work: Path, idx: int) -> Path | None:
    """Stock: download previewUrl/download url to disk (Pixabay forbids hotlinking -> already copied to
    our storage by ensureStockAsset at match time, so prefer storageKey). AI image/video: storageKey."""
    if not media or media.get("kind") == "color":
        return None
    dest = work / f"media_{idx}{'.jpg' if media.get('kind') == 'image' else '.mp4'}"
    if media.get("storageKey"):
        download_object(media["storageKey"], dest)
    else:
        with requests.get(media["srcUrl"], stream=True, timeout=120) as r:
            r.raise_for_status()
            dest.write_bytes(r.content)
    return dest


def _project_words_key(conn, project_id: str) -> str:
    with conn.cursor() as cur:
        cur.execute('SELECT "transcriptKey" FROM clip_projects WHERE id=%s', (project_id,))
        return cur.fetchone()[0]
