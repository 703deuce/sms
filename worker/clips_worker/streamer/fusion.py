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


def _peak_params(duration_s: int, min_clip_s: int, clip_count: int) -> tuple[int, float]:
    """Looser peak picking on short VODs so fusion still returns several candidates."""
    target = max(4, min(clip_count, duration_s // max(12, min_clip_s // 2)))
    min_sep = max(6, min(min_clip_s, duration_s // max(target + 1, 3)))
    if duration_s < 300:
        prominence = 0.06
    elif duration_s < 900:
        prominence = 0.10
    else:
        prominence = 0.15
    return min_sep, prominence


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
    cue_events: list[dict] | None = None,
) -> tuple[list[FusionPick], dict]:
    """Return ranked clip candidates and signals.json payload."""
    weights = (settings.get("signalWeights") or {}) if isinstance(settings, dict) else {}
    default_w = {
        "audio": 0.25,
        "chat": 0.20,
        "viewerClips": 0.15,
        "transcript": 0.08,
        "clipCues": 0.32,
    }
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

    min_sep, prominence = _peak_params(duration_s, min_clip_s, clip_count)
    peaks = _local_maxima(curve, min_sep_s=min_sep, prominence=prominence)[: max(40, clip_count * 3)]
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
                    "chat": _peak_in_window(signals.get("chat"), cand["start_ms"], cand["end_ms"]),
                    "viewerClips": _peak_in_window(signals.get("viewerClips"), cand["start_ms"], cand["end_ms"]),
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

    if cue_events:
        deduped = _inject_clip_cue_picks(
            deduped,
            cue_events,
            duration_s=duration_s,
            min_clip_s=min_clip_s,
            max_clip_s=max_clip_s,
            lead_s=lead_s,
            tail_s=tail_s,
            clip_count=clip_count,
        )

    payload = {
        "v": 1,
        "hz": 1,
        "audio": signals.get("audio"),
        "transcript": signals.get("transcript"),
        "chat": signals.get("chat"),
        "viewerClips": signals.get("viewerClips"),
        "chapters": chapters or [],
        "combined": curve,
        "clipCues": signals.get("clipCues"),
    }
    return deduped, payload


def _inject_clip_cue_picks(
    picks: list[FusionPick],
    cue_events: list[dict],
    *,
    duration_s: int,
    min_clip_s: int,
    max_clip_s: int,
    lead_s: int,
    tail_s: int,
    clip_count: int,
) -> list[FusionPick]:
    """Guarantee clip-call moments survive cutoff (unless duplicate IoU)."""
    out = list(picks)
    for ev in cue_events:
        sec = int(ev.get("sec", 0))
        kind = str(ev.get("kind") or "")
        start_ms = max(0, (sec - lead_s) * 1000)
        end_ms = min(duration_s * 1000, (sec + tail_s) * 1000)
        if end_ms - start_ms < min_clip_s * 1000:
            end_ms = min(duration_s * 1000, start_ms + min_clip_s * 1000)
        label, chip_kind = {
            "streamer_call": ("Streamer called it", "streamer_call"),
            "chat_call": ("Chat called it", "chat_call"),
            "viewer_clip": ("Viewer clipped", "viewer_clip"),
        }.get(kind, ("Clip cue", "clip_cue"))
        candidate = FusionPick(
            start_ms=start_ms,
            end_ms=end_ms,
            title=label,
            hook=label,
            score=98,
            scores={"total": 98, "clipCues": 98, "audio": None, "transcript": None, "chat": None, "viewerClips": None, "llm": None},
            ai_meta={
                "streamer": {
                    "reasons": [{"kind": chip_kind, "label": label, "value": ""}],
                    "category": "reaction",
                    "peakMs": sec * 1000,
                    "signalPeak": float(ev.get("weight", 1.0)),
                    "clipCue": True,
                }
            },
            peak_ms=sec * 1000,
        )
        if any(_iou(candidate.start_ms, candidate.end_ms, d.start_ms, d.end_ms) > 0.5 for d in out):
            continue
        out.insert(0, candidate)
    out.sort(key=lambda p: p.score, reverse=True)
    return out[: max(clip_count, len([e for e in cue_events]))]


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
    chat = signals.get("chat")
    if chat:
        sec = cand["peak_ms"] // 1000
        if 0 <= sec < len(chat) and chat[sec] >= 0.5:
            ratio = max(2.0, chat[sec] * 8)
            reasons.append({"kind": "chat", "label": "Chat spike", "value": f"Chat {ratio:.0f}× baseline"})
    viewer = signals.get("viewerClips")
    if viewer:
        lo = cand["start_ms"] // 1000
        hi = min(len(viewer), cand["end_ms"] // 1000 + 1)
        if hi > lo and max(viewer[lo:hi]) >= 0.5:
            reasons.append({"kind": "viewer_clip", "label": "Viewer clips", "value": "overlap"})
    if llm.get("category"):
        reasons.append({"kind": "llm", "label": str(llm["category"]).replace("_", " ").title(), "value": ""})
    cues = signals.get("clipCues")
    if cues:
        lo = cand["start_ms"] // 1000
        hi = min(len(cues), cand["end_ms"] // 1000 + 1)
        if hi > lo and max(cues[lo:hi]) >= 0.5:
            reasons.append({"kind": "streamer_call", "label": "Streamer called it", "value": ""})
    return reasons
