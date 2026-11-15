"""#1217 BE-8 narration — ElevenLabs ONLY (no other TTS path exists in Motion Studio).

Preset: voice resolved by NAME (default "Brian"; no hard-coded voice id), eleven_multilingual_v2,
speed 0.85, mp3_44100_128, the /with-timestamps endpoint (reused worker client). One call per chapter;
no automatic re-request. "Upload own" narration is transcribed with the clipper's transcription
(transcribe_audio_request) and aligned to the script. Mock mode estimates timings + silent audio.
"""
from __future__ import annotations

import json
import os
import subprocess
import urllib.request
from pathlib import Path

from clips_worker.motion_studio.core.wordclock import Script, align_words_to_lines, estimate_words
from clips_worker.motion_studio.pipeline import config


def resolve_voice_id(api_key: str, name: str) -> str:
    req = urllib.request.Request("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": api_key})
    with urllib.request.urlopen(req, timeout=30) as r:
        voices = json.loads(r.read()).get("voices") or []
    low = name.strip().lower()
    for v in voices:
        if str(v.get("name") or "").strip().lower() == low:
            return v["voice_id"]
    for v in voices:
        if str(v.get("name") or "").lower().startswith(low):
            return v["voice_id"]
    raise RuntimeError(f"ElevenLabs voice named {name!r} not found in this account")


def _probe_dur(path: str) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def chapters_of(story: dict) -> list[list[dict]]:
    out, cur, last = [], [], None
    for l in story["lines"]:
        if last is not None and l["chapter"] != last and cur:
            out.append(cur)
            cur = []
        cur.append(l)
        last = l["chapter"]
    if cur:
        out.append(cur)
    return out


def narrate(project: dict, story: dict, work: str, upload_key: str, log) -> dict:
    """Returns {voice, mock, chapters:[{index, lineIds, key, durationS, words:[{w,s,e,line}]}]} (chapter-local times)."""
    from clips_worker.storage import upload_file
    chs = chapters_of(story)
    preset = dict(config.NARRATION)
    out = {"voice": {"name": preset["voiceName"], "modelId": preset["modelId"], "speed": preset["speed"],
                     "format": preset["outputFormat"]}, "mock": config.mock(), "chapters": []}
    api_key = None
    voice = None
    if not config.mock():
        from clips_worker.t2v.elevenlabs_tts import get_elevenlabs_api_key
        api_key = get_elevenlabs_api_key()
        voice = {"voiceId": resolve_voice_id(api_key, preset["voiceName"]), "modelId": preset["modelId"],
                 "speed": preset["speed"], "stability": preset["stability"], "similarityBoost": preset["similarityBoost"],
                 "style": preset["style"]}
        log("narration_voice", f"voice resolved by name: {preset['voiceName']}", {"model": preset["modelId"], "speed": preset["speed"]})
    for ci, lines in enumerate(chs):
        sc = Script.from_json([{**l, "chapterId": str(l["chapter"])} for l in lines])
        text = " ".join(l.spoken for l in sc.lines)
        path = os.path.join(work, f"vo_ch{ci:02d}.mp3")
        if config.mock():
            words = estimate_words(sc, wps=2.05)
            dur = (words[-1]["e"] + 0.35) if words else 1.0
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", f"{dur:.3f}",
                            "-c:a", "libmp3lame", "-b:a", "128k", path], check=True)
        else:
            from clips_worker.motion_studio.pipeline.tts import tts_with_format_fallback
            from clips_worker.t2v.tts_alignment import words_from_alignment
            prev = " ".join(l["spoken"] for l in chs[ci - 1])[-400:] if ci > 0 else None
            nxt = " ".join(l["spoken"] for l in chs[ci + 1])[:400] if ci + 1 < len(chs) else None
            audio, alignment, fmt_used = tts_with_format_fallback(api_key, text, voice, model_id=preset["modelId"],
                                                                  preferred=preset["outputFormat"], previous_text=prev,
                                                                  next_text=nxt, log=log)
            used_model = preset["modelId"]
            out["voice"]["format"] = fmt_used
            Path(path).write_bytes(audio)
            raw = words_from_alignment(alignment, offset_s=0.0, scene_slot=ci)
            words = align_words_to_lines(raw, sc)
            dur = _probe_dur(path)
            log("tts_call", f"ElevenLabs chapter {ci + 1}: {len(text)} chars", {"chapter": ci + 1, "chars": len(text), "model": used_model})
        key = f"{upload_key}/vo_ch{ci:02d}.mp3"
        upload_file(key, Path(path), "audio/mpeg")
        out["chapters"].append({"index": ci, "lineIds": [l["id"] for l in lines], "key": key, "localPath": path,
                                "durationS": round(dur, 3), "words": words})
    return out


def narrate_upload(conn, project: dict, story: dict, audio_key: str, work: str, upload_key: str, log) -> dict:
    """Upload-own narration: reuse the clipper transcription, align to the script, one 'chapter'."""
    from clips_worker.gpu.base import TranscribeReq
    from clips_worker.storage import download_object
    from clips_worker.transcribe_provider import transcribe_audio_request
    src = os.path.join(work, "vo_upload")
    download_object(audio_key, Path(src))
    wav = os.path.join(work, "vo_upload.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "1", "-ar", "16000", wav], check=True)
    res, _meta = transcribe_audio_request(conn, TranscribeReq(audio_path=wav), project["workspaceId"], project.get("clipProjectId") or "")
    sc = Script.from_json([{**l, "chapterId": str(l["chapter"])} for l in story["lines"]])
    words = align_words_to_lines([{"w": w.get("w") or w.get("word"), "s": float(w["s"] if "s" in w else w["start"]),
                                   "e": float(w["e"] if "e" in w else w["end"])} for w in res.words], sc)
    mp3 = os.path.join(work, "vo_ch00.mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", mp3], check=True)
    from clips_worker.storage import upload_file
    key = f"{upload_key}/vo_ch00.mp3"
    upload_file(key, Path(mp3), "audio/mpeg")
    log("narration_upload", f"uploaded narration transcribed: {len(words)} words", {"words": len(words)})
    return {"voice": {"name": "uploaded"}, "mock": False, "uploaded": True,
            "chapters": [{"index": 0, "lineIds": [l["id"] for l in story["lines"]], "key": key, "localPath": mp3,
                          "durationS": round(_probe_dur(mp3), 3), "words": words}]}
