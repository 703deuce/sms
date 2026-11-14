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

ALLOWED_HOST_SUFFIXES = ("cdn.pixabay.com", "pixabay.com", "videos.pexels.com", "pexels.com", "player.vimeo.com", "replicate.delivery")
ACCEPT_SCORE = 7
MAX_CANDIDATES_PER_SHOT = 8
# When nothing passes, use the best-scoring clip that is at least loosely on-topic rather than a text card.
FALLBACK_MIN_SCORE = 3
MAX_PREVIEW_BYTES = 40 * 1024 * 1024
# Realistic styles (documentary etc.) accept live-action footage only.
LIVE_ACTION = "live_action"
# Just under the relevance bar but still works for the line: used before holding the previous shot.
USABLE_SCORE = 5
# dHash Hamming distance (64-bit) at or below which two frames count as the same shot.
NEAR_DUP_BITS = 10
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
        "style": {
            "type": "STRING",
            "enum": ["live_action", "animation", "3d_render", "motion_graphics", "clip_art", "screen_recording"],
        },
        "lighting": {"type": "INTEGER"},
        "framing": {"type": "STRING"},
        "time_of_day": {"type": "STRING", "enum": ["day", "night", "dusk_dawn", "indoor"]},
        "subject_visible": {"type": "BOOLEAN"},
        "fit_reason": {"type": "STRING"},
    },
    "required": ["visible", "main_subject", "action", "matches", "score", "fit_reason", "in_s", "out_s", "style", "lighting", "framing", "time_of_day", "subject_visible"],
}

PROMPT = """You are the footage checker for an automatic stock-footage video editor.
You watch ONE short stock clip (video frames only; no audio) and decide whether an experienced editor would
put it under ONE line of THIS video. Judge only what is visible on screen, never titles or tags.

{script_block}Clip length: {clip_s:.1f} s. The shot needs about {need_s:.1f} s.

Read the script first so you understand the video and this moment in it. Then judge the clip as the editor
would: does it make sense HERE, in THIS video, at this point? A clip whose subject matches the words but would
look out of place at this moment scores low; a clip that shows the moment in a different but natural way
scores well. Decide yourself what matters for this line - the script, not a rule, tells you whether the place,
light, season or people matter here. If the line warns against doing something, a clip that shows that act
being done does not work.

Return JSON:
- visible: one sentence describing what is actually shown.
- main_subject, action: the main subject and what it is doing.
- score: 0-10 for THIS spot in THIS video. 9-10 = exactly right here; 7-8 = clearly works, usable as-is
  (literal or a natural alternative depiction); 5-6 = works but not ideal; 3-4 = loosely on topic but wrong for
  this moment; 0-2 = wrong, unusable, or contradicts the video.
- matches: true when score >= 7 and the clip is readable (not too dark or blurry to see what it shows, no
  dominating text, logos or watermarks).
- fit_reason: one short sentence in your own words on why it does or does not fit here.
- subject_visible: true if what the viewer must recognise is clearly visible (information only).
- in_s, out_s: best continuous usable window, preferably >= {need_s:.1f} s; 0 <= in_s < out_s <= {clip_s:.1f}.
- issues: shaky, blurry, text overlay, cut inside clip, or "".
- style: live_action, animation, 3d_render, motion_graphics, clip_art, or screen_recording.
- lighting: 0-10 how readable the subject is (information only).
- framing: 2-5 words, shot size + subject.
- time_of_day: day, night, dusk_dawn, or indoor (information only).
{style_rule}"""

# The video context the checker reads before judging: its own-words understanding of the video (script-context
# pass), the whole script, the neighbouring lines, this line's moment and what the viewer must recognise.
SCRIPT_BLOCK = """What this video is about: {video_understanding}
Whole script (this shot is line {line_no}):
{script}
Previous line: "{prev}"
This line (spoken over this shot): "{narration}"
Next line: "{next}"
What this moment means in the video: "{moment}"
What the viewer must recognise: "{must_recognise}"
"""


