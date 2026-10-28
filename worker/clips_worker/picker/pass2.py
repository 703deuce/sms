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
from clips_worker.picker_stats import (
    record_pass2_batch_ok,
    record_pass2_moments_capped,
)
from clips_worker.picker.titles import SHORT_SOURCE_MAX_MS, strip_internal_sentence_refs, trim_title
from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals
from clips_worker.target_clip_len import ClipLengthPolicy
from clips_worker.video_picker import VISUAL_WATCH_PASS2_HINT


def _pass2_clip_item_schema(*, boundary_fields: bool, batched: bool = False) -> dict[str, Any]:
    props: dict[str, Any] = {
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
    }
    required = [
        "start_id",
        "end_id",
        "payoff_id",
        "archetype",
        "scores",
        "reject",
        "reject_reason",
        "title",
        "why_care",
    ]
    if boundary_fields:
        props["setup_start_s"] = {"type": ["number", "null"]}
        props["payoff_end_s"] = {"type": ["number", "null"]}
        required.extend(["setup_start_s", "payoff_end_s"])
    if batched:
        props["moment_index"] = {"type": "integer"}
        required.append("moment_index")
    return {
        "type": "object",
        "properties": props,
        "required": required,
        "additionalProperties": False,
    }


def _pass2_response_schema(*, boundary_fields: bool, batched: bool = False) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {"clips": {"type": "array", "items": _pass2_clip_item_schema(boundary_fields=boundary_fields, batched=batched)}},
        "required": ["clips"],
        "additionalProperties": False,
    }


PASS2_SCHEMA = _pass2_response_schema(boundary_fields=True, batched=False)


def _pass2_batch_schema(*, boundary_fields: bool = True) -> dict[str, Any]:
    return _pass2_response_schema(boundary_fields=boundary_fields, batched=True)


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


def _pass2_system(genre: str, *, batched: bool = False, length_policy: ClipLengthPolicy | None = None) -> str:
    ex = load_examples()
    moment_rule = (
        "Return exactly one clip object in clips[] per moment in the user payload; "
        "each clip must include moment_index matching the payload."
        if batched
        else "Return exactly one clip object in clips[] for the single moment in the user payload."
    )
    length_line = length_policy.pass2_length_hint() if length_policy else ""
    parts = [
            "Return PASS 2 JSON only. Score and tighten each moment; cite sentence ids.",
            moment_rule,
            "For each clip set setup_start_s and payoff_end_s as ABSOLUTE seconds from the start of the "
            "full source video (same time axis as sentence timestamps in the transcript, e.g. 148.6 not 0). "
            "setup_start_s includes lead-in before the hook; payoff_end_s holds through the visual payoff "
            "(kill/reaction/punchline) plus ~1-2s. Values must be within ±30s of the moment anchor. "
            "Use null when unsure. Use visual watch notes when present.",
            "title must be <= 60 characters, honest, using the speaker's words; never internal codes like coverage_span.",
            load_core_rubric(),
            load_genre_prompt(genre),
            "FEW-SHOT EXAMPLES:\n" + (ex[:12000] if ex else ""),
    ]
    if length_line:
        parts.insert(2, length_line)
    return "\n\n".join(parts)


