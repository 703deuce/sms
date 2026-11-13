"""T2V_VERIFY_STOCK — single-pass, visual-only Gemini check of stock candidates per shot.

Prompt-to-Video (stock MVP). For each planned shot the web app sends a short, ordered list of
stock candidates (Pixabay previews). For each candidate, in order, until one is accepted:

1. Download the provider preview rendition (allow-listed CDN hosts only).
2. Strip audio and downscale with ffmpeg (stock audio is never used; voiceover replaces it).
3. Gemini watches the muted clip ONCE (video frames only, low media resolution) and returns
   what is actually visible, whether it illustrates the narration line, and the in/out points
   of the usable window.

No transcription, no audio analysis, no multi-pass review. Results are written into the job
payload (``results``) and posted to ``/api/t2v/internal/pipeline-verified``.
"""
from __future__ import annotations

import base64
import json
import logging
import subprocess
import tempfile
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import requests

log = logging.getLogger(__name__)

ALLOWED_HOST_SUFFIXES = ("cdn.pixabay.com", "pixabay.com", "videos.pexels.com", "pexels.com", "player.vimeo.com")
ACCEPT_SCORE = 7
MAX_CANDIDATES_PER_SHOT = 5
MAX_PREVIEW_BYTES = 40 * 1024 * 1024
PARALLEL_SHOTS = 4

VERIFY_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "visible": {"type": "STRING"},
        "main_subject": {"type": "STRING"},
        "action": {"type": "STRING"},
        "matches": {"type": "BOOLEAN"},
        "score": {"type": "INTEGER"},
        "in_s": {"type": "NUMBER"},
        "out_s": {"type": "NUMBER"},
        "issues": {"type": "STRING"},
    },
    "required": ["visible", "main_subject", "action", "matches", "score", "in_s", "out_s"],
}

PROMPT = """You are the footage checker for an automatic stock-footage video editor.
You watch ONE short stock clip (video frames only; there is no audio) and decide if it
honestly illustrates ONE narration line. Judge only what is actually visible on screen,
never the clip's title or tags.

Narration line (spoken over this shot): "{narration}"
Intended shot: "{intent}"
Video topic: "{topic}"
Clip length: {clip_s:.1f} s. The shot on screen needs about {need_s:.1f} s.

Return JSON:
- visible: one sentence describing what is actually shown.
- main_subject, action: the main subject and what it is doing.
- matches: true if a professional editor would honestly put this clip under that line as B-roll:
  the clip clearly shows the narration's subject (or a directly relevant, visually honest depiction
  of it). It does NOT need every detail of the intended shot: time of day, weather, exact camera
  move, setting or extra people are nice-to-have, not requirements. When the subject looks like an
  ordinary thing (an electric car looks like any modern car), a clean, modern example counts unless
  something on screen contradicts the line. False when the main subject is wrong or unrelated, the
  footage is too dark/blurry to read, or text, logos or watermarks dominate the frame.
- score: 0-10 how well it illustrates the line. 9-10 = exactly the subject and action; 7-8 = clearly
  the right subject, usable as-is; 5-6 = related but weak; 0-4 = wrong or unusable.
- in_s, out_s: the best continuous window inside the clip to use, where the relevant subject or
  action is clearly visible and the framing is good. Prefer a window of at least {need_s:.1f} s
  when the clip allows; use the whole clip if it is all usable. 0 <= in_s < out_s <= {clip_s:.1f}.
- issues: short note on problems (shaky, blurry, text overlay, cut inside clip), or "".
"""


def _payload(job: dict) -> dict:
    p = job.get("payload") or {}
    if isinstance(p, str):
        p = json.loads(p)
    return p


def _host_allowed(url: str) -> bool:
    try:
        u = urllib.parse.urlparse(url)
    except ValueError:
        return False
    if u.scheme != "https":
        return False
    h = (u.hostname or "").lower()
    return any(h == s or h.endswith("." + s) for s in ALLOWED_HOST_SUFFIXES)