def script_block(script: str, shot: dict, video_understanding: str = "", topic: str = "") -> str:
    """The context block of the prompt. Older payloads without a script still get the line, intent and subject."""
    q = lambda v, n=300: str(v or "").replace('"', "'").replace("\n", " ")[:n]  # noqa: E731
    text = str(script or "").strip()
    return SCRIPT_BLOCK.format(
        video_understanding=q(video_understanding, 1200) or q(topic, 200) or "(not given)",
        line_no=shot.get("lineNo") or "?",
        script=text[:8000] if text else "(not given)",
        prev=q(shot.get("prevNarration")) or "(start of video)",
        narration=q(shot.get("narration"), 600),
        next=q(shot.get("nextNarration")) or "(end of video)",
        moment=q(shot.get("moment") or shot.get("intent")),
        must_recognise=q(shot.get("subject") or shot.get("intent"), 120),
    )


def _log_scene(job_id: Any, draft_id: Any, idx: int, shot: dict, chosen: dict | None, ev: list[dict]) -> None:
    """Per-scene log (no URLs): every candidate with score, verdict and reason, plus the top-K."""
    for e in ev:
        picked = bool(chosen and e.get("providerId") == chosen.get("providerId"))
        log.info("[t2v:verify:candidate] %s", json.dumps({
            "jobId": job_id, "draftId": draft_id, "sceneIndex": shot.get("lineNo", idx), "sceneId": shot.get("sceneId"),
            "candidateId": e.get("providerId"), "kind": e.get("kind") or "video", "score": e.get("score"),
            "lighting": e.get("lighting"), "matches": e.get("matches"), "verdict": "chosen" if picked else "not_chosen",
            "reason": e.get("error") or e.get("fitReason") or "",
        }))
    log.info("[t2v:verify:scene] %s", json.dumps({
        "jobId": job_id, "draftId": draft_id, "sceneIndex": shot.get("lineNo", idx), "sceneId": shot.get("sceneId"),
        "candidates": len(ev), "candidateId": chosen.get("providerId") if chosen else None,
        "score": chosen.get("score") if chosen else None, "verdict": chosen.get("verdict") if chosen else "none",
        "topK": [
            {"candidateId": e.get("providerId"), "score": e.get("score"), "lighting": e.get("lighting")}
            for e in sorted((e for e in ev if not e.get("error")), key=lambda e: (-int(e.get("score", 0)), -int(e.get("lighting", 5))))[:5]
        ],
    }))


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


def _dhash_frames(video: Path, in_s: float, out_s: float) -> list[str]:
    """64-bit dHash of 3 frames inside the chosen window (25/50/75%). Cheap near-duplicate signal."""
    hashes: list[str] = []
    span = max(0.1, out_s - in_s)
    for frac in (0.25, 0.5, 0.75):
        t = in_s + span * frac
        seek = [] if video.suffix.lower() in (".jpg", ".jpeg", ".png") else ["-ss", f"{t:.2f}"]
        proc = subprocess.run(
            ["ffmpeg", "-v", "error", *seek, "-i", str(video), "-frames:v", "1",
             "-vf", "scale=9:8:flags=area,format=gray", "-f", "rawvideo", "-"],
            capture_output=True,
        )
        px = proc.stdout
        if proc.returncode != 0 or len(px) < 72:
            continue
        bits = 0
        for row in range(8):
            for col in range(8):
                bits = (bits << 1) | (1 if px[row * 9 + col] > px[row * 9 + col + 1] else 0)
        hashes.append(f"{bits:016x}")
    return hashes


def near_duplicate(a: list[str], b: list[str]) -> bool:
    for x in a or []:
        for y in b or []:
            if bin(int(x, 16) ^ int(y, 16)).count("1") <= NEAR_DUP_BITS:
                return True
    return False


