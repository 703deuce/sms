"""#1212 BE-3 grounded research: Gemini generateContent with the google_search tool, called only when
the plan says model knowledge isn't enough (recent/new info). Every query logs {query, grounded, reason}.
Capped (MOTION_STUDIO_RESEARCH_CAP), de-duplicated, cached per project; a failed call is NOT re-requested."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request

from clips_worker.motion_studio.pipeline import config

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _model() -> str:
    import os
    return (os.environ.get("MOTION_STUDIO_RESEARCH_MODEL") or "gemini-2.5-flash").strip()


def grounded_query(query: str, timeout_s: float = 90) -> dict:
    from clips_worker.gemini_vision import _key
    body = {"contents": [{"role": "user", "parts": [{"text": (
        "Research this for a factual documentary script. Answer in 5-10 dense factual bullet points with dates and numbers, "
        "and keep each claim attributable to a source.\n\nQuestion: " + query)}]}],
        "tools": [{"google_search": {}}]}
    req = urllib.request.Request(GEMINI_URL.format(model=_model()), data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "x-goog-api-key": _key()}, method="POST")
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=timeout_s) as r:
        data = json.loads(r.read())
    cand = (data.get("candidates") or [{}])[0]
    text = "".join(p.get("text", "") for p in (cand.get("content") or {}).get("parts", []))
    gm = cand.get("groundingMetadata") or {}
    sources = []
    for ch in gm.get("groundingChunks") or []:
        w = ch.get("web") or {}
        if w.get("uri"):
            sources.append({"url": w["uri"], "title": w.get("title") or ""})
    supports = []
    for s in gm.get("groundingSupports") or []:
        seg = (s.get("segment") or {}).get("text")
        idx = s.get("groundingChunkIndices") or []
        if seg:
            supports.append({"claim": seg[:400], "sources": [sources[i]["url"] for i in idx if i < len(sources)]})
    return {"query": query, "text": text, "sources": sources, "claims": supports,
            "searchQueries": gm.get("webSearchQueries") or [], "ms": int((time.time() - t0) * 1000), "model": _model()}


def run_research(plan: list[dict], log) -> dict:
    """plan: [{query, grounded: bool, reason}] from the story step. Returns {results, decisions, sources}."""
    cap = config.research_cap()
    seen, results, decisions, sources = set(), [], [], []
    used = 0
    for item in plan or []:
        q = " ".join(str(item.get("query") or "").split())[:300]
        if not q or q.lower() in seen:
            continue
        seen.add(q.lower())
        grounded = bool(item.get("grounded"))
        reason = str(item.get("reason") or "")[:300]
        if grounded and used >= cap:
            grounded, reason = False, f"cap reached ({cap}); {reason}"
        if grounded and config.mock():
            grounded, reason = False, f"mock mode; {reason}"
        decisions.append({"query": q, "grounded": grounded, "reason": reason})
        log("research_decision", f"{'GROUND' if grounded else 'model knowledge'}: {q}", {"query": q, "grounded": grounded, "reason": reason})
        if not grounded:
            continue
        used += 1
        try:
            res = grounded_query(q)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, RuntimeError) as exc:
            log("research_failed", f"grounded call failed (no re-request): {type(exc).__name__}", {"query": q})
            continue
        results.append(res)
        for s in res["sources"]:
            if s["url"] not in {x["url"] for x in sources}:
                sources.append(s)
        log("research_result", f"{len(res['sources'])} sources for: {q}", {"query": q, "sources": len(res["sources"]), "ms": res["ms"]})
    return {"results": results, "decisions": decisions, "sources": sources}
