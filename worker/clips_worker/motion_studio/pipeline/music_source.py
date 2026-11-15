"""Music sources: 'generated' (DEFAULT, code-generated beat-keyed score, RE-10/RE-12), 'user' (uploaded,
beat-cut + ducked), 'elevenlabs' (#1230 BE-22, optional; reuses clips_worker.elevenlabs.generate_music_for_length,
ONE paid generation per explicit action, idempotent per project+version, never retried), 'none'."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

from clips_worker.motion_studio.core import audio as A
from clips_worker.motion_studio.pipeline import config


def anchors_in_program(plan: dict, lay: dict) -> dict:
    out = {}
    for k, v in (plan.get("musicAnchors") or {}).items():
        if not isinstance(v, dict):
            continue
        lid, word = v.get("lineId"), (v.get("word") or "")
        ws = [w for w in lay["words"] if w["line"] == str(lid)]
        if not ws:
            continue
        hit = next((w for w in ws if word and w["w"].strip(".,!?;:\"'").lower() == str(word).lower()), ws[0])
        out[k] = hit["s"]
    return out


def build_music(project: dict, plan: dict, story: dict, lay: dict, work: str, user_music_path: str | None, log) -> dict:
    src = plan.get("musicSource") or "generated"
    dur = lay["durationS"]
    out_wav = os.path.join(work, "music.wav")
    if src == "none":
        return {"source": "none", "path": None}
    if src == "user" and user_music_path:
        info = A.cut_uploaded_music(user_music_path, out_wav, dur, work)
        log("music", f"uploaded music cut on beats ({info['bpm']:.0f} bpm)", info)
        return {**info, "path": out_wav}
    if src == "elevenlabs":
        prev = (project.get("music") or {})
        if prev.get("source") == "elevenlabs" and prev.get("elevenKey") and abs(float(prev.get("lengthS", 0)) - dur) < 0.5:
            from clips_worker.storage import download_object
            raw = os.path.join(work, "eleven_music.mp3")
            download_object(prev["elevenKey"], Path(raw))
            log("music", "reused the existing ElevenLabs music (no new paid call)", {"source": "elevenlabs"})
        elif not config.elevenlabs_music_enabled() or config.mock():
            log("music", "ElevenLabs music is off/mocked; using the generated score", {})
            src = "generated"
            raw = None
        else:
            from clips_worker.elevenlabs import generate_music_for_length
            from clips_worker.storage import upload_file
            prompt = (f"Instrumental documentary score, {story.get('tone') or 'cinematic'} mood, builds to a peak then resolves; "
                      f"no vocals. Subject: {story.get('title') or ''}")[:600]
            audio_bytes, usage = generate_music_for_length(prompt, int(dur * 1000), True)
            raw = os.path.join(work, "eleven_music.mp3")
            Path(raw).write_bytes(audio_bytes)
            key = f"{work_key(project)}/eleven_music.mp3"
            upload_file(key, Path(raw), "audio/mpeg")
            prev = {"elevenKey": key, "lengthS": dur}
            log("music_call", "ElevenLabs music generated (one call)", {"lengthS": round(dur, 1)})
        if src == "elevenlabs" and raw:
            info = A.cut_uploaded_music(raw, out_wav, dur, work, start_on_beat=0.0)
            return {**info, "source": "elevenlabs", "elevenKey": prev.get("elevenKey"), "lengthS": dur, "path": out_wav}
    params = A.score_params(A.music_seed(project["id"], " ".join(l["text"] for l in story["lines"])), story.get("tone") or "")
    anchors = anchors_in_program(plan, lay)
    info = A.generate_score(out_wav, dur, anchors, params)
    log("music", f"generated score: {params['bpm']} bpm {params['key']} {params['mode']} ({', '.join(params['instruments'])})",
        {"params": params, "anchors": info["anchors"]})
    return {**info, "path": out_wav}


def work_key(project: dict) -> str:
    return f"ws/{project['workspaceId']}/motion-studio/{project['id']}"
