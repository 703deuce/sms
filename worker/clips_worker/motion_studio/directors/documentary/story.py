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
from clips_worker.motion_studio.core.designer_capabilities import catalog_records
from clips_worker.motion_studio.core.output_contracts import (
    StageContractError, format_contract, schema_for, schema_name, validate_story,
)

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
        aid = r.get("visualAssetId") or r.get("assetId")
        if isinstance(r.get("quote"), dict) and r["quote"].get("assetId"):
            aid = aid or r["quote"].get("assetId")
        out.append({"id": f"l{len(out) + 1}", "chapter": int(r.get("chapter") or 1), "text": text, "spoken": sp,
                    "hero": str(r.get("hero") or "")[:40], "typed": str(r.get("typed") or "")[:60],
                    "sources": [s for s in (r.get("sources") or []) if isinstance(s, str) and s.startswith("http")],
                    "quote": r.get("quote") if isinstance(r.get("quote"), dict) else None,
                    "visualAssetId": aid or None,
                    "illustrative": bool(r.get("illustrative")) if r.get("illustrative") is not None else False,
                    "provenance": (str(r.get("provenance"))[:240] if r.get("provenance") else ("illustrative" if r.get("illustrative") else None))})
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
        {"query": f"Key facts, dates, and figures about {topic}", "grounded": True,
         "reason": "deterministic plan: numeric and date claims need live sources"},
        {"query": f"Who was involved and what happened: {topic}", "grounded": True,
         "reason": "deterministic plan: confirm people and events"},
    ]
    if re.search(r"20\d{2}|this year|latest|recent|today|current", topic, re.I):
        qs.append({"query": f"Latest developments: {topic}", "grounded": True,
                   "reason": "brief looks time-sensitive; model knowledge may be stale"})
    return qs


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
            l["sources"] = list(dict.fromkeys(best))
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
        rows.append({"text": text, "hero": _heuristic_hero(text), "chapter": ch, "sources": urls})
    rows.append({"text": "That is how it happened.", "hero": "HOW IT HAPPENED", "chapter": 3, "sources": []})
    return {"title": title or topic[:60], "logline": topic, "tone": "curious",
            "chapters": [{"n": i, "title": f"Part {i}"} for i in sorted({r["chapter"] for r in rows})],
            "lines": _finalize(rows), "sources": research.get("sources") or [], "data": [], "fromResearch": True}


def _fallback_script(brief: str, length_min: int, title: str, research: dict | None = None, catalog: list[dict] | None = None) -> dict:
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
    # When assets are actually in hand, add a unique cited line for each (do not invent beyond the analysis).
    extras = []
    for rec in catalog_records(catalog):
        ev = rec.get("evidence") or {}
        label = (ev.get("summary") or ev.get("description") or rec.get("filename") or rec.get("assetId") or "").strip()
        label = " ".join(str(label).split())
        if not label:
            continue
        sentence = f"There is also this: {label.rstrip('.')}."
        if any(sentence == r["text"] for r in rows + extras):
            continue
        extras.append({"text": sentence, "hero": _heuristic_hero(sentence), "chapter": 3,
                        "visualAssetId": rec["assetId"]})
    # Base connective lines are illustrative when they do not cite an asset.
    if extras:
        for r in rows:
            r.setdefault("illustrative", True)
            r.setdefault("provenance", "illustrative")
    rows.extend(extras)
    return {"title": title or topic[:60], "logline": topic, "tone": "curious",
            "chapters": [{"n": i, "title": f"Part {i}"} for i in sorted({r['chapter'] for r in rows})],
            "lines": _finalize(rows), "sources": [], "data": [], "missingAssets": [], "template": True}


def plan_research(brief: str, title: str, log) -> list[dict]:
    sys_ = ("You plan research for a short factual documentary. Decide which questions need live web search "
            "(grounded=true) because the information is recent, fast-changing, numeric or obscure, and which are "
            "stable knowledge you already know (grounded=false). Return JSON {\"queries\":[{\"query\",\"grounded\",\"reason\"}]} "
            "with as many distinct grounded questions as the subject requires.")
    try:
        out, m = chat_json("research_plan", sys_, json.dumps({"title": title, "brief": brief}))
        log("model_call", "research plan", m)
        queries = [q for q in out.get("queries") or [] if isinstance(q, dict) and q.get("query")]
        if not queries:
            log("research_plan_invalid", "research plan returned no queries", {"output": out, "errors": ["research plan returned no queries"]})
            raise StageContractError("research_plan", ["research plan returned no queries"], output=out)
        return queries
    except StageContractError:
        raise
    except LLMError as exc:
        log("model_call_failed", f"research plan failed: {exc}", {"step": "research_plan"})
        raise StageContractError("research_plan", [f"research plan model call failed: {exc}"], output=getattr(exc, "output", None)) from exc


