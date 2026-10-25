"""Talking-mode clip picks via OpenAI gpt-6-luna (JSON)."""
from __future__ import annotations

import json
import os
import re
import urllib.request
from typing import Any

PADDING_MS = 150
OVERLAP_DEDUPE = 0.5

LENGTH_MS = {
    "auto": (15_000, 90_000),
    "lt30": (10_000, 30_000),
    "30_60": (30_000, 60_000),
    "60_90": (60_000, 90_000),
}


def _model() -> str:
    return os.environ.get("CLIP_LLM_MODEL", "gpt-6-luna").strip() or "gpt-6-luna"


def _openai_json(system: str, user: str) -> dict[str, Any]:
    key = os.environ["OPENAI_API_KEY"]
    body = json.dumps(
        {
            "model": _model(),
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_object"},
            "temperature": 0.4,
        }
    ).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def _sentences(words: list[dict]) -> list[tuple[float, float, str]]:
    if not words:
        return []
    out: list[tuple[float, float, str]] = []
    start = words[0]["s"]
    buf = [words[0]["w"]]
    for i in range(1, len(words)):
        w = words[i]
        prev = words[i - 1]
        gap = w["s"] - prev["e"]
        buf.append(w["w"])
        if gap > 0.35 or re.search(r"[.?!]$", prev["w"]):
            out.append((start, prev["e"], " ".join(buf)))
            start = w["s"]
            buf = [w["w"]]
    last = words[-1]
    out.append((start, last["e"], " ".join(buf)))
    return out


def _snap(ms: float, words: list[dict], which: str) -> int:
    t = ms / 1000.0
    if which == "start":
        for w in words:
            if w["e"] >= t:
                return max(0, int(w["s"] * 1000) - PADDING_MS)
        return max(0, int(ms) - PADDING_MS)
    for w in reversed(words):
        if w["s"] <= t:
            return int(w["e"] * 1000) + PADDING_MS
    return int(ms) + PADDING_MS


def _overlap(a: tuple[int, int], b: tuple[int, int]) -> float:
    lo = max(a[0], b[0])
    hi = min(a[1], b[1])
    if hi <= lo:
        return 0.0
    span = min(a[1] - a[0], b[1] - b[0])
    return (hi - lo) / max(span, 1)


def _letter_score(hook: str, flow: str, value: str, trend: str) -> int:
    def pts(g: str) -> float:
        g = (g or "C").strip().upper()[:1]
        return {"A": 95, "B": 85, "C": 75, "D": 65, "F": 50}.get(g, 70)

    return int(round(0.35 * pts(hook) + 0.25 * pts(flow) + 0.25 * pts(value) + 0.15 * pts(trend)))


def find_talking_clips(
    words: list[dict],
    settings: dict,
    range_start_ms: int,
    range_end_ms: int,
) -> list[dict]:
    if settings.get("mode") == "captions":
        end = min(range_end_ms, range_start_ms + 180_000)
        return [
            {
                "start_ms": range_start_ms,
                "end_ms": end,
                "title": "Full clip",
                "hook": "Full range",
                "reason": "Captions-only mode",
                "score": 80,
                "scores": {"hook": "B", "flow": "B", "value": "B", "trend": "B"},
            }
        ]

    lo, hi = LENGTH_MS.get(settings.get("clipLength", "auto"), LENGTH_MS["auto"])
    genre = settings.get("genre", "interview")
    prompt = (settings.get("prompt") or "").strip()
    sliced = [w for w in words if w["e"] * 1000 >= range_start_ms and w["s"] * 1000 <= range_end_ms]
    if not sliced:
        return []

    lines = []
    for s, e, txt in _sentences(sliced):
        lines.append(f"[{int(s*1000)}-{int(e*1000)}] {txt}")
    transcript = "\n".join(lines[:400])

    system = (
        "You pick viral short-form clips from interview transcripts. "
        "Return JSON {\"clips\":[{\"start_ms\",\"end_ms\",\"title\",\"hook\",\"reason\","
        "\"hook_grade\",\"flow_grade\",\"value_grade\",\"trend_grade\"}]} "
        "Grades are letter A-F. Respect length bucket and processing range. No overlapping clips."
    )
    user = json.dumps(
        {
            "genre": genre,
            "length_bucket_ms": [lo, hi],
            "range_ms": [range_start_ms, range_end_ms],
            "user_prompt": prompt,
            "transcript": transcript,
        }
    )
    raw = _openai_json(system, user)
    picks = raw.get("clips") or raw.get("candidates") or []
    out: list[dict] = []
    for p in picks:
        s = _snap(float(p.get("start_ms", range_start_ms)), sliced, "start")
        e = _snap(float(p.get("end_ms", s + lo)), sliced, "end")
        s = max(range_start_ms, s)
        e = min(range_end_ms, e)
        if e - s < 5_000:
            continue
        if e - s > hi:
            e = s + hi
        if e - s < lo and e - s < range_end_ms - range_start_ms:
            pass
        score = p.get("score")
        if score is None:
            score = _letter_score(
                p.get("hook_grade", "B"),
                p.get("flow_grade", "B"),
                p.get("value_grade", "B"),
                p.get("trend_grade", "B"),
            )
        out.append(
            {
                "start_ms": s,
                "end_ms": e,
                "title": str(p.get("title") or "Clip")[:200],
                "hook": str(p.get("hook") or "")[:300],
                "reason": str(p.get("reason") or "")[:500],
                "score": int(score),
                "scores": {
                    "hook": p.get("hook_grade", "B"),
                    "flow": p.get("flow_grade", "B"),
                    "value": p.get("value_grade", "B"),
                    "trend": p.get("trend_grade", "B"),
                },
            }
        )

    out.sort(key=lambda x: -x["score"])
    kept: list[dict] = []
    for c in out:
        span = (c["start_ms"], c["end_ms"])
        if any(_overlap(span, (k["start_ms"], k["end_ms"])) > OVERLAP_DEDUPE for k in kept):
            continue
        kept.append(c)
    if not kept and sliced:
        s = range_start_ms
        e = min(range_end_ms, s + hi)
        kept.append(
            {
                "start_ms": s,
                "end_ms": e,
                "title": "Highlight",
                "hook": "",
                "reason": "Fallback single clip",
                "score": 70,
                "scores": {"hook": "B", "flow": "B", "value": "B", "trend": "B"},
            }
        )
    return kept[:20]