def _color_stats(video: Path, in_s: float, out_s: float) -> tuple[float, float] | None:
    """Mean HSV saturation and luma (0-1) of 3 tiny frames in the window: cheap B&W / darkness test."""
    sats: list[float] = []
    lums: list[float] = []
    span = max(0.1, out_s - in_s)
    for frac in (0.25, 0.5, 0.75):
        seek = [] if video.suffix.lower() in (".jpg", ".jpeg", ".png") else ["-ss", f"{in_s + span * frac:.2f}"]
        proc = subprocess.run(
            ["ffmpeg", "-v", "error", *seek, "-i", str(video), "-frames:v", "1",
             "-vf", "scale=32:18,format=rgb24", "-f", "rawvideo", "-"],
            capture_output=True,
        )
        px = proc.stdout
        if proc.returncode != 0 or len(px) < 32 * 18 * 3:
            continue
        for k in range(0, len(px) - 2, 3):
            r, g, b = px[k], px[k + 1], px[k + 2]
            mx, mn = max(r, g, b), min(r, g, b)
            sats.append((mx - mn) / mx if mx else 0.0)
            lums.append((0.299 * r + 0.587 * g + 0.114 * b) / 255)
    if not sats:
        return None
    return round(sum(sats) / len(sats), 3), round(sum(lums) / len(lums), 3)


class Ctx:
    """Per-shot edit-quality rule: live action only for realistic styles. Everything about whether a clip fits
    the line and the video is the model's in-context score."""

    def __init__(self, realistic: bool = True):
        self.realistic = realistic


def quality_ok(entry: dict, ctx: Ctx) -> bool:
    return not (ctx.realistic and entry.get("style", LIVE_ACTION) != LIVE_ACTION)


def _window_ok(entry: dict, need_s: float) -> bool:
    return (entry["outS"] - entry["inS"]) >= min(need_s, entry["clipS"]) - 0.05


def scarcity_order(shots: list[dict], evaluated_by_shot: list[list[dict]], realistic: bool = True) -> list[int]:
    """Shot indexes ordered by number of passing candidates, ascending; ties keep story order."""
    ctx = Ctx(realistic=realistic)

    def n_pass(i: int) -> int:
        need_s = float(shots[i].get("needS") or 4.0)
        return sum(1 for e in evaluated_by_shot[i] if passes(e, need_s, ctx))

    return sorted(range(len(shots)), key=lambda i: (n_pass(i), i))


def passes(entry: dict, need_s: float, ctx: Ctx) -> bool:
    if entry.get("error") or "score" not in entry:
        return False
    return bool(entry.get("matches")) and entry["score"] >= ACCEPT_SCORE and quality_ok(entry, ctx) and _window_ok(entry, need_s)


def usable(entry: dict, need_s: float, ctx: Ctx) -> bool:
    """Second tier: score 5-6 (works for the line, not perfect) with the same quality rules."""
    if entry.get("error") or "score" not in entry:
        return False
    return entry["score"] >= USABLE_SCORE and quality_ok(entry, ctx) and _window_ok(entry, need_s)


def fallback_rank(entry: dict, ctx: Ctx) -> float:
    """Best-available ordering: relevance first, then readability (tie-break); non-live clips for a realistic
    style come last."""
    s = float(entry.get("score", 0)) + 0.3 * float(entry.get("lighting", 5))
    if not quality_ok(entry, ctx):
        s -= 20
    return s


PHOTO_NOTE = """
THIS IS A STILL PHOTO, not a video clip. It will be shown with a slow zoom/pan under the line.
Judge it exactly like a clip. style: live_action means a real camera photograph;
illustration, vector art, 3D render, AI-generated imagery or clip art are NOT live_action.
For in_s/out_s return 0 and {need_s:.1f}."""


AI_NOTE = """
THIS CLIP IS AI-GENERATED (a test B-roll option). Judge it exactly like stock.
style: live_action only if it would pass as real camera footage next to stock clips; visible AI artefacts
(melting shapes, warped hands or objects, morphing, impossible physics, garbled text) mean style "3d_render" and score <= 4."""


def _shrink_photo(src: Path, dest: Path) -> None:
    """Re-encode the photo to a small JPEG (cheap Gemini input, strips metadata)."""
    proc = subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vf", "scale='min(640,iw)':-2", "-q:v", "4", str(dest)],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg_photo_failed: {proc.stderr[-300:]}")


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


