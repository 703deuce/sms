"""#1212 BE-3 Story agent + #1225 BE-16 narration-writing rules.

WF-A idea   -> research plan (logged decisions) -> grounded research -> sourced script.
WF-B script -> lines split VERBATIM (text diff = 0); only `spoken`, hero, chapters are added.
WF-C footage-> narration bridging the uploaded footage, using the catalog (transcripts + moments).
Mock mode / LLM failure -> a deterministic template script (never an automatic paid retry).
"""
from __future__ import annotations

import json
import re

from clips_worker.motion_studio.core.wordclock import Script, spoken_form, split_sentences, typed_spoken_lint
from clips_worker.motion_studio.pipeline import config
from clips_worker.motion_studio.pipeline.llm import LLMError, chat_json

WPM = 122

WRITING_RULES = """Narration-writing rules (documentary):
- One beat per sentence. Short declarative sentences; fragments for rhythm are allowed ("Then nothing.").
- Use ellipsis suspensions sparingly before a reveal ("And then... it collapsed.").
- `text` is what a reader sees (numerals allowed: "$483", "2021", "140%"); `spoken` is how the narrator says it
  ("four hundred eighty-three dollars", "twenty twenty-one", "one hundred forty percent").
- `hero` = the 1-4 word phrase that lands on screen for that line (a number, name, or key idea). Prefer a hero
  that is NOT spoken word for word unless it is a number/name.
- Target pace 120-125 words per minute; chapters separated by longer pauses.
- Every factual claim must cite at least one source URL from the research (or the user's material).
- Never invent numbers. Only use numbers present in the research or the user's material."""


def target_words(length_min: int) -> int:
    return int(max(1, length_min) * WPM)


def _finalize(lines: list[dict]) -> list[dict]:
    out = []
    for i, r in enumerate(lines):
        text = " ".join(str(r.get("text") or "").split())
        if not text:
            continue
        sp = " ".join(str(r.get("spoken") or "").split()) or spoken_form(text)
        if re.search(r"\d", sp):
            sp = spoken_form(sp)
        out.append({"id": f"l{len(out) + 1}", "chapter": int(r.get("chapter") or 1), "text": text, "spoken": sp,
                    "hero": str(r.get("hero") or "")[:40], "typed": str(r.get("typed") or "")[:60],
                    "sources": [s for s in (r.get("sources") or []) if isinstance(s, str) and s.startswith("http")][:4],
                    "quote": r.get("quote") if isinstance(r.get("quote"), dict) else None})
    return out


def _lint(lines: list[dict]) -> list[dict]:
    sc = Script.from_json([{**l, "chapterId": str(l["chapter"])} for l in lines])
    return typed_spoken_lint(sc)


