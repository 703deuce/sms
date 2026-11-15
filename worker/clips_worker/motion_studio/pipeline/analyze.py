"""#1216 BE-7 upload understanding — REUSES the clipper analysis; new code is only the named gaps.

Reused: transcription (transcribe_provider.transcribe_audio_request -> Deepgram w/ speakers, Whisper fallback),
Gemini video watch (ai_producer_agent/finder/watch.watch_video_file), shot detection (reframe_core.detect_shots),
storage (clips_worker.storage). Gaps: G1 still-image analysis + G3 on-screen text (Gemini inline image, below),
G4 persisted to the Motion Studio catalog (StudioAsset.analysis), G5 own flag (MOTION_STUDIO_ANALYSIS, never flips
AI_PRODUCER_AGENT_ENABLED). G2 faces: YuNet + SFace (pipeline/faces.py, the clipper's local vision models); grouped into P1..Pn in run_plan.
"""
from __future__ import annotations

import base64
import json
import os
import subprocess
from pathlib import Path

from clips_worker.motion_studio.pipeline import config


def _flag() -> bool:
    return (os.environ.get("MOTION_STUDIO_ANALYSIS") or "1").strip().lower() not in ("0", "false", "off")


def describe_image(path: str) -> dict:
    """G1 + G3: description, people, on-screen text for a still (one Gemini call, no retry)."""
    import requests
    from clips_worker.gemini_vision import _key, discover_model
    from PIL import Image
    im = Image.open(path).convert("RGB")
    im.thumbnail((1280, 1280))
    tmp = path + ".q.jpg"
    im.save(tmp, quality=85)
    data = base64.b64encode(Path(tmp).read_bytes()).decode()
    schema = {"type": "OBJECT", "properties": {
        "description": {"type": "STRING"}, "people": {"type": "ARRAY", "items": {"type": "STRING"}},
        "onScreenText": {"type": "ARRAY", "items": {"type": "STRING"}}, "tags": {"type": "ARRAY", "items": {"type": "STRING"}},
        "era": {"type": "STRING"}}, "required": ["description", "people", "onScreenText", "tags"]}
    model = discover_model()
    r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                      headers={"x-goog-api-key": _key()},
                      json={"contents": [{"role": "user", "parts": [
                          {"text": "Describe this image for a documentary editor. People: describe visually (do not guess names). "
                                   "List any legible on-screen text verbatim."},
                          {"inline_data": {"mime_type": "image/jpeg", "data": data}}]}],
                            "generationConfig": {"responseMimeType": "application/json", "responseSchema": schema}}, timeout=90)
    if not r.ok:
        raise RuntimeError(f"gemini image describe HTTP {r.status_code}")
    out = json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])
    out["model"] = model
    return out


def _probe(path: str) -> dict:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", path],
                       capture_output=True, text=True)
    d = json.loads(r.stdout or "{}")
    v = next((s for s in d.get("streams", []) if s.get("codec_type") == "video"), {})
    return {"durationS": float((d.get("format") or {}).get("duration") or 0), "width": v.get("width"), "height": v.get("height"),
            "hasAudio": any(s.get("codec_type") == "audio" for s in d.get("streams", []))}


def analyze_asset(conn, project: dict, asset: dict, work: str, log) -> dict:
    from clips_worker.storage import download_object
    kind = asset["kind"]
    local = os.path.join(work, f"asset_{asset['id']}{Path(asset.get('filename') or '').suffix or ''}")
    if not os.path.exists(local):
        download_object(asset["storageKey"], Path(local))
    info = _probe(local) if kind in ("video", "audio") else {}
    from clips_worker.motion_studio.pipeline import faces as face_g2
    fd = face_g2.detect(local, kind)
    an: dict = {"faces": fd["items"], "faceStatus": fd["status"]}
    if kind == "image":
        from PIL import Image
        with Image.open(local) as im:
            info = {"width": im.width, "height": im.height}
        if _flag() and not config.mock():
            try:
                an.update(describe_image(local))
            except Exception as exc:  # noqa: BLE001 (no retry; recorded)
                raise RuntimeError(f"image description failed for asset {asset['id']}: {type(exc).__name__}: {exc}") from exc
        an["summary"] = an.get("description") or asset.get("filename")
    elif kind == "video":
        wav = os.path.join(work, f"asset_{asset['id']}.wav")
        words = []
        if info.get("hasAudio"):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", local, "-vn", "-ac", "1", "-ar", "16000", wav], check=True)
            if not config.mock():
                from clips_worker.gpu.base import TranscribeReq
                from clips_worker.transcribe_provider import transcribe_audio_request
                res, _m = transcribe_audio_request(conn, TranscribeReq(audio_path=wav), project["workspaceId"], project.get("clipProjectId") or "")
                words = res.words
        an["words"] = words
        an["speakers"] = sorted({int(w.get("spk", 0)) for w in words})
        an["transcriptText"] = " ".join(w["w"] for w in words)
        try:
            from clips_worker.reframe_core import detect_shots
            an["shots"] = [[round(a, 3), round(b, 3)] for a, b in detect_shots(local)]
        except Exception as exc:  # noqa: BLE001
            an["shots"] = []
            an["shotsError"] = type(exc).__name__
        if _flag() and not config.mock() and info.get("durationS", 0) > 1:
            try:
                from clips_worker.ai_producer_agent.finder.watch import watch_video_file
                moments, meta = watch_video_file(Path(local), duration_s=int(info["durationS"]), chunk_label="motion_studio",
                                                 transcript_text=an["transcriptText"], scratch=Path(work), fail_open=False)
                an["moments"] = [{k: m.get(k) for k in ("start_s", "end_s", "what_happened", "score", "activity", "title") if k in m}
                                 for m in moments]
                an["watchModel"] = meta.get("model")
            except Exception as exc:  # noqa: BLE001
                raise RuntimeError(f"footage watch failed for asset {asset['id']}: {type(exc).__name__}: {exc}") from exc
        an["summary"] = "; ".join(str(m.get("what_happened") or "") for m in an.get("moments", [])) or an["transcriptText"]
    elif kind == "audio":
        an["summary"] = asset.get("filename")
    an.update({k: v for k, v in info.items() if k in ("durationS", "hasAudio")})
    an["localPath"] = local
    log("asset_analyzed", f"analyzed {kind}: {asset.get('filename')}", {"assetId": asset["id"], "kind": kind,
                                                                         "words": len(an.get("words") or []), "moments": len(an.get("moments") or [])})
    return {"analysis": an, "width": info.get("width"), "height": info.get("height"),
            "durationMs": int(info["durationS"] * 1000) if info.get("durationS") else None}