def _gemini_watch(model: str, video: Path, prompt: str, mime: str = "video/mp4") -> tuple[dict, int, int]:
    from clips_worker.gemini_vision import GEMINI_BASE, _key

    gen: dict[str, Any] = {
        "responseMimeType": "application/json",
        "responseSchema": VERIFY_SCHEMA,
        "maxOutputTokens": 700,
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
                            "mimeType": mime,
                            "data": base64.b64encode(video.read_bytes()).decode("ascii"),
                        },
                        **({"videoMetadata": {"fps": 1}} if mime.startswith("video/") else {}),
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
    script = str(p.get("script") or "")
    if not draft_id or not workspace_id:
        raise ValueError("T2V_VERIFY_STOCK payload requires draftId and workspaceId")
    model = _model()
    realistic = bool(p.get("realistic", True))
    video_understanding = str(p.get("videoUnderstanding") or "")
    style_rule = (
        "This video uses a realistic (documentary) style: only live_action footage can match; animation, "
        "3d_render, motion_graphics, clip_art and screen_recording must have matches=false."
        if realistic
        else ""
    )
    # Clips/visuals already used by earlier rounds of this run: never pick them (or look-alikes) again.
    used_ids: set[str] = {str(u.get("providerId")) for u in (p.get("used") or []) if u.get("providerId")}
    used_hashes: list[list[str]] = [list(u.get("phash") or []) for u in (p.get("used") or []) if u.get("phash")]
    lock = threading.Lock()
    usage = {"in": 0, "out": 0, "calls": 0}
    evaluated_by_shot: list[list[dict]] = [[] for _ in shots]

    def shot_ctx(shot: dict) -> Ctx:
        return Ctx(realistic=realistic)

    def verify_shot(idx: int, shot: dict, work: Path) -> None:
        need_s = float(shot.get("needS") or 4.0)
        ctx = shot_ctx(shot)
        evaluated = evaluated_by_shot[idx]
        passing = 0
        for c in (shot.get("candidates") or [])[:MAX_CANDIDATES_PER_SHOT]:
            if str(c.get("providerId")) in used_ids:
                continue
            entry: dict[str, Any] = {
                "providerId": str(c.get("providerId")),
                "provider": c.get("provider", "pixabay"),
                "query": c.get("query"),
                "author": str(c.get("author") or "")[:80],
            }
            try:
                is_photo = c.get("kind") == "photo"
                if is_photo:
                    # Photo fallback: a still shown with a slow Ken Burns move; any window length works.
                    raw = work / f"s{idx}_{c.get('providerId')}.jpg"
                    muted = work / f"s{idx}_{c.get('providerId')}_m.jpg"
                    _download(str(c.get("previewUrl") or ""), raw)
                    _shrink_photo(raw, muted)
                    clip_s = max(need_s, 12.0)
                    entry["kind"] = "photo"
                else:
                    raw = work / f"s{idx}_{c.get('providerId')}.mp4"
                    muted = work / f"s{idx}_{c.get('providerId')}_m.mp4"
                    _download(str(c.get("previewUrl") or ""), raw)
                    _mute_and_shrink(raw, muted)
                    clip_s = float(c.get("durationS") or 0) or _probe_s(muted)
                    if c.get("kind") == "ai":
                        entry["kind"] = "ai"
                prompt = (PROMPT + (PHOTO_NOTE if is_photo else AI_NOTE if c.get("kind") == "ai" else "")).format(
                    clip_s=clip_s,
                    need_s=need_s,
                    script_block=script_block(script, shot, video_understanding, topic),
                    style_rule=style_rule,
                )
                v, tin, tout = _gemini_watch(model, muted, prompt, "image/jpeg" if is_photo else "video/mp4")
                with lock:
                    usage["in"] += tin
                    usage["out"] += tout
                    usage["calls"] += 1
                a, b = (0.0, clip_s) if is_photo else _clamp_window(v, clip_s, need_s)
                entry.update(
                    {
                        "visible": str(v.get("visible") or "")[:300],
                        "subject": str(v.get("main_subject") or "")[:120],
                        "action": str(v.get("action") or "")[:120],
                        # The model's in-context judgement decides; subject_visible is information only.
                        "matches": bool(v.get("matches")),
                        "score": int(v.get("score") or 0),
                        "subjectVisible": bool(v.get("subject_visible", True)),
                        "inS": a,
                        "outS": b,
                        "clipS": round(clip_s, 2),
                        "issues": str(v.get("issues") or "")[:200],
                        "style": str(v.get("style") or LIVE_ACTION),
                        "lighting": int(v.get("lighting") if v.get("lighting") is not None else 5),
                        "framing": str(v.get("framing") or "")[:60],
                        "timeOfDay": str(v.get("time_of_day") or "day"),
                        "fitReason": str(v.get("fit_reason") or "")[:200],
                    }
                )
                try:
                    cs = _color_stats(muted, a, b)
                    if cs:
                        entry["saturation"], entry["luma"] = cs
                except Exception:  # noqa: BLE001 — colour stats are information only
                    pass
                try:
                    entry["phash"] = _dhash_frames(muted, a, b)
                except Exception:  # noqa: BLE001 — hash is a bonus signal
                    entry["phash"] = []
            except Exception as exc:  # noqa: BLE001 — candidate-level failure, try next
                entry.update({"error": str(exc)[:200]})
                evaluated.append(entry)
                continue
            evaluated.append(entry)
            if passes(entry, need_s, ctx):
                passing += 1
                # Two passing options give the no-repeat pass a backup without reviewing everything.
                if passing >= 2:
                    break

    t0 = time.time()
    with tempfile.TemporaryDirectory(prefix="t2v-verify-") as td:
        work = Path(td)
        with ThreadPoolExecutor(max_workers=PARALLEL_SHOTS) as pool:
            futs = [pool.submit(verify_shot, i, s, work) for i, s in enumerate(shots)]
            for i, f in enumerate(futs):
                try:
                    f.result()
                except Exception as exc:  # noqa: BLE001 — a shot-level crash never fails the job
                    evaluated_by_shot[i].append({"providerId": "-", "error": f"shot_failed:{str(exc)[:160]}"})

    # No-repeat selection, scarcest shots first (fewest passing clips; ties in story order), so a line with
    # plenty of options never takes another line's only good clip. Never the same clip ID twice, never a
    # near-identical frame (dHash) of an already-picked shot, including picks from earlier rounds.
    results: list[dict | None] = [None] * len(shots)
    for i in scarcity_order(shots, evaluated_by_shot, realistic):
        shot = shots[i]
        need_s = float(shot.get("needS") or 4.0)
        ctx = shot_ctx(shot)
        ev = evaluated_by_shot[i]

        def free(e: dict) -> bool:
            return e["providerId"] not in used_ids and not any(near_duplicate(e.get("phash") or [], h) for h in used_hashes)

        chosen = None
        for e in sorted((e for e in ev if passes(e, need_s, ctx)), key=lambda e: (-e["score"], -e.get("lighting", 5))):
            if free(e):
                chosen = {**e, "verdict": "accepted"}
                break
        if chosen is None:
            for e in sorted((e for e in ev if usable(e, need_s, ctx)), key=lambda e: -fallback_rank(e, ctx)):
                if free(e):
                    chosen = {**e, "verdict": "weak_match"}
                    break
        if chosen is None:
            for e in sorted((e for e in ev if not e.get("error") and e.get("score", 0) >= FALLBACK_MIN_SCORE), key=lambda e: -fallback_rank(e, ctx)):
                if free(e):
                    chosen = {**e, "verdict": "best_available"}
                    break
        if chosen:
            used_ids.add(chosen["providerId"])
            if chosen.get("phash"):
                used_hashes.append(chosen["phash"])
        _log_scene(job.get("id"), draft_id, i, shot, chosen, ev)
        results[i] = {"sceneId": shot.get("sceneId"), "chosen": chosen, "evaluated": ev}

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
        "bestAvailable": sum(1 for r in results if r and r.get("chosen") and r["chosen"].get("verdict") == "best_available"),
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
