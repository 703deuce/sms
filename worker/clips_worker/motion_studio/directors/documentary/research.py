"""#1212 BE-3 optional grounded research: Gemini generateContent with the google_search tool.

Web search is off unless the project setting webResearch is on. Failed calls
raise a visible research-stage error instead of silently degrading to unsourced claims.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request

from clips_worker.motion_studio.pipeline import config

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# gemini-2.5-flash returns 404 for new API keys ("no longer available to new users").
DEFAULT_RESEARCH_MODEL = "gemini-3.8-flash"


def _model() -> str:
    return (os.environ.get("MOTION_STUDIO_RESEARCH_MODEL") or DEFAULT_RESEARCH_MODEL).strip()


def _redact(text: str) -> str:
    text = re.sub(r"AIza[0-9A-Za-z_-]{10,}", "AIzaREDACTED", text)
    return re.sub(r"(?i)(api[_-]?key|key)(\s*[:=]\s*)([^\s&\"']+)", r"\1\2REDACTED", text)


def _http_error(exc: urllib.error.HTTPError) -> tuple[int, str]:
    try:
        raw = exc.read().decode("utf-8", "replace")
    except Exception:  # noqa: BLE001
        raw = str(exc.reason or "")
    return int(exc.code or 0), _redact(raw)[:800]


def _parse_response(data: dict, query: str, model: str, t0: float) -> dict:
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
            supports.append({"claim": seg, "sources": [sources[i]["url"] for i in idx if i < len(sources)]})
    return {"query": query, "text": text, "sources": sources, "claims": supports,
            "searchQueries": gm.get("webSearchQueries") or [], "ms": int((time.time() - t0) * 1000), "model": model}


def _post(query: str, model: str, timeout_s: float) -> dict:
    from clips_worker.gemini_vision import _key
    body = {"contents": [{"role": "user", "parts": [{"text": (
        "Research this for a factual documentary script. Include all relevant factual evidence with dates and numbers, "
        "and keep each claim attributable to a source.\n\nQuestion: " + query)}]}],
            "tools": [{"google_search": {}}]}
    url = GEMINI_URL.format(model=model)
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "x-goog-api-key": _key()}, method="POST")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as exc:
        status, err = _http_error(exc)
        # Retired-model 404: retry once on the current default without re-requesting the same bad id.
        if status == 404 and model != DEFAULT_RESEARCH_MODEL:
            return _post(query, DEFAULT_RESEARCH_MODEL, timeout_s)
        raise urllib.error.HTTPError(url, status, err, exc.headers, None)
    return _parse_response(data, query, model, t0)


def grounded_query(query: str, timeout_s: float = 90) -> dict:
    return _post(query, _model(), timeout_s)


def run_research(plan: list[dict], log) -> dict:
    """plan: [{query, grounded: bool, reason}] from the story step. Returns {results, decisions, sources}.

    A failed grounded call raises a visible discrepancy; never silently omit research.
    """
    seen, results, decisions, sources = set(), [], [], []
    for item in plan or []:
        q = " ".join(str(item.get("query") or "").split())
        if not q or q.lower() in seen:
            continue
        seen.add(q.lower())
        grounded = bool(item.get("grounded"))
        reason = str(item.get("reason") or "")
        if grounded and config.mock():
            grounded, reason = False, f"mock mode; {reason}"
        decisions.append({"query": q, "grounded": grounded, "reason": reason})
        log("research_decision", f"{'GROUND' if grounded else 'model knowledge'}: {q}", {"query": q, "grounded": grounded, "reason": reason})
        if not grounded:
            continue
        try:
            res = grounded_query(q)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, RuntimeError) as exc:
            status = getattr(exc, "code", None)
            detail = _redact(str(exc.reason if isinstance(exc, urllib.error.HTTPError) else exc))[:400]
            from clips_worker.motion_studio.core.output_contracts import StageContractError
            log("research_failed", f"grounded search failed ({status or type(exc).__name__})",
                {"query": q, "status": status, "error": detail})
            raise StageContractError("research", [f"query {q!r}: grounded lookup failed ({status or type(exc).__name__}): {detail}"]) from exc
        results.append(res)
        for s in res["sources"]:
            if s["url"] not in {x["url"] for x in sources}:
                sources.append(s)
        log("research_result", f"{len(res['sources'])} sources for: {q}", {"query": q, "sources": len(res["sources"]), "ms": res["ms"]})
    return {"results": results, "decisions": decisions, "sources": sources}