def write_from_idea(brief: str, title: str, length_min: int, research: dict, tone_hint: str, log, catalog: list[dict] | None = None) -> dict:
    facts = [{"query": r["query"], "text": r["text"], "sources": r["sources"]} for r in research.get("results", [])]
    sys_ = ("You are the Story agent for a cinematic motion-graphics documentary in the family of a short, designed film: "
            "one clear through-line, type and numbers landing on the spoken word, not a news recap and not a list of facts.\n"
            + WRITING_RULES +
            "\nWrite short declarative sentences; one beat each. Heroes are a number, a name, or a key phrase (1-4 words), never a full sentence. "
            "Write a complete script even when research notes are empty: use the user's idea and established knowledge. "
            "Do not invent figures that are not in the idea or the research notes. Numbers that appear in the idea may be used. "
            "If research notes include sources, cite those URLs on numeric lines; if notes are empty, still return a full lines "
            "array and leave sources as []. Never return an empty lines list. "
            "The story is built FROM the assets actually in hand (the catalog you are given: user uploads "
            "and any media that was actually acquired). Do not assume media that was requested but is not in this catalog. "
            "When assets are in hand, write the story around them: every still and clip should earn at least one line "
            "that names the subject, place, or object the file actually shows, and that line must set visualAssetId to that asset. "
            "Video clips in hand anchor the sequences they support. Do not invent wording, people, or a state the analysis evidence does not record. "
            "Beats that go beyond the assets in hand must be labeled illustrative=true with a provenance (registered engine tools or typography). "
            "Wishes for media that is not in hand go on missingAssets and must not be narrated as if they exist.\n"
            "\nReturn JSON {\"title\",\"logline\",\"tone\",\"chapters\":[{\"n\",\"title\"}],\"lines\":[{\"chapter\",\"text\",\"spoken\",\"hero\","
            "\"typed\",\"sources\":[url]}],\"data\":[{\"label\",\"value\",\"unit\",\"lineIndex\",\"sources\":[url]}]}."
            f" Length: about {target_words(length_min)} spoken words.")
    uploads = catalog_records(catalog)
    sys_ = sys_ + "\n\n" + format_contract("story")
    user = json.dumps({"title": title, "brief": brief, "tone": tone_hint, "research": facts,
                       "assetsInHand": uploads, "uploads": uploads,
                       "assetIds": [u["assetId"] for u in uploads],
                       "instruction": "Build the story only from assetsInHand. Cite visualAssetId. Put wishes that are not in hand on missingAssets."})
    out, m = chat_json("story", sys_, user, max_tokens=128000, schema=schema_for("story"), schema_name=schema_name("story"))
    lines = _finalize(_extract_lines(out))
    m = {**m, "keys": sorted(out.keys()) if isinstance(out, dict) else [], "lineCount": len(lines)}
    log("model_call", "story script", m)
    draft = {"title": str(out.get("title") or title)[:120], "logline": str(out.get("logline") or "")[:400],
             "tone": str(out.get("tone") or tone_hint or "curious")[:60], "chapters": out.get("chapters") or [],
             "lines": lines, "data": _data(out.get("data"), lines, "research"), "sources": research.get("sources", [])}
    errs = validate_story(draft, catalog=catalog)
    if errs:
        log("story_invalid", "story failed validation; requesting a targeted repair", {"errors": errs[:12], "output": out})
        out, m = chat_json(
            "story", sys_, json.dumps({"previous": out, "errors": errs,
                                       "instruction": "Fix ONLY these validation errors. Return the full corrected story."}),
            max_tokens=128000, schema=schema_for("story"), schema_name=schema_name("story"),
        )
        log("model_call", "story repair", m)
        lines = _finalize(_extract_lines(out))
        draft = {"title": str(out.get("title") or title)[:120], "logline": str(out.get("logline") or "")[:400],
                 "tone": str(out.get("tone") or tone_hint or "curious")[:60], "chapters": out.get("chapters") or [],
                 "lines": lines, "data": _data(out.get("data"), lines, "research"), "sources": research.get("sources", [])}
        errs = validate_story(draft, catalog=catalog)
        if errs:
            raise StageContractError("story", errs, repaired=True, output=out)
    return draft


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
            log("model_call_failed", f"organize script failed: {exc}", {"step": "story"})
            raise StageContractError("story", [f"organize script model call failed: {exc}"], output=getattr(exc, "output", None)) from exc
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
    cat = catalog_records(catalog)
    sys_ = ("You are the Story agent. Build a documentary narration FROM the assets actually in hand "
            "(the catalog of uploaded and actually acquired media). Never claim footage that was requested "
            "but is not in this catalog. Lines are either narration that cites visualAssetId, a quote from "
            "an in-hand clip: {\"quote\":{\"assetId\",\"text\":<exact words from the transcript>}} "
            "with `text` repeating the quote, or an illustrative beat (illustrative=true, provenance) built "
            "from typography or registered engine tools. Video clips in hand anchor the sequences they support. "
            "Every still and clip should earn at least one line. Wishes that are not in hand go on missingAssets "
            "and must not be narrated as if they exist. Do not invent wording the analysis evidence does not record.\n"
            + WRITING_RULES +
            "\nReturn JSON {\"title\",\"logline\",\"tone\",\"chapters\":[{\"n\",\"title\"}],"
            "\"lines\":[{\"chapter\",\"text\",\"spoken\",\"hero\",\"typed\",\"quote\",\"visualAssetId\",\"illustrative\",\"provenance\"}],"
            "\"missingAssets\":[{\"need\",\"reason\"}]}"
            f" Length: about {target_words(length_min)} spoken words.")
    sys_ = sys_ + "\n\n" + format_contract("story")
    out, m = chat_json("story", sys_, json.dumps({"title": title, "brief": brief, "assetsInHand": cat,
                                                "catalog": cat,
                                                "assetIds": [c["assetId"] for c in cat],
                                                "instruction": "Build the story only from assetsInHand. Cite visualAssetId. Put wishes that are not in hand on missingAssets."}),
                       max_tokens=128000, schema=schema_for("story"), schema_name=schema_name("story"))
    lines = _finalize(_extract_lines(out))
    m = {**m, "keys": sorted(out.keys()) if isinstance(out, dict) else [], "lineCount": len(lines)}
    log("model_call", "story from footage", m)
    draft = {"title": str(out.get("title") or title)[:120], "logline": str(out.get("logline") or "")[:400],
             "tone": str(out.get("tone") or "curious")[:60], "chapters": out.get("chapters") or [], "lines": lines,
             "data": [], "sources": []}
    errs = validate_story(draft, catalog=catalog)
    if errs:
        log("story_invalid", "footage story failed validation; requesting a targeted repair", {"errors": errs[:12], "output": out})
        out, m = chat_json(
            "story", sys_, json.dumps({"previous": out, "errors": errs,
                                       "instruction": "Fix ONLY these validation errors. Return the full corrected story."}),
            max_tokens=128000, schema=schema_for("story"), schema_name=schema_name("story"),
        )
        log("model_call", "story repair", m)
        lines = _finalize(_extract_lines(out))
        draft = {"title": str(out.get("title") or title)[:120], "logline": str(out.get("logline") or "")[:400],
                 "tone": str(out.get("tone") or "curious")[:60], "chapters": out.get("chapters") or [], "lines": lines,
                 "data": [], "sources": []}
        errs = validate_story(draft, catalog=catalog)
        if errs:
            raise StageContractError("story", errs, repaired=True, output=out)
    return draft



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
                plan = plan_research(brief, title, log)
                research = run_research(plan, log)
        elif workflow == "idea" and not _web_research_on(s):
            log("research_skipped", "Web research is off; writing from model knowledge and uploads", {})
        if not config.mock():
            try:
                story = (write_from_footage(brief, title, length_min, catalog, log) if workflow == "footage" and catalog
                         else write_from_idea(brief, title, length_min, research, s.get("tone", ""), log, catalog=catalog))
            except StageContractError:
                raise
            except LLMError as exc:
                log("model_call_failed", f"story failed: {exc}", {"step": "story"})
                raise StageContractError("story", [f"model call failed: {exc}"], output=getattr(exc, "output", None)) from exc
        if story is None:
            # Mock / no-model path only.
            story = _fallback_script(brief, length_min, title, research, catalog=catalog)
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