def _download(url: str, dest: Path) -> None:
    if not _host_allowed(url):
        raise RuntimeError("preview_host_not_allowed")
    req = urllib.request.Request(url, headers={"User-Agent": "transovo-t2v-verify/1"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read(MAX_PREVIEW_BYTES + 1)
    if len(data) > MAX_PREVIEW_BYTES:
        raise RuntimeError("preview_too_large")
    if len(data) < 1024:
        raise RuntimeError("preview_empty")
    dest.write_bytes(data)


def _mute_and_shrink(src: Path, dest: Path) -> None:
    """Drop audio, downscale to 360p, cap at 40 s — Gemini only sees frames."""
    proc = subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(src), "-t", "40", "-an",
            "-vf", "scale=-2:360,fps=4", "-c:v", "libx264", "-preset", "veryfast", "-crf", "32",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dest),
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg_mute_failed: {proc.stderr[-300:]}")


def _probe_s(path: Path) -> float:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
            capture_output=True, text=True, check=True,
        ).stdout
        return float(json.loads(out)["format"]["duration"])
    except Exception:
        return 0.0


def _model() -> str:
    from clips_worker.gemini_vision import discover_video_picker_model

    return discover_video_picker_model().strip()


def _gemini_watch(model: str, video: Path, prompt: str) -> tuple[dict, int, int]:
    from clips_worker.gemini_vision import GEMINI_BASE, _key

    gen: dict[str, Any] = {
        "responseMimeType": "application/json",
        "responseSchema": VERIFY_SCHEMA,
        "maxOutputTokens": 400,
        "mediaResolution": "MEDIA_RESOLUTION_LOW",
    }
    m = model.lower()
    if not (m.startswith("gemini-3.") or m.startswith("gemini-4.")):
        gen["temperature"] = 0
    body = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": "video/mp4",
                            "data": base64.b64encode(video.read_bytes()).decode("ascii"),
                        },
                        "videoMetadata": {"fps": 1},
                    },
                    {"text": prompt},
                ],
            }
        ],
        "generationConfig": gen,
    }
    url = f"{GEMINI_BASE}/models/{urllib.parse.quote(model)}:generateContent"
    last = ""
    # One transient retry (429/5xx are not billed); no paid retry loops.
    for attempt in range(2):
        res = requests.post(url, params={"key": _key()}, json=body, timeout=90)
        if res.ok:
            data = res.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            u = data.get("usageMetadata") or {}
            return json.loads(text), int(u.get("promptTokenCount") or 0), int(u.get("candidatesTokenCount") or 0)
        last = f"gemini_http_{res.status_code}"
        if res.status_code not in (429, 500, 502, 503, 504) or attempt:
            break
        time.sleep(3)
    raise RuntimeError(last)


def _clamp_window(v: dict, clip_s: float, need_s: float) -> tuple[float, float]:
    try:
        a = float(v.get("in_s") or 0)
        b = float(v.get("out_s") or clip_s)
    except (TypeError, ValueError):
        a, b = 0.0, clip_s
    a = max(0.0, min(a, clip_s))
    b = max(a, min(b, clip_s))
    if b - a < 0.5:
        a, b = 0.0, clip_s
    # Grow a too-short window around its centre (still the same verified clip) so the shot
    # covers its narration without looping.
    if b - a < need_s and clip_s >= need_s:
        mid = (a + b) / 2
        a = max(0.0, mid - need_s / 2)
        b = a + need_s
        if b > clip_s:
            b = clip_s
            a = max(0.0, b - need_s)
    return round(a, 2), round(b, 2)