def _fallback_script(brief: str, length_min: int, title: str) -> dict:
    topic = " ".join(brief.split())[:160] or "this story"
    base = [
        ("It starts with a simple question.", "THE QUESTION", 1),
        (f"{topic.rstrip('.')}.", "", 1),
        ("To understand it, we have to go back to the beginning.", "THE BEGINNING", 1),
        ("At first, almost nobody noticed.", "UNNOTICED", 2),
        ("Then the numbers started to move.", "THE NUMBERS", 2),
        ("And once they moved... they did not stop.", "NO STOPPING", 2),
        ("The people closest to it saw it first.", "FIRST WITNESSES", 3),
        ("What they did next changed everything.", "THE TURN", 3),
        ("This is how it happened.", "HOW IT HAPPENED", 3),
    ]
    want = max(len(base), target_words(length_min) // 9)
    rows = [{"text": t, "hero": h, "chapter": c} for t, h, c in base]
    k = 0
    while len(rows) < min(want, 60):
        t, h, c = base[k % len(base)]
        rows.append({"text": t, "hero": h, "chapter": 3 + k // len(base)})
        k += 1
    return {"title": title or topic[:60], "logline": topic, "tone": "curious",
            "chapters": [{"n": i, "title": f"Part {i}"} for i in sorted({r['chapter'] for r in rows})],
            "lines": _finalize(rows), "sources": [], "data": [], "template": True}


def plan_research(brief: str, title: str, log) -> list[dict]:
    sys_ = ("You plan research for a short factual documentary. Decide which questions need live web search "
            "(grounded=true) because the information is recent, fast-changing, numeric or obscure, and which are "
            "stable knowledge you already know (grounded=false). Return JSON {\"queries\":[{\"query\",\"grounded\",\"reason\"}]} "
            f"with at most {max(1, config.research_cap() + 2)} queries.")
    try:
        out, m = chat_json("research_plan", sys_, json.dumps({"title": title, "brief": brief}))
        log("model_call", "research plan", m)
        return [q for q in out.get("queries") or [] if isinstance(q, dict)]
    except LLMError as exc:
        log("model_call_failed", f"research plan skipped: {exc}", {"step": "research_plan"})
        return []


def write_from_idea(brief: str, title: str, length_min: int, research: dict, tone_hint: str, log) -> dict:
    facts = [{"query": r["query"], "text": r["text"][:3000], "sources": r["sources"][:8]} for r in research.get("results", [])]
    sys_ = ("You are the Story agent for a cinematic motion-graphics documentary. Write the narration script.\n" + WRITING_RULES +
            "\nReturn JSON {\"title\",\"logline\",\"tone\",\"chapters\":[{\"n\",\"title\"}],\"lines\":[{\"chapter\",\"text\",\"spoken\",\"hero\","
            "\"typed\",\"sources\":[url]}],\"data\":[{\"label\",\"value\",\"unit\",\"lineIndex\",\"sources\":[url]}]}."
            f" Length: about {target_words(length_min)} spoken words.")
    user = json.dumps({"title": title, "brief": brief, "tone": tone_hint, "research": facts})
    out, m = chat_json("story", sys_, user, max_tokens=16000)
    log("model_call", "story script", m)
    lines = _finalize(out.get("lines") or [])
    if not lines:
        raise LLMError("story returned no lines")
    return {"title": str(out.get("title") or title)[:120], "logline": str(out.get("logline") or "")[:400],
            "tone": str(out.get("tone") or tone_hint or "curious")[:60], "chapters": out.get("chapters") or [],
            "lines": lines, "data": _data(out.get("data"), lines, "research"), "sources": research.get("sources", [])}


def _data(rows, lines, origin: str) -> list[dict]:
    out = []
    for d in rows or []:
        if not isinstance(d, dict):
            continue
        try:
            v = float(d.get("value"))
        except (TypeError, ValueError):
            continue
        li = d.get("lineIndex")
        cites = [s for s in d.get("sources") or [] if isinstance(s, str)]
        out.append({"label": str(d.get("label") or "")[:60], "value": v, "unit": str(d.get("unit") or "")[:12],
                    "lineId": lines[int(li)]["id"] if isinstance(li, int) and 0 <= li < len(lines) else None,
                    "provenance": {"origin": "user" if origin == "user" else ("research" if cites else "model"),
                                   "citations": cites, "approximate": False}})
    return out


def organize_script(script_text: str, title: str, log) -> dict:
    """WF-B: user's words verbatim; metadata only."""
    texts, para_of = [], []
    for pi, para in enumerate([x for x in re.split(r"\n\s*\n", script_text.strip()) if x.strip()]):
        for t in split_sentences(para):
            texts.append(t)
            para_of.append(pi)
    paras = max(para_of) + 1 if para_of else 1
    per_ch = max(1, -(-paras // max(1, min(8, paras))))
    lines = _finalize([{"text": t} for t in texts])
    meta = {}
    if not config.mock():
        sys_ = ("You organize a user's documentary narration. DO NOT change any words. For each line index return chapter, "
                "hero (1-4 words to show on screen) and optional typed label. Also return title, tone and chapter titles. "
                "JSON {\"title\",\"tone\",\"chapters\":[{\"n\",\"title\"}],\"lines\":[{\"i\",\"chapter\",\"hero\",\"typed\"}],"
                "\"data\":[{\"label\",\"value\",\"unit\",\"lineIndex\"}]} (data only for numbers literally in the text).")
        try:
            meta, m = chat_json("story", sys_, json.dumps({"title": title, "lines": [l["text"] for l in lines]}))
            log("model_call", "organize script", m)
        except LLMError as exc:
            log("model_call_failed", f"organize fell back to heuristics: {exc}", {"step": "story"})
    by_i = {int(r.get("i")): r for r in meta.get("lines") or [] if isinstance(r, dict) and str(r.get("i", "")).isdigit()}
    for i, l in enumerate(lines):
        r = by_i.get(i) or {}
        l["chapter"] = int(r.get("chapter") or 1 + para_of[i] // per_ch)
        l["hero"] = str(r.get("hero") or _heuristic_hero(l["text"]))[:40]
        l["typed"] = str(r.get("typed") or "")[:60]
    assert [l["text"] for l in lines] == [" ".join(t.split()) for t in texts]      # WF-B diff = 0
    return {"title": str(meta.get("title") or title)[:120], "tone": str(meta.get("tone") or "curious")[:60],
            "chapters": meta.get("chapters") or [{"n": n, "title": f"Part {n}"} for n in sorted({l['chapter'] for l in lines})],
            "lines": lines, "data": _data(meta.get("data"), lines, "user"), "sources": [], "verbatim": True}


def _heuristic_hero(text: str) -> str:
    m = re.search(r"[$€£]?\d[\d,.]*\s*(%|percent|million|billion|thousand)?", text)
    if m:
        return m.group(0).strip().rstrip(".,")
    caps = re.findall(r"\b[A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,})*", text[1:])
    if caps:
        return caps[0][:30].upper()
    words = [w for w in re.findall(r"[A-Za-z']+", text) if len(w) > 4]
    return " ".join(words[:2]).upper()


def write_from_footage(brief: str, title: str, length_min: int, catalog: list[dict], log) -> dict:
    cat = [{"assetId": a["id"], "kind": a["kind"], "filename": a.get("filename"),
            "summary": (a.get("analysis") or {}).get("summary"),
            "transcript": ((a.get("analysis") or {}).get("transcriptText") or "")[:4000],
            "moments": ((a.get("analysis") or {}).get("moments") or [])[:20]} for a in catalog]
    sys_ = ("You are the Story agent. Build a documentary narration around the user's uploaded footage. Lines are either "
            "narration, or a quote from an uploaded clip: {\"quote\":{\"assetId\",\"text\":<exact words from the transcript>}} "
            "with `text` repeating the quote.\n" + WRITING_RULES +
            "\nReturn JSON {\"title\",\"logline\",\"tone\",\"chapters\":[{\"n\",\"title\"}],\"lines\":[{\"chapter\",\"text\",\"spoken\",\"hero\",\"typed\",\"quote\"}]}"
            f" Length: about {target_words(length_min)} spoken words.")
    out, m = chat_json("story", sys_, json.dumps({"title": title, "brief": brief, "catalog": cat}), max_tokens=16000)
    log("model_call", "story from footage", m)
    lines = _finalize(out.get("lines") or [])
    if not lines:
        raise LLMError("story returned no lines")
    return {"title": str(out.get("title") or title)[:120], "logline": str(out.get("logline") or "")[:400],
            "tone": str(out.get("tone") or "curious")[:60], "chapters": out.get("chapters") or [], "lines": lines,
            "data": [], "sources": []}


def build_story(project: dict, catalog: list[dict], log) -> dict:
    s = project.get("settings") or {}
    workflow = project["workflow"]
    title = project.get("title") or ""
    brief = project.get("brief") or ""
    length_min = int(s.get("lengthMin") or 3)
    research = {"results": [], "decisions": [], "sources": []}
    story = None
    if workflow == "script" and (s.get("script") or brief):
        story = organize_script(s.get("script") or brief, title, log)
    else:
        if workflow == "idea" and not config.mock():
            from clips_worker.motion_studio.directors.documentary.research import run_research
            plan = plan_research(brief, title, log)
            research = run_research(plan, log)
        if not config.mock():
            try:
                story = (write_from_footage(brief, title, length_min, catalog, log) if workflow == "footage" and catalog
                         else write_from_idea(brief, title, length_min, research, s.get("tone", ""), log))
            except LLMError as exc:
                log("model_call_failed", f"story fell back to the template script: {exc}", {"step": "story"})
        if story is None:
            story = _fallback_script(brief, length_min, title)
    for d in story.get("data") or []:
        if d["provenance"]["origin"] == "model":
            d["provenance"]["approximate"] = True
    story["researchDecisions"] = research.get("decisions", [])
    story["sources"] = story.get("sources") or research.get("sources", [])
    story["lint"] = _lint(story["lines"])
    story["wordCount"] = sum(len(l["spoken"].split()) for l in story["lines"])
    story["estimatedDurationS"] = round(story["wordCount"] / WPM * 60 + 0.9 * len(story.get("chapters") or []), 1)
    claims_missing = [l["id"] for l in story["lines"] if workflow == "idea" and research.get("results") and re.search(r"\d", l["text"]) and not l["sources"]]
    story["unsourcedNumericLines"] = claims_missing
    return story
