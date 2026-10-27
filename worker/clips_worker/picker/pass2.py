"""Step D: cut + score (pass 2) with ±120s context."""
from __future__ import annotations

import json
import os
from collections import Counter
from typing import Any

from clips_worker.picker.config import genres_config, load_core_rubric, load_examples, load_genre_prompt
from clips_worker.picker.formatting import format_sentence_line
from clips_worker.picker.llm import chat_json
from clips_worker.picker.log_util import json_snippet, picker_info
from clips_worker.picker.rejects import is_hard_llm_reject
from clips_worker.picker.scoring import _sent_dict, score_clip
from clips_worker.picker.fallback import pass1_heuristic_candidates
from clips_worker.picker.titles import SHORT_SOURCE_MAX_MS, strip_internal_sentence_refs, trim_title
from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals

PASS2_SCHEMA = {
    "type": "object",
    "properties": {
        "clips": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start_id": {"type": "integer"},
                    "end_id": {"type": "integer"},
                    "payoff_id": {"type": "integer"},
                    "archetype": {"type": "string"},
                    "scores": {
                        "type": "object",
                        "properties": {
                            "hook": {"type": "number"},
                            "self_contained": {"type": "number"},
                            "payoff": {"type": "number"},
                            "energy": {"type": "number"},
                            "value": {"type": "number"},
                        },
                        "required": ["hook", "self_contained", "payoff", "energy", "value"],
                        "additionalProperties": False,
                    },
                    "reject": {"type": "boolean"},
                    "reject_reason": {"type": "string"},
                    "title": {"type": "string", "maxLength": 60},
                    "why_care": {"type": "string"},
                },
                "required": [
                    "start_id",
                    "end_id",
                    "payoff_id",
                    "archetype",
                    "scores",
                    "reject",
                    "reject_reason",
                    "title",
                    "why_care",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["clips"],
    "additionalProperties": False,
}


def _pass2_batch_schema() -> dict[str, Any]:
    item = json.loads(json.dumps(PASS2_SCHEMA["properties"]["clips"]["items"]))
    item["properties"]["moment_index"] = {"type": "integer"}
    item["required"] = list(item["required"]) + ["moment_index"]
    return {
        "type": "object",
        "properties": {"clips": {"type": "array", "items": item}},
        "required": ["clips"],
        "additionalProperties": False,
    }


def _context_lines(sentences, sig_by, center_lo: int, center_hi: int, ctx_s: float) -> str:
    if not sentences:
        return ""
    t0 = sentences[center_lo].start_ms / 1000.0 - ctx_s
    t1 = sentences[center_hi].end_ms / 1000.0 + ctx_s
    lines = []
    for s in sentences:
        if s.end_ms / 1000.0 < t0 or s.start_ms / 1000.0 > t1:
            continue
        sig = sig_by.get(s.idx)
        if sig:
            lines.append(format_sentence_line(s, sig))
    return "\n".join(lines)


def _pass2_system(genre: str, *, batched: bool = False) -> str:
    ex = load_examples()
    moment_rule = (
        "Return exactly one clip object in clips[] per moment in the user payload; "
        "each clip must include moment_index matching the payload."
        if batched
        else "Return exactly one clip object in clips[] for the single moment in the user payload."
    )
    return "\n\n".join(
        [
            "Return PASS 2 JSON only. Score and tighten each moment; cite sentence ids.",
            moment_rule,
            "title must be <= 60 characters, honest, using the speaker's words; never internal codes like coverage_span.",
            load_core_rubric(),
            load_genre_prompt(genre),
            "FEW-SHOT EXAMPLES:\n" + (ex[:12000] if ex else ""),
        ]
    )


def _clip_row_from_llm(
    row: dict,
    moment: dict,
    sentences: list[Sentence],
    sig_by: dict,
    genre: str,
    source_duration_s: float | None,
) -> dict[str, Any] | None:
    reason = str(row.get("reject_reason") or "")
    hard = bool(row.get("reject")) and is_hard_llm_reject(reason)
    if row.get("reject"):
        return {
            "hard_reject": hard,
            "reject_reason": reason,
            "llm_reject": True,
            "start_sentence": int(moment["start_sentence"]),
            "end_sentence": int(moment["end_sentence"]),
        }
    ss = int(row["start_id"])
    es = int(row["end_id"])
    payoff_id = int(row["payoff_id"])
    ss = max(0, min(ss, len(sentences) - 1))
    es = max(ss, min(es, len(sentences) - 1))
    sc = row["scores"]
    sent_rows = []
    for k in range(ss, es + 1):
        s = sentences[k]
        sig = sig_by.get(s.idx)
        if sig:
            sent_rows.append(_sent_dict(s, sig))
    scored = score_clip(
        sent_rows,
        f"s{payoff_id}",
        {k: float(sc[k]) for k in sc},
        genre,
        teaser=(row.get("archetype") == "teaser"),
        llm_reject=False,
        source_duration_s=source_duration_s,
    )
    base = {
        "start_sentence": ss,
        "end_sentence": es,
        "payoff_id": payoff_id,
        "title": trim_title(str(row.get("title") or moment.get("locator") or "")),
        "hook": strip_internal_sentence_refs(str(row.get("why_care", "")))[:300],
        "reason": strip_internal_sentence_refs(str(row.get("why_care", "")))[:500],
        "archetype": row.get("archetype") or moment.get("archetype"),
        "pass1_why": strip_internal_sentence_refs(str(moment.get("why", ""))),
        "llm_reject": False,
        "hard_reject": False,
        "reject_reason": scored.get("reject_reason") if scored.get("reject") else "",
    }
    if scored.get("reject"):
        base["gate_reject"] = True
        base["final"] = scored.get("final")
        base["score"] = scored.get("score_0_100")
        return base
    base.update(
        {
            "final": scored["final"],
            "score": scored["score_0_100"],
            "scores": scored["scores"],
            "score_detail": scored["score_detail"],
            "scoring": scored,
            "gate_reject": False,
        }
    )
    return base


def _score_moments_batched(
    moments: list[dict],
    sentences: list[Sentence],
    signals: list[SentenceSignals],
    sig_by: dict,
    genre: str,
    source_duration_s: float | None,
    ctx_s: float,
) -> tuple[list[dict], list[dict]]:
    blocks: list[dict] = []
    for mi, m in enumerate(moments):
        ss = max(0, min(int(m["start_sentence"]), len(sentences) - 1))
        es = max(ss, min(int(m["end_sentence"]), len(sentences) - 1))
        blocks.append(
            {
                "moment_index": mi,
                "pass1_why": m.get("why", ""),
                "archetype": m.get("archetype"),
                "approx_start_id": ss,
                "approx_end_id": es,
                "context_transcript": _context_lines(sentences, sig_by, ss, es, ctx_s),
            }
        )
    timeout_s = float(os.environ.get("CLIP_PASS2_BATCH_TIMEOUT_S", "45"))
    data = chat_json(
        _pass2_system(genre, batched=True),
        json.dumps(blocks, indent=0),
        _pass2_batch_schema(),
        "moments_pass2_batch",
        timeout_s=timeout_s,
    )
    picker_info("pass2_batch_raw", moments_in=len(moments), raw=json_snippet(data))
    by_index: dict[int, dict] = {}
    for row in data.get("clips") or []:
        mi = int(row.get("moment_index", -1))
        if mi < 0 or mi >= len(moments):
            continue
        by_index[mi] = row
    out: list[dict] = []
    audit: list[dict] = []
    reject_counts: Counter[str] = Counter()
    for mi, m in enumerate(moments):
        row = by_index.get(mi)
        if not row:
            audit.append(
                {
                    "hard_reject": False,
                    "llm_reject": True,
                    "reject_reason": "missing_batch_row",
                    "start_sentence": m.get("start_sentence"),
                    "end_sentence": m.get("end_sentence"),
                }
            )
            reject_counts["missing_batch_row"] += 1
            continue
        parsed = _clip_row_from_llm(row, m, sentences, sig_by, genre, source_duration_s)
        if not parsed:
            continue
        audit.append(parsed)
        if parsed.get("llm_reject"):
            code = (parsed.get("reject_reason") or "llm_reject").split(":")[0].strip()
            reject_counts[code] += 1
            continue
        if parsed.get("gate_reject"):
            reject_counts[parsed.get("reject_reason") or "gate"] += 1
            continue
        out.append({k: v for k, v in parsed.items() if k not in ("hard_reject", "llm_reject", "gate_reject")})
    picker_info(
        "pass2_batch_done",
        scored=len(out),
        audited=len(audit),
        rejected=dict(reject_counts),
    )
    return out, audit


def score_moments(
    moments: list[dict],
    sentences: list[Sentence],
    signals: list[SentenceSignals],
    genre: str = "podcast",
    source_duration_s: float | None = None,
) -> tuple[list[dict], list[dict]]:
    if not moments:
        return [], []
    ctx_s = float(genres_config().get("pass2_context_seconds", 120))
    sig_by = {s.sentence_idx: s for s in signals}
    if source_duration_s is not None and source_duration_s <= SHORT_SOURCE_MAX_MS / 1000.0:
        picker_info("pass2_batch_start", source_duration_s=source_duration_s, moments_in=len(moments))
        try:
            batched, audit = _score_moments_batched(
                moments, sentences, signals, sig_by, genre, source_duration_s, ctx_s
            )
            if batched:
                return batched, audit
        except Exception as exc:
            picker_info("pass2_batch_failed", error=str(exc)[:240])
        heuristic = pass1_heuristic_candidates(
            moments, sentences, sig_by, genre, source_duration_s=source_duration_s
        )
        picker_info(
            "pass2_batch_heuristic_fallback",
            source_duration_s=source_duration_s,
            moments_in=len(moments),
            scored=len(heuristic),
        )
        return heuristic, []
    out: list[dict] = []
    audit: list[dict] = []
    reject_counts: Counter[str] = Counter()

    picker_info("pass2_start", moments_in=len(moments))

    for mi, m in enumerate(moments):
        ss = max(0, min(int(m["start_sentence"]), len(sentences) - 1))
        es = max(ss, min(int(m["end_sentence"]), len(sentences) - 1))
        block = {
            "moment_index": mi,
            "pass1_why": m.get("why", ""),
            "archetype": m.get("archetype"),
            "approx_start_id": ss,
            "approx_end_id": es,
            "context_transcript": _context_lines(sentences, sig_by, ss, es, ctx_s),
        }
        user = json.dumps([block], indent=0)
        data = chat_json(_pass2_system(genre), user, PASS2_SCHEMA, "moments_pass2")
        picker_info("pass2_raw", moment_index=mi, raw=json_snippet(data))
        clips = data.get("clips") or []
        if not clips:
            reject_counts["empty_clips"] += 1
            audit.append(
                {
                    "hard_reject": False,
                    "llm_reject": True,
                    "reject_reason": "empty_pass2_response",
                    "start_sentence": ss,
                    "end_sentence": es,
                }
            )
            continue
        row = clips[0]
        parsed = _clip_row_from_llm(row, m, sentences, sig_by, genre, source_duration_s)
        if not parsed:
            continue
        audit.append(parsed)
        if parsed.get("llm_reject"):
            code = (parsed.get("reject_reason") or "llm_reject").split(":")[0].strip()
            reject_counts[code] += 1
            continue
        if parsed.get("gate_reject"):
            reject_counts[parsed.get("reject_reason") or "gate"] += 1
            continue
        out.append({k: v for k, v in parsed.items() if k not in ("hard_reject", "llm_reject", "gate_reject")})

    picker_info(
        "pass2_done",
        scored=len(out),
        audited=len(audit),
        rejected=dict(reject_counts),
    )
    return out, audit
