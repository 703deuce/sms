"""C3 seams: the ONLY module that reads C3 flags. Every function is called inside try/except +
clipfind_fallback at its call site; with flags off each one is a no-op that returns its input unchanged."""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from clips_worker.clipfind.flags import clipfind_fallback, clipfind_flag
from clips_worker.decision_log import decision_log


def _on(name: str) -> bool:
    return clipfind_flag(name)


# ------------------------------------------------------------------ 1. judge v2 (stream text rerank)
def judge_rank_batch(batch, words, signals, *, video_moments=None, chat_messages=None, viewer_clips=None,
                     cue_events=None, range_start_ms: int = 0) -> list[dict] | None:
    """Return legacy llm rows from the IRL judge, or None when CLIPFIND_JUDGE_V2 is off.
    Raises on failure; llm_rank.rank_candidates_batch catches, logs fallback, runs the old prompt."""
    if not _on("CLIPFIND_JUDGE_V2"):
        return None
    from clips_worker.clipfind.c3_markers import viewer_clip_payoff_s
    from clips_worker.clipfind.judge import (JUDGE_BATCH_SCHEMA, JUDGE_SYSTEM_BATCH, format_judge_candidate,
                                             judge_to_llm_row, parse_judge_item)
    from clips_worker.picker.llm import chat_json
    from clips_worker.streamer.signals.chat import STREAMER_CHAT_LAG_S
    from clips_worker.video_picker import absolute_moment_ms

    dur_s = max([int(c["end_ms"]) for c in batch] + [int(float(w.get("e", 0))) * 1000 for w in words[-1:]]) / 1000 + 15
    markers = [float(ev["sec"]) for ev in (cue_events or []) if ev.get("kind") != "viewer_clip"]
    markers += [p for p in (viewer_clip_payoff_s(vc) for vc in (viewer_clips or [])) if p is not None]
    blocks, spans = [], {}
    for c in batch:
        s_s, e_s = int(c["start_ms"]) / 1000, int(c["end_ms"]) / 1000
        notes = []
        for m in video_moments or []:
            t = absolute_moment_ms(m, range_start_ms) / 1000
            if s_s - 30 <= t <= e_s + 15:
                notes.append(f"t={t:.1f}: " + " ".join(str(m.get(k) or "") for k in ("what_happened", "reason", "why_it_works")).strip())
        blocks.append(format_judge_candidate(
            cand_id=str(c["id"]), start_s=s_s, end_s=e_s, words=words, audio=signals.get("audio"),
            chat_messages=chat_messages, visual_notes=notes, payoff_markers=markers,
            note=f"fusion_peak={float(c.get('signal_peak') or 0):.2f} peak_t={int(c.get('peak_ms') or 0) / 1000:.1f}",
            duration_s=dur_s, lag_s=float(STREAMER_CHAT_LAG_S)))
        spans[str(c["id"])] = (max(0.0, s_s - 30), min(dur_s, e_s + 15))
    data = chat_json(JUDGE_SYSTEM_BATCH, "\n\n---\n\n".join(blocks), JUDGE_BATCH_SCHEMA, "stream_judge_v2")
    rows, bad = [], 0
    for item in data.get("candidates") or []:
        lo, hi = spans.get(str(item.get("id")), (None, None))
        j = parse_judge_item(item, lo, hi) if lo is not None else None
        if j is None:
            bad += 1
            continue
        rows.append(judge_to_llm_row(j))
    decision_log("clipfind", "judge_v2_batch", asked=len(batch), parsed=len(rows), invalid=bad)
    if not rows:
        raise RuntimeError("judge_v2 returned no valid rows")
    return rows


def judge_total(llm: dict, total: int, meta_cf: dict) -> int:
    """fusion.py: with a judge row, the judge score IS the total (no loudness blend), when confident."""
    j = (llm or {}).get("_judge")
    if not j:
        return total
    meta_cf["judge"] = {k: j.get(k) for k in ("archetype", "score", "band", "verdict", "risk_flags", "risk_action",
                                              "observation_confidence", "quiet_moment", "standalone_ok", "why",
                                              "setup_start_s", "payoff_s", "reaction_end_s", "hook_s", "prompt_version")}
    meta_cf["judge"]["source"] = "text"
    if float(j.get("observation_confidence") or 0) >= 0.4:
        scaled = int(round(float(j["score"]) * 10))
        cid = str((llm or {}).get("id") or j.get("id") or "")
        risk_demote = j.get("verdict") == "demote" or j.get("risk_action") == "demote"
        if cid.startswith("vp_") and not risk_demote:
            if scaled < total:
                decision_log(
                    "clipfind",
                    "judge_floor_applied",
                    id=cid,
                    judge_score=scaled,
                    old_total=total,
                )
                return max(scaled, total)
        return scaled
    return total