def run_t2v_verify_stock_job(conn, job: dict) -> dict:
    from clips_worker.gemini import _log_usage
    from clips_worker.internal_callback import post_internal

    p = _payload(job)
    draft_id = p.get("draftId")
    workspace_id = p.get("workspaceId")
    project_id = p.get("projectId")
    topic = str(p.get("topic") or "")[:200]
    shots = p.get("shots") or []
    if not draft_id or not workspace_id:
        raise ValueError("T2V_VERIFY_STOCK payload requires draftId and workspaceId")
    model = _model()
    accepted: set[str] = set()
    lock = threading.Lock()
    usage = {"in": 0, "out": 0, "calls": 0}
    results: list[dict | None] = [None] * len(shots)

    def verify_shot(idx: int, shot: dict, work: Path) -> dict:
        need_s = float(shot.get("needS") or 4.0)
        evaluated: list[dict] = []
        chosen: dict | None = None
        best: dict | None = None
        for c in (shot.get("candidates") or [])[:MAX_CANDIDATES_PER_SHOT]:
            key = f"{c.get('provider', 'pixabay')}:{c.get('providerId')}"
            with lock:
                if key in accepted:
                    continue
            entry: dict[str, Any] = {"providerId": str(c.get("providerId")), "provider": c.get("provider", "pixabay"), "query": c.get("query")}
            try:
                raw = work / f"s{idx}_{c.get('providerId')}.mp4"
                muted = work / f"s{idx}_{c.get('providerId')}_m.mp4"
                _download(str(c.get("previewUrl") or ""), raw)
                _mute_and_shrink(raw, muted)
                clip_s = float(c.get("durationS") or 0) or _probe_s(muted)
                prompt = PROMPT.format(
                    narration=str(shot.get("narration") or "")[:600].replace('"', "'"),
                    intent=str(shot.get("intent") or "")[:300].replace('"', "'"),
                    topic=topic.replace('"', "'"),
                    clip_s=clip_s,
                    need_s=need_s,
                )
                v, tin, tout = _gemini_watch(model, muted, prompt)
                with lock:
                    usage["in"] += tin
                    usage["out"] += tout
                    usage["calls"] += 1
                a, b = _clamp_window(v, clip_s, need_s)
                entry.update(
                    {
                        "visible": str(v.get("visible") or "")[:300],
                        "subject": str(v.get("main_subject") or "")[:120],
                        "action": str(v.get("action") or "")[:120],
                        "matches": bool(v.get("matches")),
                        "score": int(v.get("score") or 0),
                        "inS": a,
                        "outS": b,
                        "clipS": round(clip_s, 2),
                        "issues": str(v.get("issues") or "")[:200],
                    }
                )
            except Exception as exc:  # noqa: BLE001 — candidate-level failure, try next
                entry.update({"error": str(exc)[:200]})
                evaluated.append(entry)
                continue
            evaluated.append(entry)
            if best is None or entry["score"] > best["score"]:
                best = entry
            if entry["matches"] and entry["score"] >= ACCEPT_SCORE and (entry["outS"] - entry["inS"]) >= min(need_s, entry["clipS"]) - 0.05:
                with lock:
                    if key in accepted:
                        continue
                    accepted.add(key)
                chosen = {**entry, "verdict": "accepted"}
                break
        if chosen is None and best is not None and best.get("matches") and best["score"] >= 5:
            key = f"{best['provider']}:{best['providerId']}"
            with lock:
                if key not in accepted:
                    accepted.add(key)
                    chosen = {**best, "verdict": "weak_match"}
        return {"sceneId": shot.get("sceneId"), "chosen": chosen, "evaluated": evaluated}

    t0 = time.time()
    with tempfile.TemporaryDirectory(prefix="t2v-verify-") as td:
        work = Path(td)
        with ThreadPoolExecutor(max_workers=PARALLEL_SHOTS) as pool:
            futs = {pool.submit(verify_shot, i, s, work): i for i, s in enumerate(shots)}
            for f, i in futs.items():
                try:
                    results[i] = f.result()
                except Exception as exc:  # noqa: BLE001
                    results[i] = {"sceneId": shots[i].get("sceneId"), "chosen": None, "evaluated": [], "error": str(exc)[:200]}

    try:
        if usage["calls"]:
            _log_usage(conn, workspace_id, project_id, model, usage["in"], usage["out"])
    except Exception as exc:  # noqa: BLE001
        log.warning("[t2v:verify] usage log failed: %s", exc)
        conn.rollback()

    summary = {
        "model": model,
        "geminiCalls": usage["calls"],
        "promptTokens": usage["in"],
        "outputTokens": usage["out"],
        "elapsedMs": int((time.time() - t0) * 1000),
        "accepted": sum(1 for r in results if r and r.get("chosen") and r["chosen"].get("verdict") == "accepted"),
        "weak": sum(1 for r in results if r and r.get("chosen") and r["chosen"].get("verdict") == "weak_match"),
        "unmatched": sum(1 for r in results if not (r and r.get("chosen"))),
    }
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE clip_jobs SET payload = payload || %s::jsonb, status='DONE', \"finishedAt\"=NOW(), error=NULL WHERE id=%s",
            (json.dumps({"results": results, "summary": summary}), job["id"]),
        )
    conn.commit()
    print(f"[t2v:verify] draft={draft_id} job={job['id']} {json.dumps(summary)}", flush=True)
    try:
        post_internal(
            "/api/t2v/internal/pipeline-verified",
            {"draftId": draft_id, "workspaceId": workspace_id, "jobId": job["id"]},
        )
    except Exception as exc:  # noqa: BLE001 — web also resumes from the job row on status poll
        log.warning("[t2v:verify] callback failed: %s", exc)
    return summary
