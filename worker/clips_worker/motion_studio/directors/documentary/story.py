"""#1212 BE-3 Story agent + #1225 BE-16 narration-writing rules.

WF-A idea   -> research plan (logged decisions) -> grounded research -> sourced script.
WF-B script -> lines split VERBATIM (text diff = 0); only `spoken`, hero, chapters are added.
WF-C footage-> narration bridging the uploaded footage, using the catalog (transcripts + moments).
Mock mode / LLM failure -> a deterministic template script (never an automatic paid retry).
"""
from __future__ import annotations

import hashlib
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
- Cite a source URL on a factual claim when the research or the user's material provides one; if there are no sources, still write the line and leave sources as [].
- Do not invent figures. Use numbers from the idea, the research, the user's material, or well-established public facts the story is recounting."""


def target_words(length_min: int) -> int:
    return int(max(1, length_min) * WPM)



def _extract_lines(out: dict) -> list:
    """Accept the documented schema plus common alternates so a valid script is not dropped as 'no lines'."""
    lines = out.get("lines") if isinstance(out, dict) else None
    if not lines and isinstance(out, dict):
        for k in ("script", "narration", "beats", "story"):
            v = out.get(k)
            if isinstance(v, list) and v:
                lines = v
                break
            if isinstance(v, dict) and isinstance(v.get("lines"), list) and v["lines"]:
                lines = v["lines"]
                break
    rows = []
    for r in lines or []:
        if isinstance(r, str) and r.strip():
            rows.append({"text": r.strip()})
        elif isinstance(r, dict):
            text = r.get("text") or r.get("narration") or r.get("content") or r.get("sentence") or r.get("line") or ""
            rows.append({**r, "text": text})
    return rows


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


def _research_key(brief: str, title: str) -> str:
    return hashlib.sha256(f"{title}\n{brief}".encode()).hexdigest()[:16]


def default_research_plan(brief: str, title: str) -> list[dict]:
    """Deterministic research plan used when the planner LLM fails (no empty skip)."""
    topic = " ".join(x for x in (title, brief) if x).strip() or "the subject"
    qs = [
        {"query": f"Key facts, dates, and figures about {topic[:220]}", "grounded": True,
         "reason": "deterministic plan: numeric and date claims need live sources"},
        {"query": f"Who was involved and what happened: {topic[:220]}", "grounded": True,
         "reason": "deterministic plan: confirm people and events"},
    ]
    if re.search(r"20\d{2}|this year|latest|recent|today|current", topic, re.I):
        qs.append({"query": f"Latest developments: {topic[:220]}", "grounded": True,
                   "reason": "brief looks time-sensitive; model knowledge may be stale"})
    return qs[: max(1, config.research_cap())]


def backfill_sources(lines: list[dict], research: dict) -> list[dict]:
    """Attach research URLs to numeric lines the model left unsourced (ST-RW-003)."""
    claims = []
    for r in research.get("results") or []:
        urls = [s["url"] for s in (r.get("sources") or []) if s.get("url")]
        blob = (r.get("text") or "")
        for c in r.get("claims") or []:
            claims.append((" ".join((c.get("claim") or "", blob)).lower(), c.get("sources") or urls))
        if urls:
            claims.append((blob.lower(), urls))
    if not claims:
        return lines
    for l in lines:
        if l.get("sources") or not re.search(r"\d", l.get("text") or ""):
            continue
        toks = set(re.findall(r"[a-z0-9$%]+", (l["text"] + " " + l.get("spoken", "")).lower()))
        nums = set(re.findall(r"\d[\d,.]*", l["text"]))
        best, score, num_hit = [], 0, False
        for blob, urls in claims:
            hit = sum(1 for t in toks if len(t) > 3 and t in blob)
            n_ok = any(n in blob for n in nums)
            if (hit > score or (n_ok and hit >= score)) and urls:
                best, score, num_hit = urls, hit, n_ok
        if num_hit or score >= 2:
            l["sources"] = list(dict.fromkeys(best))[:4]
    return lines