def judge_beats_override(llm: dict | None) -> tuple[int | None, int | None] | None:
    """c2_seams.refine_stream_candidate: judge setup/payoff (ms) replace the video-moment hints."""
    j = (llm or {}).get("_judge")
    if not j or not j.get("event_present") or j.get("setup_start_s") is None:
        return None
    return int(j["setup_start_s"] * 1000), int(j["payoff_s"] * 1000)


# ------------------------------------------------------------------ 2. payoff markers
def rebase_viewer_clips(viewer_clips: list[dict] | None, time_offset_ms: int) -> list[dict] | None:
    """analyze_job: VOD offsets -> analysed-timeline seconds (fixes vod_offset_ms/_s mismatch too)."""
    if not viewer_clips or not _on("CLIPFIND_CHAT_PAYOFF"):
        return viewer_clips
    from clips_worker.clipfind.c3_markers import viewer_clip_start_s

    out = []
    for vc in viewer_clips:
        st = viewer_clip_start_s(vc)
        if st is None:
            continue
        out.append({**{k: v for k, v in vc.items() if k not in ("vod_offset_ms", "startMs")},
                    "vod_offset_s": st - time_offset_ms / 1000.0})
    decision_log("clipfind", "viewer_clips_rebased", n_in=len(viewer_clips), n_out=len(out), offset_ms=time_offset_ms)
    return out


def payoff_markers(cue_events, viewer_cues, viewer_clips, duration_s):
    """rank.py: viewer clips at their payoff second, chat cues tagged payoff."""
    if not _on("CLIPFIND_CHAT_PAYOFF"):
        return cue_events, viewer_cues
    from clips_worker.clipfind.c3_markers import payoff_cue_events, viewer_cue_curve

    ev = payoff_cue_events(cue_events or [], viewer_clips, duration_s)
    vc = viewer_cue_curve(viewer_clips, duration_s) if viewer_clips else viewer_cues
    decision_log("clipfind", "payoff_markers", n=len([e for e in ev if e.get("payoff")]))
    return ev, vc


def refine_cue_picks(picks, *, video_moments, words, signals, raw_channels, duration_s, max_clip_s):
    """fusion.py after _inject_clip_cue_picks: payoff cue picks get C2 look-back (setup) + reaction tail."""
    if not _on("CLIPFIND_CHAT_PAYOFF"):
        return picks
    from clips_worker.clipfind.c2_seams import refine_stream_candidate

    for i, p in enumerate(picks):
        sm = (p.ai_meta or {}).get("streamer") or {}
        if not sm.get("clipCue") or any(r.get("kind") == "streamer_call" for r in sm.get("reasons") or []):
            continue
        cf = p.ai_meta.setdefault("clipfind", {})
        cf["payoff_marker_ms"] = int(p.peak_ms)
        try:
            p.start_ms, p.end_ms = refine_stream_candidate(
                cand={"id": f"cue_{i}", "peak_ms": int(p.peak_ms)}, llm={}, title=p.title, hook=p.hook,
                start_ms=int(p.start_ms), end_ms=int(p.end_ms), video_moments=video_moments, words=words,
                signals=signals, raw_channels=raw_channels, duration_s=duration_s, max_clip_s=max_clip_s,
                meta_cf=cf)
        except Exception as exc:
            clipfind_fallback("cue_refine", type(exc).__name__, exc=exc)
    return picks


# ------------------------------------------------------------------ 3. dense look + re-tier
def _price(model: str):
    from clips_worker.video_picker import estimate_gemini_usd
    return lambda tin, tout: estimate_gemini_usd(tin, tout, model)


