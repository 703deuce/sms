"""Step D: cut + score (pass 2) with ±120s context."""
from __future__ import annotations

import json

from clips_worker.picker.config import genres_config, load_core_rubric, load_examples, load_genre_prompt
from clips_worker.picker.formatting import format_sentence_line
from clips_worker.picker.llm import chat_json
from clips_worker.picker.scoring import _sent_dict, score_clip
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
                    "title": {"type": "string"},
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


def _pass2_system(genre: str) -> str:
    ex = load_examples()
    return "\n\n".join(
        [
            "Return PASS 2 JSON only. Score and tighten each moment; cite sentence ids.",
            load_core_rubric(),
            load_genre_prompt(genre),
            "FEW-SHOT EXAMPLES:\n" + (ex[:12000] if ex else ""),
        ]
    )


def score_moments(
    moments: list[dict],
    sentences: list[Sentence],
    signals: list[SentenceSignals],
    genre: str = "podcast",
) -> list[dict]:
    if not moments:
        return []
    ctx_s = float(genres_config().get("pass2_context_seconds", 120))
    sig_by = {s.sentence_idx: s for s in signals}
    out: list[dict] = []
    batch_size = 5
    for batch_start in range(0, len(moments), batch_size):
        batch = moments[batch_start : batch_start + batch_size]
        blocks = []
        for mi, m in enumerate(batch):
            ss = max(0, min(int(m["start_sentence"]), len(sentences) - 1))
            es = max(ss, min(int(m["end_sentence"]), len(sentences) - 1))
            blocks.append(
                {
                    "moment_index": batch_start + mi,
                    "pass1_why": m.get("why", ""),
                    "archetype": m.get("archetype"),
                    "context_transcript": _context_lines(sentences, sig_by, ss, es, ctx_s),
                }
            )
        user = json.dumps(blocks, indent=0)
        data = chat_json(_pass2_system(genre), user, PASS2_SCHEMA, "moments_pass2")
        for row in data.get("clips") or []:
            if row.get("reject"):
                continue
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
                llm_reject=bool(row.get("reject")),
            )
            if scored.get("reject"):
                continue
            out.append(
                {
                    "start_sentence": ss,
                    "end_sentence": es,
                    "payoff_id": payoff_id,
                    "title": str(row.get("title", "Clip"))[:60],
                    "hook": str(row.get("why_care", ""))[:300],
                    "reason": str(row.get("why_care", ""))[:500],
                    "archetype": row.get("archetype") or moments[0].get("archetype"),
                    "final": scored["final"],
                    "score": scored["score_0_100"],
                    "scores": scored["scores"],
                    "score_detail": scored["score_detail"],
                    "scoring": scored,
                    "pass1_why": "",
                }
            )
    return out