def _lines_from_research(brief: str, length_min: int, title: str, research: dict) -> dict | None:
    """When the story LLM fails, write a sourced script from grounded bullets instead of a generic template."""
    facts = []
    for r in research.get("results") or []:
        urls = [s["url"] for s in (r.get("sources") or []) if s.get("url")]
        for raw in (r.get("text") or "").splitlines():
            line = re.sub(r"^[\s\-•*\d.]+", "", raw).strip()
            if len(line) < 24:
                continue
            facts.append((line.rstrip(".") + ".", urls))
    if len(facts) < 3:
        return None
    want = min(max(6, target_words(length_min) // 12), 24, len(facts) + 2)
    topic = " ".join(brief.split())[:160] or title or "this story"
    rows = [{"text": f"This is the story of {topic.rstrip('.')}.", "hero": _heuristic_hero(topic), "chapter": 1, "sources": []}]
    for i, (text, urls) in enumerate(facts[: want - 2]):
        ch = 1 if i < 2 else 2 if i < (want // 2) else 3
        rows.append({"text": text, "hero": _heuristic_hero(text), "chapter": ch, "sources": urls[:4]})
    rows.append({"text": "That is how it happened.", "hero": "HOW IT HAPPENED", "chapter": 3, "sources": []})
    return {"title": title or topic[:60], "logline": topic, "tone": "curious",
            "chapters": [{"n": i, "title": f"Part {i}"} for i in sorted({r["chapter"] for r in rows})],
            "lines": _finalize(rows), "sources": research.get("sources") or [], "data": [], "fromResearch": True}


def _fallback_script(brief: str, length_min: int, title: str, research: dict | None = None) -> dict:
    sourced = _lines_from_research(brief, length_min, title, research or {})
    if sourced:
        return sourced
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
    rows = [{"text": t, "hero": h or _heuristic_hero(t), "chapter": c} for t, h, c in base]
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
        queries = [q for q in out.get("queries") or [] if isinstance(q, dict) and q.get("query")]
        return queries or default_research_plan(brief, title)
    except LLMError as exc:
        log("model_call_failed", f"research plan fell back to the deterministic queries: {exc}", {"step": "research_plan"})
        return default_research_plan(brief, title)


def write_from_idea(brief: str, title: str, length_min: int, research: dict, tone_hint: str, log) -> dict:
    facts = [{"query": r["query"], "text": r["text"][:3000], "sources": r["sources"][:8]} for r in research.get("results", [])]
    sys_ = ("You are the Story agent for a cinematic motion-graphics documentary in the family of a short, designed film: "
            "one clear through-line, type and numbers landing on the spoken word, not a news recap and not a list of facts.\n"
            + WRITING_RULES +
            "\nWrite short declarative sentences; one beat each. Heroes are a number, a name, or a key phrase (1-4 words), never a full sentence. "
            "Write a complete script even when research notes are empty: use the user's idea and established knowledge. "
            "Do not invent figures that are not in the idea or the research notes. Numbers that appear in the idea may be used. "
            "If research notes include sources, cite those URLs on numeric lines; if notes are empty, still return a full lines "
            "array and leave sources as []. Never return an empty lines list.\n"
            "\nReturn JSON {\"title\",\"logline\",\"tone\",\"chapters\":[{\"n\",\"title\"}],\"lines\":[{\"chapter\",\"text\",\"spoken\",\"hero\","
            "\"typed\",\"sources\":[url]}],\"data\":[{\"label\",\"value\",\"unit\",\"lineIndex\",\"sources\":[url]}]}."
            f" Length: about {target_words(length_min)} spoken words.")
    user = json.dumps({"title": title, "brief": brief, "tone": tone_hint, "research": facts})
    out, m = chat_json("story", sys_, user, max_tokens=16000)
    lines = _finalize(_extract_lines(out))
    m = {**m, "keys": sorted(out.keys()) if isinstance(out, dict) else [], "lineCount": len(lines)}
    log("model_call", "story script", m)
    if not lines:
        raise LLMError(f"story returned no lines (keys={sorted(out.keys()) if isinstance(out, dict) else type(out).__name__})")
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
            "moments": ((a.get("analysis") or {}).get("moments") or [])[:20],
            "people": ((a.get("analysis") or {}).get("people") or [])[:8]} for a in catalog]
    sys_ = ("You are the Story agent. Build a documentary narration around the user's uploaded footage. Lines are either "
            "narration, or a quote from an uploaded clip: {\"quote\":{\"assetId\",\"text\":<exact words from the transcript>}} "
            "with `text` repeating the quote.\n" + WRITING_RULES +
            "\nReturn JSON {\"title\",\"logline\",\"tone\",\"chapters\":[{\"n\",\"title\"}],\"lines\":[{\"chapter\",\"text\",\"spoken\",\"hero\",\"typed\",\"quote\"}]}"
            f" Length: about {target_words(length_min)} spoken words.")
    out, m = chat_json("story", sys_, json.dumps({"title": title, "brief": brief, "catalog": cat}), max_tokens=16000)
    lines = _finalize(_extract_lines(out))
    m = {**m, "keys": sorted(out.keys()) if isinstance(out, dict) else [], "lineCount": len(lines)}
    log("model_call", "story from footage", m)
    if not lines:
        raise LLMError(f"story returned no lines (keys={sorted(out.keys()) if isinstance(out, dict) else type(out).__name__})")
    return {"title": str(out.get("title") or title)[:120], "logline": str(out.get("logline") or "")[:400],
            "tone": str(out.get("tone") or "curious")[:60], "chapters": out.get("chapters") or [], "lines": lines,
            "data": [], "sources": []}



def _web_research_on(settings: dict | None) -> bool:
    """Project setting webResearch is off by default. Only an explicit on/true enables grounded search."""
    v = (settings or {}).get("webResearch")
    if isinstance(v, str):
        return v.strip().lower() in {"1", "true", "yes", "on"}
    return v is True


def build_story(project: dict, catalog: list[dict], log) -> dict:
    s = project.get("settings") or {}
    workflow = project["workflow"]
    title = project.get("title") or ""
    brief = project.get("brief") or ""
    length_min = int(s.get("lengthMin") or 3)
    research = {"results": [], "decisions": [], "sources": []}
    story = None
    cache_key = _research_key(brief, title)
    prev = project.get("story") or {}
    if workflow == "script" and (s.get("script") or brief):
        story = organize_script(s.get("script") or brief, title, log)
    else:
        if workflow == "idea" and not config.mock() and _web_research_on(s):
            from clips_worker.motion_studio.directors.documentary.research import run_research
            if prev.get("researchCacheKey") == cache_key and (prev.get("researchResults") or prev.get("researchDecisions")):
                research = {"results": prev.get("researchResults") or [], "decisions": prev.get("researchDecisions") or [],
                            "sources": prev.get("sources") or []}
                log("research_cache", "reusing grounded research for this brief (no re-request)", {"queries": len(research["decisions"])})
            else:
                plan = plan_research(brief, title, log) or default_research_plan(brief, title)
                research = run_research(plan, log)
        elif workflow == "idea" and not _web_research_on(s):
            log("research_skipped", "Web research is off; writing from model knowledge and uploads", {})
        if not config.mock():
            try:
                story = (write_from_footage(brief, title, length_min, catalog, log) if workflow == "footage" and catalog
                         else write_from_idea(brief, title, length_min, research, s.get("tone", ""), log))
            except LLMError as exc:
                log("model_call_failed", f"story fell back: {exc}", {"step": "story"})
        if story is None:
            story = _fallback_script(brief, length_min, title, research)
    for d in story.get("data") or []:
        if d["provenance"]["origin"] == "model":
            d["provenance"]["approximate"] = True
    if workflow == "idea" and research.get("results"):
        story["lines"] = backfill_sources(story["lines"], research)
    story["researchDecisions"] = research.get("decisions", [])
    story["researchResults"] = research.get("results") or []
    story["researchCacheKey"] = cache_key
    story["sources"] = story.get("sources") or research.get("sources", [])
    story["lint"] = _lint(story["lines"])
    story["wordCount"] = sum(len(l["spoken"].split()) for l in story["lines"])
    story["estimatedDurationS"] = round(story["wordCount"] / WPM * 60 + 0.9 * len(story.get("chapters") or []), 1)
    claims_missing = [l["id"] for l in story["lines"] if workflow == "idea" and research.get("results") and re.search(r"\d", l["text"]) and not l["sources"]]
    story["unsourcedNumericLines"] = claims_missing
    return story