def gemini_dense_call(c: dict, *, base: Path, base_absolute: bool, time_offset_ms: int, scratch: Path,
                      words, chat_messages, interval_s: float, model: str) -> tuple[dict | None, float]:
    from clips_worker.clipfind.judge import JUDGE_SYSTEM_DENSE, chat_summary, transcript_lines
    from clips_worker.streamer.signals.chat import STREAMER_CHAT_LAG_S
    from clips_worker.video_picker import (_gemini_post_watch, _labeled_frame_user_parts, estimate_gemini_usd,
                                           make_watch_proxy)

    lo_s, hi_s = c["lo_ms"] / 1000.0, c["hi_ms"] / 1000.0
    off = time_offset_ms / 1000.0 if base_absolute else 0.0
    work = scratch / f"dense_{c['idx']}"
    work.mkdir(parents=True, exist_ok=True)
    proxy = work / "w.mp4"
    make_watch_proxy(base, proxy, lo_s + off, hi_s + off)
    user = "\n".join([
        "TRANSCRIPT:", transcript_lines(words, lo_s, hi_s, rel_to=lo_s),
        "CHAT:", chat_summary(chat_messages, lo_s, hi_s, lag_s=float(STREAMER_CHAT_LAG_S), rel_to=lo_s),
        f"PAYOFF MARKERS: {', '.join(f't={m - lo_s:.1f}' for m in c.get('markers') or [] if lo_s <= m <= hi_s) or '(none)'}",
        f"CANDIDATE NOTE: {c.get('note', '')[:200]}",
        f"FIRST-PASS JUDGEMENT: {json.dumps(c.get('judge') or {})[:600]}",
    ])
    parts = _labeled_frame_user_parts(proxy, work, duration_s=int(hi_s - lo_s), user_text=user,
                                      fps=1.0 / interval_s, part_order="frames_first")
    gen = {"responseMimeType": "application/json", "mediaResolution": "MEDIA_RESOLUTION_LOW", "maxOutputTokens": 2048}
    if "3.8-flash" in model.lower():
        gen["thinkingConfig"] = {"thinkingLevel": "low"}
    payload = {"systemInstruction": {"parts": [{"text": JUDGE_SYSTEM_DENSE}]},
               "contents": [{"role": "user", "parts": parts}], "generationConfig": gen}
    res, err, status = _gemini_post_watch(model, payload, chunk_label=f"dense_{c['idx']}")
    if res is None or not res.ok:
        raise RuntimeError(f"dense_gemini_failed status={status} {str(err)[:120]}")
    data = res.json()
    u = data.get("usageMetadata") or {}
    usd = estimate_gemini_usd(int(u.get("promptTokenCount") or 0), int(u.get("candidatesTokenCount") or 0), model)
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text), usd


def post_rank_stream(picks, *, words, signals_payload, duration_ms, settings, scratch: Path | None,
                     state: dict | None, chat_messages, time_offset_ms: int, cue_events=None) -> tuple[list, float]:
    """analyze_job after rank_moments: dense look (CLIPFIND_DENSE_LOOK) then judge-aware re-tier
    (CLIPFIND_JUDGE_V2 or DENSE_LOOK). Returns (picks, dense_usd). Off => (picks, 0.0) unchanged."""
    dense_on, judge_on = _on("CLIPFIND_DENSE_LOOK"), _on("CLIPFIND_JUDGE_V2")
    if not (dense_on or judge_on):
        return picks, 0.0
    from clips_worker.clipfind import dense as D
    from clips_worker.target_clip_len import resolve_clip_length_policy

    pol = resolve_clip_length_policy(settings)
    spent = 0.0
    if dense_on:
        base = (scratch / "video_picker_base.mp4") if scratch else None
        if not base or not base.is_file():
            decision_log("clipfind", "dense_skipped_no_source")
        else:
            from clips_worker.gemini_vision import discover_video_picker_model

            model = discover_video_picker_model()
            interval = D.dense_frame_interval_s()
            items = [{"tier": (p.ai_meta.get("streamer") or {}).get("tier"),
                      "rank": (p.ai_meta.get("streamer") or {}).get("rankIndex", i)} for i, p in enumerate(picks)]
            cands = []
            for i in D.select_candidates(items):
                cf = picks[i].ai_meta.get("clipfind") or {}
                cands.append({"idx": i, "start_ms": picks[i].start_ms, "end_ms": picks[i].end_ms,
                              "beats": cf.get("beats"), "judge": cf.get("judge"), "note": picks[i].title,
                              "markers": [float(e["sec"]) for e in cue_events or [] if e.get("payoff")]})
            budget = D.Budget(D.budget_cap_usd(duration_ms / 3_600_000))
            base_abs = bool((state or {}).get("localUploadKey") and not (state or {}).get("analysisProxyKey"))
            out = D.run_dense(
                cands, price=_price(model), budget=budget, words=words, min_ms=pol.min_ms, max_ms=pol.max_ms,
                duration_ms=duration_ms, interval_s=interval,
                log=lambda ev, **kw: decision_log("clipfind", ev, **kw),
                call_fn=lambda c: gemini_dense_call(c, base=base, base_absolute=base_abs, time_offset_ms=time_offset_ms,
                                                    scratch=scratch, words=words, chat_messages=chat_messages,
                                                    interval_s=interval, model=model))
            spent = out.spent_usd
            for i, j in out.results.items():
                cf = picks[i].ai_meta.setdefault("clipfind", {})
                cf["judge"] = {**{k: j.get(k) for k in ("archetype", "score", "band", "verdict", "risk_flags",
                                                         "risk_action", "observation_confidence", "quiet_moment",
                                                         "standalone_ok", "why", "hook_s", "prompt_version")},
                               "source": "dense", "window_ms": j["window_ms"]}
                if i in out.bounds:
                    s, e, beats = out.bounds[i]
                    picks[i].start_ms, picks[i].end_ms = s, e
                    cf["beats"] = beats
                    if _on("CLIPFIND_REACTION_TAIL"):
                        cf["reaction_end_ms"] = int(beats["reaction_end_ms"])
                if float(j.get("observation_confidence") or 0) >= 0.4:
                    picks[i].score = int(round(float(j["score"]) * 10))
    items = [{"tier": (p.ai_meta.get("streamer") or {}).get("tier"),
              "judge": (p.ai_meta.get("clipfind") or {}).get("judge")} for p in picks]
    from clips_worker.clipfind.dense import retier
    order = retier(items)
    for p, it in zip(picks, items):
        sm = p.ai_meta.setdefault("streamer", {})
        if sm.get("tier") != it["tier"]:
            decision_log("clipfind", "judge_retier", start_ms=p.start_ms, old=sm.get("tier"), new=it["tier"],
                         reason=it.get("demote_reason") or "promoted")
        sm["tier"], sm["render"] = it["tier"], it["render"]
        if it.get("demote_reason"):
            p.ai_meta.setdefault("clipfind", {})["demote_reason"] = it["demote_reason"]
    return [picks[i] for i in order], spent


