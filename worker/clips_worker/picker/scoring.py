"""Playbook §7 scoring: gates, weighted base, signal nudge, penalties."""
from __future__ import annotations

from typing import Any

from clips_worker.picker.config import genre_meta, global_config
from clips_worker.picker.grades import badge_scores, letter_grade_from_final


def _sent_dict(s, sig) -> dict[str, Any]:
    pause_b = sig.pause_before_ms / 1000.0
    pause_a = sig.pause_after_ms / 1000.0
    pitch_var = max(0.0, min(1.0, (sig.pitch_z + 2) / 4.0))
    return {
        "id": f"s{s.idx}",
        "idx": s.idx,
        "start": s.start_ms / 1000.0,
        "end": s.end_ms / 1000.0,
        "text": s.text,
        "loud_z": sig.rms_z,
        "pitch_var": pitch_var,
        "pause_before": pause_b,
        "pause_after": pause_a,
        "laugh": int(sig.laugh),
        "xtalk": int(sig.overlap),
        "q": int(sig.question),
        "num_ent": int(sig.has_entity),
    }


def features(sents: list[dict], payoff_id: str) -> tuple[dict[str, float], float, float]:
    g = global_config()
    pen = g.get("penalties") or {}
    t0, t1 = sents[0]["start"], sents[-1]["end"]
    dur = max(0.01, t1 - t0)
    ids = [s["id"] for s in sents]
    if payoff_id not in ids:
        payoff_id = ids[-1]
    p_idx = ids.index(payoff_id)
    p = sents[p_idx]

    laugh_in_landing = 0.0
    for s in sents[p_idx:]:
        if s["laugh"] and (s is p or 0 <= s["start"] - p["end"] <= 4):
            laugh_in_landing = 1.0
            break

    peak_arousal = min(max(max(s["loud_z"] for s in sents), 0), 3) / 3
    hook = [s for s in sents if s["start"] < t0 + 3]
    hook_pitch_var = sum(s["pitch_var"] for s in hook) / max(1, len(hook))

    first = sents[0]["text"].lower().lstrip('"')
    filler = pen.get("filler_open", {}).get("tokens", [])
    dangling = pen.get("dangling_reference_open", {}).get("tokens", [])
    bad_open = any(first.startswith(tok + " ") or first.startswith(tok + ",") for tok in filler + dangling)
    opening_clean = ((1 if sents[0]["pause_before"] >= 0.3 else 0) + (0 if bad_open else 1)) / 2

    last = sents[-1]
    if last["pause_after"] >= 0.4 and not last["q"]:
        ending_clean = 1.0
    elif last["pause_after"] >= 0.2:
        ending_clean = 0.5
    else:
        ending_clean = 0.0

    specificity = min(1.0, 2 * sum(s["num_ent"] for s in sents) / len(sents))
    qs = [i for i, s in enumerate(sents) if s["q"]]
    if not qs:
        qa_contained = 0.5
    else:
        qa_contained = float(all(i < len(sents) - 1 for i in qs))

    xt = sum(s["end"] - s["start"] for s in sents if s["xtalk"]) / dur
    f = {
        "laugh_in_landing": laugh_in_landing,
        "peak_arousal": peak_arousal,
        "hook_pitch_var": hook_pitch_var,
        "opening_clean": opening_clean,
        "ending_clean": ending_clean,
        "specificity": specificity,
        "qa_contained": qa_contained,
    }
    return f, xt, dur


def score_clip(
    sents: list[dict],
    payoff_id: str,
    scores: dict[str, float],
    genre: str,
    platform: str = "tiktok",
    teaser: bool = False,
    llm_reject: bool = False,
) -> dict[str, Any]:
    g = global_config()
    G = genre_meta(genre)
    gates = {**(g.get("hard_gates") or {}), **(G.get("gates") or {})}
    sc_min = float(gates.get("self_contained_min", 5))
    pay_min = float(gates.get("payoff_min", 4))

    if llm_reject:
        return {"reject": True, "reject_reason": "llm_reject"}
    if scores["self_contained"] < sc_min:
        return {"reject": True, "reject_reason": "self_contained below gate"}
    if scores["payoff"] < pay_min and not teaser:
        return {"reject": True, "reject_reason": "payoff below gate"}
    if scores["payoff"] < 4 and not teaser:
        return {"reject": True, "reject_reason": "payoff below global gate"}

    last = sents[-1]
    if last["pause_after"] < 0.2 and last["text"].rstrip()[-1:] not in ".?!":
        return {"reject": True, "reject_reason": "ends mid-thought"}

    f, xt, dur = features(sents, payoff_id)
    weights = G.get("weights") or {}
    base = sum(float(weights.get(k, 0)) * float(scores[k]) for k in weights)
    sw = G.get("signal_weights") or {}
    sig = sum(float(sw.get(k, 0)) * f.get(k, 0) for k in sw)
    lam = float(G.get("lambda", 0.2))
    P = g.get("penalties") or {}
    pen = 0.0
    xt_thr = float((P.get("crosstalk") or {}).get("threshold", 0.15))
    xt_unit = float((P.get("crosstalk") or {}).get("per_unit", 10))
    pen += float(G.get("crosstalk_penalty_multiplier", 1.0)) * max(0.0, xt - xt_thr) * xt_unit

    lengths = (G.get("lengths") or {}).get(platform) or (G.get("lengths") or {}).get("tiktok") or {}
    min_s = float(lengths.get("min_s", 10))
    max_s = float(lengths.get("max_s", 90))
    over = max(0.0, min_s - dur, dur - max_s)
    lor = P.get("length_out_of_range") or {}
    pen += min(float(lor.get("max", 2)), over * float(lor.get("per_second", 0.05)))

    final = max(0.0, min(10.0, 10 * ((1 - lam) * base / 10 + lam * sig) - pen))
    flow = round((scores["self_contained"] + scores["payoff"]) / 2)
    ui = {
        "hook": letter_grade_from_final(scores["hook"]),
        "flow": letter_grade_from_final(flow),
        "value": letter_grade_from_final(scores["value"]),
        "trend": letter_grade_from_final(scores["energy"]),
    }
    return {
        "reject": False,
        "base": round(base, 2),
        "sig": round(sig, 3),
        "features": f,
        "xtalk_ratio": round(xt, 3),
        "duration_s": round(dur, 1),
        "penalty": round(pen, 2),
        "final": round(final, 2),
        "score_0_100": int(round(final * 10)),
        "scores": ui,
        "score_detail": scores,
    }
