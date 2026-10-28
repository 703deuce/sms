"""Shared clip-count targets for regular + stream picker paths."""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from clips_worker.picker.config import selection_settings
from clips_worker.picker.selection import MIN_DISTINCT_SHIPPED, top_up_selected_picks
from clips_worker.streamer.fusion import FusionPick, _iou


def compute_pick_want(settings: dict, duration_ms: int) -> int:
    cfg = selection_settings()
    max_clips = int(cfg.get("max_clips") or 24)
    streamer = (settings.get("streamer") or {}) if isinstance(settings, dict) else {}
    min_clips = int(streamer.get("clipCount") or settings.get("clipCount") or 12)
    want = min(max_clips, max(MIN_DISTINCT_SHIPPED, int(math.ceil(min_clips * 1.5))))
    dur_s = max(1, int(duration_ms // 1000))
    feasible = max(1, dur_s // 15)
    return min(want, feasible)


def log_pick_stage(
    path: str,
    *,
    want: int,
    round_n: int | None = None,
    got: int | None = None,
    after_dedupe: int | None = None,
    after_overlap: int | None = None,
    after_threshold: int | None = None,
    final: int | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    parts = [f"path={path}", f"want={want}"]
    if round_n is not None:
        parts.append(f"round={round_n}")
    if got is not None:
        parts.append(f"got={got}")
    if after_dedupe is not None:
        parts.append(f"after_dedupe={after_dedupe}")
    if after_overlap is not None:
        parts.append(f"after_overlap={after_overlap}")
    if after_threshold is not None:
        parts.append(f"after_threshold={after_threshold}")
    if final is not None:
        parts.append(f"final={final}")
    if extra:
        parts.append(json.dumps(extra, separators=(",", ":")))
    print(f"[clipper:pick] {' '.join(parts)}", flush=True)


def finalize_regular_picks_with_quota(
    selected: list[dict],
    pool: list[dict],
    *,
    settings: dict,
    source_duration_ms: int,
) -> list[dict]:
    want = compute_pick_want(settings, source_duration_ms)
    after_overlap = len(selected)
    topped = top_up_selected_picks(selected, pool, min_n=want)
    if len(topped) < want and pool:
        seen = {(_int_ms(p, "start_ms"), _int_ms(p, "end_ms")) for p in topped}
        for row in sorted(pool, key=lambda p: -float(p.get("final", p.get("score", 0) or 0))):
            if len(topped) >= want:
                break
            key = (_int_ms(row, "start_ms"), _int_ms(row, "end_ms"))
            if key in seen:
                continue
            seen.add(key)
            topped.append(row)
    log_pick_stage(
        "regular",
        want=want,
        after_overlap=after_overlap,
        after_threshold=len(topped),
        final=len(topped),
    )
    return topped[:want]


def _int_ms(p: dict, key: str) -> int:
    try:
        return int(p.get(key) or 0)
    except (TypeError, ValueError):
        return 0


def _fusion_from_candidate(row: dict, *, tier: str = "backfill") -> FusionPick:
    start_ms = int(row.get("startMs") or row.get("start_ms") or 0)
    end_ms = int(row.get("endMs") or row.get("end_ms") or start_ms + 30_000)
    peak_ms = int(row.get("peakMs") or row.get("peak_ms") or (start_ms + end_ms) // 2)
    title = str(row.get("title") or f"Moment {start_ms // 1000}s")[:60]
    score = int(row.get("score") or 50)
    return FusionPick(
        start_ms=start_ms,
        end_ms=end_ms,
        title=title,
        hook=title,
        score=score,
        scores={"total": score},
        ai_meta={
            "streamer": {
                "tier": tier,
                "render": True,
                "reasons": [{"kind": "backfill", "label": "Signal backfill", "value": ""}],
                "category": "other",
                "peakMs": peak_ms,
            }
        },
        peak_ms=peak_ms,
    )


def _backfill_stream_picks(
    out: list[FusionPick],
    *,
    want: int,
    duration_ms: int,
    signals_payload: dict | None,
    words: list[dict] | None,
    audio_path: str | Path | None,
) -> list[FusionPick]:
    cands = list((signals_payload or {}).get("candidates") or [])
    cands.sort(key=lambda c: -int(c.get("score") or 0))
    for row in cands:
        if len(out) >= want:
            break
        fp = _fusion_from_candidate(row)
        if any(_iou(fp.start_ms, fp.end_ms, p.start_ms, p.end_ms) > 0.3 for p in out):
            continue
        out.append(fp)

    audio_ok = bool(audio_path) and Path(str(audio_path)).is_file()
    if not audio_ok and len(out) < want:
        print(
            f"[clipper:pick] backfill_skip_audio reason="
            f"{'missing_path' if not audio_path else 'file_missing'}",
            flush=True,
        )

    if len(out) < want and words:
        from clips_worker.streamer.signals import transcript_signal_per_second
        from clips_worker.picker.fallback import pass1_heuristic_candidates
        from clips_worker.picker.sentences import build_sentences

        dur_s = max(1, duration_ms // 1000)
        sents = build_sentences(words, 0, duration_ms)
        if sents:
            sig_by: dict = {}
            if audio_ok:
                from clips_worker.picker.signals import compute_signals

                sigs = compute_signals(sents, str(audio_path), sents)
                sig_by = {s.sentence_idx: s for s in sigs}
            transcript_signal_per_second(words, dur_s)
            step = max(1, dur_s // max(want, 6))
            moments = []
            for i in range(0, dur_s, step):
                ss = max(0, min(len(sents) - 1, i * len(sents) // max(1, dur_s)))
                es = min(len(sents) - 1, ss + 2)
                moments.append(
                    {
                        "start_sentence": ss,
                        "end_sentence": es,
                        "why": f"Transcript moment ~{i}s",
                        "archetype": "story",
                    }
                )
            genre = "gaming"
            back = pass1_heuristic_candidates(moments, sents, sig_by, genre, float(dur_s))
            for row in back:
                if len(out) >= want:
                    break
                sm = int(sents[row["start_sentence"]].start_ms)
                em = int(sents[row["end_sentence"]].end_ms)
                fp = FusionPick(
                    start_ms=sm,
                    end_ms=em,
                    title=str(row.get("title") or "Clip")[:60],
                    hook=str(row.get("hook") or "")[:90],
                    score=int(row.get("score") or 55),
                    scores={"total": int(row.get("score") or 55)},
                    ai_meta={
                        "streamer": {
                            "tier": "backfill",
                            "render": True,
                            "reasons": [{"kind": "transcript", "label": "Transcript backfill", "value": ""}],
                            "category": "other",
                            "peakMs": (sm + em) // 2,
                        }
                    },
                    peak_ms=(sm + em) // 2,
                )
                if any(_iou(fp.start_ms, fp.end_ms, p.start_ms, p.end_ms) > 0.5 for p in out):
                    continue
                out.append(fp)
    return out


def ensure_stream_picks(
    picks: list[FusionPick],
    *,
    want: int,
    duration_ms: int,
    signals_payload: dict | None,
    words: list[dict] | None = None,
    audio_path: str | Path | None = None,
) -> list[FusionPick]:
    """Backfill after dedupe; keep top `want` with render=True. Never raises."""
    out = list(picks)
    try:
        out = _backfill_stream_picks(
            out,
            want=want,
            duration_ms=duration_ms,
            signals_payload=signals_payload,
            words=words,
            audio_path=audio_path,
        )
    except Exception as exc:
        print(f"[clipper:pick] backfill_error={str(exc)[:240]}", flush=True)

    out.sort(key=lambda p: p.score, reverse=True)
    final: list[FusionPick] = []
    for i, p in enumerate(out):
        if len(final) >= want:
            break
        sm = dict((p.ai_meta or {}).get("streamer") or {})
        sm["render"] = True
        sm["tier"] = sm.get("tier") if sm.get("tier") in ("primary", "more", "backfill") else "primary"
        sm["rankIndex"] = i
        p.ai_meta = {**(p.ai_meta or {}), "streamer": sm}
        final.append(p)
    return final
