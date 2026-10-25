"""Step D: score and tighten moments (pass 2, batched)."""
from __future__ import annotations

from clips_worker.picker.grades import badge_scores, final_score
from clips_worker.picker.llm import chat_json
from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals

SCHEMA = {
    "type": "object",
    "properties": {
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "moment_index": {"type": "integer"},
                    "start_sentence": {"type": "integer"},
                    "end_sentence": {"type": "integer"},
                    "title": {"type": "string"},
                    "hook_line": {"type": "string"},
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
                    "reason": {"type": "string"},
                },
                "required": [
                    "moment_index",
                    "start_sentence",
                    "end_sentence",
                    "title",
                    "hook_line",
                    "scores",
                    "reason",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["results"],
    "additionalProperties": False,
}


def score_moments(
    moments: list[dict],
    sentences: list[Sentence],
    signals: list[SentenceSignals],
) -> list[dict]:
    if not moments:
        return []
    sig_by = {s.sentence_idx: s for s in signals}
    blocks = []
    for mi, m in enumerate(moments):
        ss, es = int(m["start_sentence"]), int(m["end_sentence"])
        ss = max(0, min(ss, len(sentences) - 1))
        es = max(ss, min(es, len(sentences) - 1))
        text = " ".join(sentences[k].text for k in range(ss, es + 1))
        sig_lines = []
        for k in range(ss, es + 1):
            s = sentences[k]
            sig = sig_by.get(s.idx)
            if sig:
                sig_lines.append(
                    f"#{k} loud{sig.rms_z:+.1f} pitch{sig.pitch_z:+.1f} pause_before={sig.pause_before_ms}ms "
                    f"laugh={sig.laugh} overlap={sig.overlap}"
                )
        blocks.append(
            {
                "moment_index": mi,
                "pass1_why": m.get("why", ""),
                "start_sentence": ss,
                "end_sentence": es,
                "text": text,
                "signals": sig_lines,
            }
        )

    system = (
        "Score and tighten each clip moment. You may trim start_sentence/end_sentence for a stronger hook "
        "and to end right after the payoff. Title <= 60 chars, curiosity-driven, no clickbait lies."
    )
    user = json_dumps(blocks)
    data = chat_json(system, user, SCHEMA, "moments_pass2")
    out = []
    for row in data.get("results") or []:
        sc = row["scores"]
        hook, scf, pay, en, val = (
            float(sc["hook"]),
            float(sc["self_contained"]),
            float(sc["payoff"]),
            float(sc["energy"]),
            float(sc["value"]),
        )
        out.append(
            {
                "start_sentence": int(row["start_sentence"]),
                "end_sentence": int(row["end_sentence"]),
                "title": str(row["title"])[:60],
                "hook": str(row["hook_line"])[:300],
                "reason": str(row["reason"])[:500],
                "score": final_score(hook, scf, pay, en, val),
                "scores": badge_scores(hook, scf, pay, en, val),
                "score_detail": sc,
                "pass1_why": moments[int(row["moment_index"])].get("why", "") if int(row["moment_index"]) < len(moments) else "",
            }
        )
    return out


def json_dumps(obj) -> str:
    import json

    return json.dumps(obj, indent=0)