def _clip_row_from_llm(
    row: dict,
    moment: dict,
    sentences: list[Sentence],
    sig_by: dict,
    genre: str,
    source_duration_s: float | None,
    *,
    range_start_ms: int = 0,
    visual_moments: list[dict] | None = None,
    length_policy: ClipLengthPolicy | None = None,
    range_end_ms: int | None = None,
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
        length_min_s=length_policy.scoring_min_s if length_policy else None,
        length_max_s=length_policy.scoring_max_s if length_policy else None,
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
    try:
        from clips_worker.visual_boundaries import (
            boundary_fields_from_llm_row,
            infer_boundaries_from_moments,
            visual_boundaries_enabled,
        )

        if visual_boundaries_enabled():
            anchor_idx = int(moment.get("anchor_id", moment.get("start_sentence", ss)))
            anchor_idx = max(ss, min(anchor_idx, es))
            anchor_ms = int(sentences[anchor_idx].start_ms)
            setup_ms, payoff_ms = boundary_fields_from_llm_row(
                row,
                range_start_ms=range_start_ms,
                anchor_ms=anchor_ms,
                range_end_ms=int(sentences[es].end_ms),
            )
            if setup_ms is None and payoff_ms is None and visual_moments:
                lo = int(sentences[ss].start_ms)
                hi = int(sentences[es].end_ms)
                setup_ms, payoff_ms = infer_boundaries_from_moments(
                    lo, hi, visual_moments, range_start_ms=range_start_ms
                )
            if setup_ms is not None:
                base["boundary_setup_ms"] = setup_ms
            if payoff_ms is not None:
                base["boundary_payoff_ms"] = payoff_ms
    except Exception:
        pass
    if length_policy is not None and range_end_ms is not None:
        base["length_max_ms"] = length_policy.effective_max_duration_ms(base, range_end_ms)
    return base


def _pass1_moment_rank(moment: dict) -> float:
    why = str(moment.get("why") or "").lower()
    ss = int(moment.get("start_sentence", 0))
    es = int(moment.get("end_sentence", ss))
    span = max(1, es - ss + 1)
    rank = float(span)
    if "coverage_span" in why or "fallback" in why:
        rank -= 100.0
    if moment.get("archetype") == "teaser":
        rank += 3.0
    return rank


def _cap_moments_for_batch(moments: list[dict], max_n: int) -> tuple[list[dict], list[dict]]:
    if len(moments) <= max_n:
        return moments, []
    order = sorted(range(len(moments)), key=lambda i: _pass1_moment_rank(moments[i]), reverse=True)
    keep = sorted(order[:max_n])
    tail = [moments[i] for i in order[max_n:]]
    return [moments[i] for i in keep], tail


def _score_moments_batched(
    moments: list[dict],
    sentences: list[Sentence],
    signals: list[SentenceSignals],
    sig_by: dict,
    genre: str,
    source_duration_s: float | None,
    ctx_s: float,
    video_context: str | None = None,
    range_start_ms: int = 0,
    visual_moments: list[dict] | None = None,
    length_policy: ClipLengthPolicy | None = None,
    range_end_ms: int | None = None,
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
    user_body = json.dumps(blocks, indent=0)
    if video_context:
        user_body = (
            f"{VISUAL_WATCH_PASS2_HINT}\n"
            "Set setup_start_s and payoff_end_s per clip (absolute seconds from source start; "
            "match transcript timestamps).\n"
            f"Visual moments (Gemini spans):\n{video_context}\n\n{user_body}"
        )
    data = chat_json(
        _pass2_system(genre, batched=True, length_policy=length_policy),
        user_body,
        _pass2_batch_schema(boundary_fields=True),
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
        parsed = _clip_row_from_llm(
            row,
            m,
            sentences,
            sig_by,
            genre,
            source_duration_s,
            range_start_ms=range_start_ms,
            visual_moments=visual_moments,
            length_policy=length_policy,
            range_end_ms=range_end_ms,
        )
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
    project_id: str | None = None,
    video_context: str | None = None,
    range_start_ms: int = 0,
    visual_moments: list[dict] | None = None,
    length_policy: ClipLengthPolicy | None = None,
    range_end_ms: int | None = None,
) -> tuple[list[dict], list[dict]]:
    if not moments:
        return [], []
    ctx_s = float(genres_config().get("pass2_context_seconds", 120))
    sig_by = {s.sentence_idx: s for s in signals}
    if source_duration_s is not None and source_duration_s <= SHORT_SOURCE_MAX_MS / 1000.0:
        max_n = int(os.environ.get("CLIP_PASS2_BATCH_MAX_MOMENTS", "20"))
        batch_moments, tail_moments = _cap_moments_for_batch(moments, max_n)
        if tail_moments:
            record_pass2_moments_capped(project_id, len(tail_moments))
            picker_info("pass2_batch_capped", kept=len(batch_moments), dropped=len(tail_moments))
        picker_info(
            "pass2_batch_start",
            source_duration_s=source_duration_s,
            moments_in=len(moments),
            batch_moments=len(batch_moments),
        )
        batched, audit = _score_moments_batched(
            batch_moments,
            sentences,
            signals,
            sig_by,
            genre,
            source_duration_s,
            ctx_s,
            video_context=video_context,
            range_start_ms=range_start_ms,
            visual_moments=visual_moments,
            length_policy=length_policy,
            range_end_ms=range_end_ms,
        )
        if tail_moments:
            tail_scored, tail_audit = _score_moments_batched(
                tail_moments,
                sentences,
                signals,
                sig_by,
                genre,
                source_duration_s,
                ctx_s,
                video_context=video_context,
                range_start_ms=range_start_ms,
                visual_moments=visual_moments,
                length_policy=length_policy,
                range_end_ms=range_end_ms,
            )
            batched = batched + tail_scored
            audit = audit + tail_audit
        if not batched:
            from clips_worker.picker.picker_errors import log_picker_error

            log_picker_error("openai", "pass2 batch returned zero scored moments", None)
            raise RuntimeError("pass2 returned no scored moments")
        record_pass2_batch_ok(project_id, len(batched))
        return batched, audit
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
        if video_context:
            user = (
                f"{VISUAL_WATCH_PASS2_HINT}\n"
                f"Visual moments (Gemini spans):\n{video_context}\n\n{user}"
            )
        data = chat_json(
            _pass2_system(genre, length_policy=length_policy),
            user,
            PASS2_SCHEMA,
            "moments_pass2",
        )
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
        parsed = _clip_row_from_llm(
            row,
            m,
            sentences,
            sig_by,
            genre,
            source_duration_s,
            range_start_ms=range_start_ms,
            visual_moments=visual_moments,
            length_policy=length_policy,
            range_end_ms=range_end_ms,
        )
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