# ------------------------------------------------------------------ 4. cost
def log_job_cost(*, broad_usd: float, dense_usd: float, analysed_ms: int, judge_on: bool, t0: float) -> None:
    """Default-ON logging (CLIPFIND_COST_LOG). Never changes picks."""
    if not _on("CLIPFIND_COST_LOG"):
        return
    from clips_worker.stage_log import stage_end

    hours = max(1e-6, analysed_ms / 3_600_000)
    total = round(float(broad_usd or 0) + float(dense_usd or 0), 6)
    kw = dict(broad_usd=round(float(broad_usd or 0), 6), dense_usd=round(float(dense_usd or 0), 6),
              gemini_total_usd=total, usd_per_stream_hour=round(total / hours, 4),
              stream_hours=round(hours, 3), judge_v2=judge_on)
    decision_log("clipfind", "cost", **kw)
    stage_end("clipfind_cost", t0, **kw)


# ------------------------------------------------------------------ 5. eval entry point
def eval_pick_window(media: Path) -> list[dict]:
    """tools/eval_clipfind.py: transcribe + broad video pick + rank + post_rank on one local window file.
    Returns [{"start_s","end_s","tier","score","judge"}] in final order. No DB, no S3, no chat."""
    import subprocess
    import tempfile
    from clips_worker.deepgram_transcribe import transcribe_deepgram
    from clips_worker.gpu.base import TranscribeReq
    from clips_worker.streamer.rank import rank_moments
    from clips_worker.video_picker import format_timestamped_transcript, watch_video_file
    from clips_worker.picker.sentences import build_sentences

    work = Path(tempfile.mkdtemp(prefix="evalcf_"))
    wav = work / "a.wav"
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", str(media), "-ac", "1", "-ar", "16000", str(wav)])
    cache = media.with_suffix(".words.json")
    if cache.is_file():
        words = json.loads(cache.read_text())
    else:
        words = transcribe_deepgram(TranscribeReq(audio_path=str(wav))).words
        cache.write_text(json.dumps(words))
    dur_ms = int(float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                                "-of", "csv=p=0", str(media)]).strip()) * 1000)
    base = work / "video_picker_base.mp4"
    base.write_bytes(media.read_bytes())
    vt = format_timestamped_transcript(build_sentences(words, 0, dur_ms), 0, dur_ms)
    moments, _meta = watch_video_file(base, duration_s=dur_ms // 1000, chunk_label="eval", transcript_text=vt,
                                      scratch=work, skip_edge_reassess=True)
    picks, payload = rank_moments(audio_path=wav, words=words, duration_ms=dur_ms, settings={},
                                  video_moments=moments, transcript_ok=len(words) >= 5)
    picks, _usd = post_rank_stream(picks, words=words, signals_payload=payload, duration_ms=dur_ms, settings={},
                                   scratch=work, state={"localUploadKey": "eval"}, chat_messages=None,
                                   time_offset_ms=0)
    return [{"start_s": p.start_ms / 1000, "end_s": p.end_ms / 1000,
             "tier": (p.ai_meta.get("streamer") or {}).get("tier"), "score": p.score,
             "judge": (p.ai_meta.get("clipfind") or {}).get("judge")} for p in picks]
