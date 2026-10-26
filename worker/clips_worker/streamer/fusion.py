"""Signal fusion + peak picking for streamer highlights (S4)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class FusionPick:
    start_ms: int
    end_ms: int
    title: str
    hook: str
    score: int
    scores: dict[str, Any]
    ai_meta: dict[str, Any]
    peak_ms: int


def _smooth(series: list[float], window: int = 5) -> list[float]:
    if not series:
        return []
    half = window // 2
    out: list[float] = []
    for i in range(len(series)):
        lo = max(0, i - half)
        hi = min(len(series), i + half + 1)
        out.append(sum(series[lo:hi]) / (hi - lo))
    return out


def _combined_curve(
    signals: dict[str, list[float] | None],
    weights: dict[str, float],
) -> list[float]:
    active = {k: v for k, v in signals.items() if v}
    if not active:
        return []
    wsum = sum(weights.get(k, 0.0) for k in active)
    if wsum <= 0:
        wsum = float(len(active))
        norm = {k: 1.0 / wsum for k in active}
    else:
        norm = {k: weights.get(k, 0.0) / wsum for k in active}
    n = max(len(v) for v in active.values())
    combined = [0.0] * n
    for k, series in active.items():
        for i, v in enumerate(series):
            combined[i] += norm[k] * v
    return _smooth(combined, 5)


def _local_maxima(curve: list[float], min_sep_s: int, prominence: float) -> list[int]:
    peaks: list[int] = []
    for i in range(1, len(curve) - 1):
        if curve[i] < prominence:
            continue
        if curve[i] >= curve[i - 1] and curve[i] > curve[i + 1]:
            if peaks and (i - peaks[-1]) < min_sep_s:
                if curve[i] > curve[peaks[-1]]:
                    peaks[-1] = i
            else:
                peaks.append(i)
    peaks.sort(key=lambda i: curve[i], reverse=True)
    return peaks


def _iou(a0: int, a1: int, b0: int, b1: int) -> float:
    inter = max(0, min(a1, b1) - max(a0, b0))
    union = max(a1, b1) - min(a0, b0)
    return inter / union if union > 0 else 0.0


def fuse_moments(
    *,
    duration_s: int,
    signals: dict[str, list[float] | None],
    words: list[dict],
    settings: dict,
    chapters: list[dict] | None = None,
    llm_ranker=None,
) -> tuple[list[FusionPick], dict]:
    """Return ranked clip candidates and signals.json payload."""
    weights = (settings.get("signalWeights") or {}) if isinstance(settings, dict) else {}
    default_w = {"audio": 0.35, "chat": 0.30, "viewerClips": 0.25, "transcript": 0.10}
    default_w.update(weights)
    streamer = (settings.get("streamer") or {}) if isinstance(settings, dict) else {}
    clip_count = int(streamer.get("clipCount") or settings.get("clipCount") or 12)
    min_clip_s = int(streamer.get("minClipS") or 15)
    max_clip_s = int(streamer.get("maxClipS") or 60)
    lead_s = int(settings.get("leadS") or 20)
    tail_s = int(settings.get("tailS") or 10)
    llm_blend = float(settings.get("llmBlend") or 0.4)

    curve = _combined_curve(signals, default_w)
    if not curve:
        return [], {"v": 1, "hz": 1, "audio": signals.get("audio"), "transcript": signals.get("transcript"), "chat": None, "viewerClips": None, "chapters": chapters or []}

    peaks = _local_maxima(curve, min_sep_s=min_clip_s, prominence=0.15)[:40]
    candidates: list[dict] = []
    for pi, peak_s in enumerate(peaks):
        start_s = max(0, peak_s - lead_s)
        end_s = min(duration_s, peak_s + tail_s)
        if end_s - start_s < min_clip_s:
            end_s = min(duration_s, start_s + min_clip_s)
        if end_s - start_s > max_clip_s:
            end_s = start_s + max_clip_s
        signal_peak = curve[peak_s] if peak_s < len(curve) else 0.0
        candidates.append(
            {
                "id": f"cand_{pi}",
                "start_ms": int(start_s * 1000),
                "end_ms": int(end_s * 1000),
                "peak_ms": int(peak_s * 1000),
                "signal_peak": signal_peak,
            }
        )

    llm_rows: list[dict] = []
    if llm_ranker and candidates:
        try:
            llm_rows = llm_ranker(candidates, words, signals)
        except Exception:
            llm_rows = []

    by_id = {r.get("id"): r for r in llm_rows if r.get("id")}
    picks: list[FusionPick] = []
    for cand in candidates:
        lid = cand["id"]
        llm = by_id.get(lid) or {}
        if llm.get("keep") is False:
            continue
        signal_score = int(round(cand["signal_peak"] * 100))
        llm_score = int(llm.get("score") or signal_score)
        total = int(round((1 - llm_blend) * signal_score + llm_blend * llm_score))
        reasons = _reasons_for(cand, signals, llm)
        category = llm.get("category") or "other"
        title = (llm.get("title") or f"Moment at {cand['start_ms'] // 1000}s")[:60]
        hook = (llm.get("hook") or title)[:90]
        picks.append(
            FusionPick(
                start_ms=cand["start_ms"],
                end_ms=cand["end_ms"],
                title=title,
                hook=hook,
                score=total,
                scores={
                    "total": total,
                    "audio": _peak_in_window(signals.get("audio"), cand["start_ms"], cand["end_ms"]),
                    "transcript": _peak_in_window(signals.get("transcript"), cand["start_ms"], cand["end_ms"]),
                    "chat": None,
                    "viewerClips": None,
                    "llm": llm_score,
                },
                ai_meta={
                    "streamer": {
                        "reasons": reasons,
                        "category": category,
                        "peakMs": cand["peak_ms"],
                        "signalPeak": cand["signal_peak"],
                    },
                    "hook": hook,
                },
                peak_ms=cand["peak_ms"],
            )
        )

    picks.sort(key=lambda p: p.score, reverse=True)
    deduped: list[FusionPick] = []
    for p in picks:
        if any(_iou(p.start_ms, p.end_ms, d.start_ms, d.end_ms) > 0.3 for d in deduped):
            continue
        deduped.append(p)
        if len(deduped) >= clip_count:
            break

    payload = {
        "v": 1,
        "hz": 1,
        "audio": signals.get("audio"),
        "transcript": signals.get("transcript"),
        "chat": None,
        "viewerClips": None,
        "chapters": chapters or [],
        "combined": curve,
    }
    return deduped, payload


def _peak_in_window(series: list[float] | None, start_ms: int, end_ms: int) -> int | None:
    if not series:
        return None
    lo = max(0, start_ms // 1000)
    hi = min(len(series), end_ms // 1000 + 1)
    if lo >= hi:
        return None
    peak = max(series[lo:hi])
    return int(round(peak * 100)) if peak >= 0.5 else None


def _reasons_for(cand: dict, signals: dict, llm: dict) -> list[dict]:
    reasons: list[dict] = []
    audio = signals.get("audio")
    if audio:
        sec = cand["peak_ms"] // 1000
        if 0 <= sec < len(audio) and audio[sec] >= 0.5:
            z = audio[sec] * 6
            reasons.append({"kind": "audio", "label": "Loudness spike", "value": f"+{z:.1f}σ"})
    transcript = signals.get("transcript")
    if transcript:
        lo = cand["start_ms"] // 1000
        hi = min(len(transcript), cand["end_ms"] // 1000 + 1)
        if hi > lo and max(transcript[lo:hi]) >= 0.5:
            reasons.append({"kind": "transcript", "label": "Hype speech", "value": "high"})
    if llm.get("category"):
        reasons.append({"kind": "llm", "label": str(llm["category"]).replace("_", " ").title(), "value": ""})
    return reasons
