"""Low-confidence fallbacks when strict pass-2 / selection yields nothing."""
from __future__ import annotations

from clips_worker.picker.scoring import score_clip, _sent_dict


def heuristic_llm_scores(sent_rows: list[dict]) -> dict[str, float]:
    if not sent_rows:
        return {"hook": 5.0, "self_contained": 5.0, "payoff": 5.0, "energy": 5.0, "value": 5.0}
    loud = sum(max(0.0, s["loud_z"]) for s in sent_rows) / len(sent_rows)
    energy = min(9.0, 4.0 + loud)
    questions = sum(s["q"] for s in sent_rows)
    hook = min(8.0, 5.0 + 0.5 * questions)
    payoff = 5.5 if sent_rows[-1]["pause_after"] >= 0.25 else 4.5
    return {
        "hook": hook,
        "self_contained": 6.0,
        "payoff": payoff,
        "energy": energy,
        "value": 5.5,
    }


def pass1_heuristic_candidates(
    moments: list[dict],
    sentences,
    sig_by: dict,
    genre: str,
    source_duration_s: float | None = None,
) -> list[dict]:
    out: list[dict] = []
    for m in moments:
        ss = max(0, min(int(m["start_sentence"]), len(sentences) - 1))
        es = max(ss, min(int(m["end_sentence"]), len(sentences) - 1))
        sent_rows = []
        for k in range(ss, es + 1):
            s = sentences[k]
            sig = sig_by.get(s.idx)
            if sig:
                sent_rows.append(_sent_dict(s, sig))
        if not sent_rows:
            continue
        scores = heuristic_llm_scores(sent_rows)
        scored = score_clip(
            sent_rows,
            f"s{sent_rows[-1]['idx']}",
            scores,
            genre,
            llm_reject=False,
            source_duration_s=source_duration_s,
            relax_ending=True,
        )
        if scored.get("reject"):
            continue
        out.append(
            {
                "start_sentence": ss,
                "end_sentence": es,
                "payoff_id": sent_rows[-1]["idx"],
                "title": (m.get("why") or "Clip moment")[:60],
                "hook": str(m.get("why", ""))[:300],
                "reason": str(m.get("why", ""))[:500],
                "archetype": m.get("archetype") or "story",
                "final": scored["final"],
                "score": scored["score_0_100"],
                "scores": scored["scores"],
                "score_detail": scored["score_detail"],
                "scoring": scored,
                "pass1_why": m.get("why", ""),
                "low_confidence": True,
            }
        )
    out.sort(key=lambda x: -x.get("final", 0))
    return out[:3]


def soft_pass2_fallback(candidates: list[dict]) -> list[dict]:
    """Candidates that survived LLM but not gates/selection, or soft LLM rejects."""
    pool: list[dict] = []
    for c in candidates:
        if c.get("hard_reject"):
            continue
        if c.get("final") is None and c.get("score") is None:
            continue
        row = {**c}
        row["low_confidence"] = True
        pool.append(row)
    pool.sort(key=lambda x: -(x.get("final") or x.get("score", 0) / 10))
    return pool[:3]
