"""C3 dense look: re-judge the top stream candidates with frames every 2-4 s (never > 1 fps).

Pure orchestration: no flag reads, no network. The Gemini call is injected (c3_seams.gemini_dense_call),
so every branch here is unit-tested with fakes.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from clips_worker.clipfind.judge import JUDGE_PROMPT_VERSION, judge_beats_ms, parse_judge_item
from clips_worker.clipfind.refine import ClipBeats, fit_max, snap_end_to_word, snap_start_to_word

DEFAULT_INTERVAL_S = 1.0
MAX_WINDOW_S = 120.0
PAD_S = 10.0
LOW_TOKENS_PER_FRAME = 66      # Gemini MEDIA_RESOLUTION_LOW
AUDIO_TOKENS_PER_S = 32
OUT_TOKENS_EST = 1500


def _envf(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, "") or default)
    except ValueError:
        return default


def dense_frame_interval_s(raw: str | float | None = None) -> float:
    """CLIPFIND_DENSE_FRAME_INTERVAL_S, default 1.0, clamped to [1, 3] => 0.33-1 fps. The close look is MORE detailed
    than the whole-stream pass (1 frame / 2 s, LOW): denser frames at MEDIUM resolution."""
    if raw is None:
        raw = os.environ.get("CLIPFIND_DENSE_FRAME_INTERVAL_S", "")
    try:
        v = float(raw) if str(raw).strip() else DEFAULT_INTERVAL_S
    except ValueError:
        v = DEFAULT_INTERVAL_S
    return max(1.0, min(3.0, v))


def dense_fps(raw: str | float | None = None) -> float:
    fps = 1.0 / dense_frame_interval_s(raw)
    assert fps <= 1.0, "dense look must never sample above 1 fps"
    return round(fps, 4)


def budget_cap_usd(stream_hours: float) -> float:
    """min(per-job cap, max(floor, per-hour x hours)). Defaults: 0.30/h, floor 0.10, job 0.75."""
    per_h = _envf("CLIPFIND_DENSE_MAX_USD_PER_STREAM_HOUR", 0.30)
    per_job = _envf("CLIPFIND_DENSE_MAX_USD_PER_JOB", 0.75)
    return round(min(per_job, max(0.10, per_h * max(0.0, stream_hours))), 4)


@dataclass
class Budget:
    cap_usd: float
    spent_usd: float = 0.0
    calls: int = 0
    exhausted: bool = False

    def can_spend(self, est_usd: float) -> bool:
        if self.spent_usd + est_usd > self.cap_usd:
            self.exhausted = True
            return False
        return True

    def add(self, usd: float) -> None:
        self.spent_usd = round(self.spent_usd + max(0.0, float(usd or 0)), 6)
        self.calls += 1


def estimate_call_usd(window_s: float, interval_s: float, text_chars: int,
                      price: Callable[[int, int], float]) -> float:
    frames = int(window_s / interval_s) + 1
    tin = frames * LOW_TOKENS_PER_FRAME + int(window_s * AUDIO_TOKENS_PER_S) + text_chars // 4 + 6 * 1024
    return float(price(tin, OUT_TOKENS_EST))


def dense_window(start_ms: int, end_ms: int, duration_ms: int, beats: dict | None = None) -> tuple[int, int]:
    """[min(start, setup) - 10s, max(end, reaction_end) + 10s], <= 120 s (trim the front first), clamped."""
    lo = min(start_ms, int((beats or {}).get("setup_start_ms", start_ms))) - int(PAD_S * 1000)
    hi = max(end_ms, int((beats or {}).get("reaction_end_ms", end_ms))) + int(PAD_S * 1000)
    lo, hi = max(0, lo), min(duration_ms, hi)
    if hi - lo > MAX_WINDOW_S * 1000:
        lo = hi - int(MAX_WINDOW_S * 1000)
    return lo, hi


def select_candidates(items: list[dict], k: int | None = None) -> list[int]:
    """items: [{"tier","rank","id"}] in fusion order. Video-found candidates (id starts with "vp_") go first so
    every on-screen moment gets a frame-by-frame look, then primary, then more, by rank. Default k=30."""
    k = int(k if k is not None else _envf("CLIPFIND_DENSE_MAX_CANDIDATES", 30))
    order = sorted(
        (i for i, it in enumerate(items) if it.get("tier") in ("primary", "more")),
        key=lambda i: (0 if str(items[i].get("id") or "").startswith("vp_") else 1,
                       0 if items[i].get("tier") == "primary" else 1, int(items[i].get("rank") or i)),
    )
    return order[: max(0, k)]


def apply_judgement(j: dict, *, offset_ms: int, words: list[dict], start_ms: int, end_ms: int,
                    min_ms: int, max_ms: int, duration_ms: int) -> tuple[int, int, dict] | None:
    """Judge beats (window-relative) -> word-safe bounds + ClipBeats(source='dense').
    Returns None when there is no usable event (caller keeps the old bounds)."""
    b = judge_beats_ms(j, offset_ms / 1000.0)
    if not b:
        return None
    s = snap_start_to_word(max(0, b["setup"]), words)
    e = snap_end_to_word(min(duration_ms, b["reaction_end"]), words, duration_ms)
    e = max(e, b["payoff"] + 1000)
    if e - s < min_ms:
        e = min(duration_ms, s + min_ms)
        if e - s < min_ms:
            s = max(0, e - min_ms)
    beats = ClipBeats(setup_start_ms=s, event_ms=b["payoff"], payoff_ms=b["payoff"], reaction_end_ms=e,
                      indicator="talk" if j.get("archetype") not in ("gaming_play", "fail") else "action",
                      source="dense", confidence=float(j.get("observation_confidence") or 0),
                      evidence={"archetype": j.get("archetype"), **(j.get("evidence") or {})})
    s, e = fit_max(s, e, beats, max_ms)
    return s, e, beats.to_dict()


@dataclass
class DenseOutcome:
    results: dict[int, dict] = field(default_factory=dict)   # candidate idx -> parsed judgement
    bounds: dict[int, tuple[int, int, dict]] = field(default_factory=dict)
    skipped: list[tuple[int, str]] = field(default_factory=list)
    spent_usd: float = 0.0
    calls: int = 0
    budget_exhausted: bool = False
    time_exhausted: bool = False


def run_dense(cands: list[dict], *, call_fn: Callable[[dict], tuple[dict | None, float]],
              price: Callable[[int, int], float], budget: Budget, words: list[dict],
              min_ms: int, max_ms: int, duration_ms: int, interval_s: float,
              log: Callable[..., None], max_stage_s: float | None = None,
              clock: Callable[[], float] = time.monotonic) -> DenseOutcome:
    """cands: [{"idx","start_ms","end_ms","beats"|None,"text_chars"}]. call_fn(c) -> (raw json, actual usd).
    Never raises; every skip is logged; candidates not judged keep their old path."""
    out = DenseOutcome()
    cap_s = max_stage_s if max_stage_s is not None else _envf("CLIPFIND_DENSE_MAX_STAGE_S", 180)
    t0 = clock()
    for c in cands:
        idx = int(c["idx"])
        if clock() - t0 > cap_s:
            out.time_exhausted = True
            log("dense_time_exhausted", idx=idx, spent_usd=budget.spent_usd)
            break
        lo, hi = dense_window(int(c["start_ms"]), int(c["end_ms"]), duration_ms, c.get("beats"))
        est = estimate_call_usd((hi - lo) / 1000.0, interval_s, int(c.get("text_chars") or 4000), price)
        if not budget.can_spend(est):
            out.budget_exhausted = True
            log("dense_budget_exhausted", idx=idx, spent_usd=budget.spent_usd, cap_usd=budget.cap_usd, est_usd=est)
            break
        try:
            raw, usd = call_fn({**c, "lo_ms": lo, "hi_ms": hi})
        except Exception as exc:  # one bad call never sinks the batch
            out.skipped.append((idx, f"call_error:{type(exc).__name__}"))
            log("dense_call_error", idx=idx, reason=type(exc).__name__)
            continue
        budget.add(usd if usd else est)
        j = parse_judge_item(raw, 0.0, (hi - lo) / 1000.0) if raw else None
        if not j:
            out.skipped.append((idx, "invalid_output"))
            log("dense_invalid_output", idx=idx)
            continue
        j["source"] = "dense"
        j["window_ms"] = [lo, hi]
        out.results[idx] = j
        if j["observation_confidence"] >= 0.5:
            ab = apply_judgement(j, offset_ms=lo, words=words, start_ms=int(c["start_ms"]),
                                 end_ms=int(c["end_ms"]), min_ms=min_ms, max_ms=max_ms, duration_ms=duration_ms)
            if ab:
                out.bounds[idx] = ab
        else:
            log("dense_low_confidence", idx=idx, conf=j["observation_confidence"])
    out.spent_usd, out.calls = budget.spent_usd, budget.calls
    log("dense_summary", calls=out.calls, spent_usd=out.spent_usd, cap_usd=budget.cap_usd,
        judged=len(out.results), applied=len(out.bounds), prompt_version=JUDGE_PROMPT_VERSION)
    return out


def _final_score(it: dict) -> float | None:
    """The dense (frames+audio+transcript+chat) score wins; else the text judge; vp_ items keep a floor of their
    pre-judge score (0-10) unless risk-blocked (gaming floor)."""
    j = it.get("judge") or {}
    sc = j.get("score")
    if sc is None:
        return None
    sc = float(sc)
    if str(it.get("id") or "").startswith("vp_") and it.get("old_score") is not None \
            and j.get("risk_action", "none") != "block":
        sc = max(sc, float(it["old_score"]))
    return sc


def retier(items: list[dict]) -> list[int]:
    """Judge-aware re-tier that NEVER drops and keeps the primary COUNT constant.
    items: [{"tier","judge"|None,"id","old_score"(0-10)|None}] in current order. "judge" is the dense judgement when the
    dense look ran for that item, else the text judgement.
    - risk_action block -> tier more, render False (never primary)
    - verdict demote or risk demote -> not eligible for primary
    - the primary slots go to the eligible primary+more items with the highest final score (_final_score);
      items with no score keep their old relative position after scored ones of the same old tier.
    Mutates each item's "tier"/"render"/"demote_reason"/"final_score"; returns the new order (indices)."""
    n_primary = sum(1 for it in items if it.get("tier") == "primary")
    for it in items:
        j = it.get("judge") or {}
        ra = j.get("risk_action", "none")
        if ra == "block":
            it["demote_reason"] = "risk_block:" + ",".join(j.get("risk_flags") or [])
        elif j.get("verdict") == "demote" or ra == "demote":
            it["demote_reason"] = "judge_demote" if j.get("verdict") == "demote" else "risk:" + ",".join(j.get("risk_flags") or [])
        it["final_score"] = _final_score(it)
    pool = [i for i, it in enumerate(items) if it.get("tier") in ("primary", "more")]
    old_rank = {"primary": 0, "more": 1}

    def key(i: int):
        it = items[i]
        fs = it["final_score"]
        return (1 if it.get("demote_reason") else 0,
                0 if fs is not None else 1,
                -(fs or 0.0),
                old_rank.get(it.get("tier"), 2),
                i)

    ordered = sorted(pool, key=key)
    primary = set(i for i in ordered[:n_primary] if not items[i].get("demote_reason"))
    for i in pool:
        items[i]["tier"] = "primary" if i in primary else "more"
    for it in items:
        it["render"] = it.get("tier") == "primary"
    rest = [i for i in range(len(items)) if i not in pool]
    return [i for i in ordered if i in primary] + [i for i in ordered if i not in primary] + rest
