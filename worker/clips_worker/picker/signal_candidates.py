"""Audio/scene-scan signal candidates when Gemini video picker is unavailable."""
from __future__ import annotations

from clips_worker.picker.log_util import picker_info
from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals


def _overlap(a0: int, a1: int, b0: int, b1: int) -> bool:
    return max(a0, b0) < min(a1, b1)


def _gaming_genre(genre: str) -> bool:
    g = (genre or "").lower()
    if g == "unified":
        return True
    return "gaming" in g or "stream" in g or "just_chat" in g


def propose_silence_gap_moments(
    sentences: list[Sentence],
    *,
    range_start_ms: int,
    range_end_ms: int,
    min_gap_ms: int = 10_000,
    max_moments: int = 3,
) -> list[dict]:
    """Long dead-air between callouts — typical FPS teamfight stretches."""
    if len(sentences) < 2:
        return []
    out: list[dict] = []
    for i in range(len(sentences) - 1):
        gap_lo = int(sentences[i].end_ms)
        gap_hi = int(sentences[i + 1].start_ms)
        gap = gap_hi - gap_lo
        if gap < min_gap_ms:
            continue
        if gap_lo < range_start_ms or gap_hi > range_end_ms:
            continue
        out.append(
            {
                "start_sentence": i,
                "end_sentence": i + 1,
                "anchor_id": i,
                "archetype": "gameplay_action",
                "locator": (
                    f"Low-speech gap {_fmt_ts(gap_lo)}–{_fmt_ts(gap_hi)} "
                    f"({gap / 1000:.0f}s between lines)"
                ),
                "why": (
                    "Transcript gap may be gunfight/gameplay audio; video picker or pass2 "
                    "should judge visual payoff."
                ),
            }
        )
        if len(out) >= max_moments:
            break
    if out:
        picker_info("signal_gap_candidates", count=len(out), min_gap_ms=min_gap_ms)
    return out


def propose_signal_action_moments(
    sentences: list[Sentence],
    signals: list[SentenceSignals],
    *,
    range_start_ms: int,
    range_end_ms: int,
    genre: str = "",
    max_moments: int = 4,
    min_window_ms: int = 20_000,
    max_window_ms: int = 90_000,
) -> list[dict]:
    """High-energy / sparse-talk windows (gameplay fights, clutch stretches)."""
    if len(sentences) < 4:
        return []
    sig_by = {s.sentence_idx: s for s in signals}
    n = len(sentences)
    scored: list[tuple[float, int, int]] = []

    for i in range(n):
        for j in range(i + 2, min(n, i + 40)):
            lo = sentences[i].start_ms
            hi = sentences[j].end_ms
            span = hi - lo
            if span < min_window_ms or span > max_window_ms:
                continue
            chunk = sentences[i : j + 1]
            rms_vals = [sig_by[s.idx].rms_z for s in chunk if s.idx in sig_by]
            if not rms_vals:
                continue
            mean_rms = sum(rms_vals) / len(rms_vals)
            max_rms = max(rms_vals)
            wps = sum(len(s.text.split()) for s in chunk) / max(1.0, span / 1000.0)
            laughs = sum(1 for s in chunk if sig_by.get(s.idx) and sig_by[s.idx].laugh)
            # Gameplay action: loud bursts + not dense monologue (looser for gaming)
            loud_floor = 0.65 if _gaming_genre(genre) else 0.85
            mean_floor = 0.25 if _gaming_genre(genre) else 0.35
            if max_rms < loud_floor and mean_rms < mean_floor:
                continue
            if wps > 5.5 and max_rms < (1.0 if _gaming_genre(genre) else 1.2):
                continue
            score = max_rms * 2.0 + mean_rms + laughs * 0.5 - min(2.0, wps * 0.25)
            anchor = i + (j - i) // 2
            scored.append((score, i, j, anchor, lo, hi))

    scored.sort(key=lambda t: -t[0])
    out: list[dict] = []
    used_spans: list[tuple[int, int]] = []
    for score, i, j, anchor, lo, hi in scored:
        if len(out) >= max_moments:
            break
        if any(_overlap(lo, hi, u0, u1) for u0, u1 in used_spans):
            continue
        used_spans.append((lo, hi))
        out.append(
            {
                "start_sentence": i,
                "end_sentence": j,
                "anchor_id": anchor,
                "archetype": "gameplay_action",
                "locator": (
                    f"Audio action window {_fmt_ts(lo)}–{_fmt_ts(hi)} "
                    f"(loud_z peak, sparse talk; scene_scan signals)"
                ),
                "why": (
                    f"Signal-driven gameplay/action candidate (mean_loud_z≈{score:.1f}); "
                    "video picker unavailable — pass 2 should judge payoff."
                ),
            }
        )

    if out:
        picker_info("signal_action_candidates", count=len(out), top_score=round(scored[0][0], 2) if scored else 0)
    return out


def _fmt_ts(ms: int) -> str:
    s = ms / 1000.0
    m = int(s // 60)
    sec = s % 60
    return f"{m}:{sec:04.1f}"


def merge_pass1_moments(primary: list[dict], extra: list[dict]) -> list[dict]:
    seen = {(int(m["start_sentence"]), int(m["end_sentence"])) for m in primary}
    merged = list(primary)
    for m in extra:
        key = (int(m["start_sentence"]), int(m["end_sentence"]))
        if key in seen:
            continue
        merged.append(m)
        seen.add(key)
    return merged
