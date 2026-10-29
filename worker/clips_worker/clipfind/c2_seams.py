"""C2 boundary refiner seams — only module that reads C2 behavior flags."""
from __future__ import annotations

from typing import Any, Callable

from clips_worker.clipfind.flags import clipfind_fallback, clipfind_flag
from clips_worker.clipfind.refine import ClipBeats, RefineInputs, fit_max, refine_window, validate_window
from clips_worker.decision_log import decision_log


def _flags() -> dict[str, bool]:
    return {
        k: clipfind_flag(k)
        for k in (
            "CLIPFIND_BEATS_SHADOW",
            "CLIPFIND_SETUP_LOOKBACK",
            "CLIPFIND_REACTION_TAIL",
            "CLIPFIND_VARIANTS",
        )
    }


def _unshift(chat: list[float] | None, lag_s: int) -> list[float] | None:
    if not chat or lag_s <= 0:
        return chat
    return [0.0] * lag_s + list(chat[:-lag_s])


def _vm_span(m: dict) -> tuple[int, int]:
    if m.get("start_ms") is not None and "start_s" not in m:
        return int(m["start_ms"]), int(m.get("end_ms") or m["start_ms"])
    return int(float(m.get("start_s", 0)) * 1000), int(float(m.get("end_s", m.get("start_s", 0))) * 1000)


def _vm_ms(m: dict | None, key: str) -> int | None:
    if not m:
        return None
    if m.get(f"{key}_ms") is not None and f"{key}_s" not in m:
        return int(m[f"{key}_ms"])
    v = m.get(f"{key}_s")
    return int(float(v) * 1000) if v not in (None, "") else None


def _match_vm(cand: dict, vms: list[dict] | None) -> dict | None:
    if not vms:
        return None
    cid = str(cand.get("id") or "")
    if cid.startswith("vp_") and cid[3:].isdigit() and int(cid[3:]) < len(vms):
        return vms[int(cid[3:])]
    pk = int(cand.get("peak_ms") or 0)
    best = None
    for m in vms:
        s, e = _vm_span(m)
        if s - 5000 <= pk <= e + 5000:
            d = abs((_vm_ms(m, "peak") or (s + e) // 2) - pk)
            best = (d, m) if best is None or d < best[0] else best
    return best[1] if best else None


def _judge_override(llm):
    try:
        from clips_worker.clipfind.c3_seams import judge_beats_override

        return judge_beats_override(llm)
    except Exception as exc:
        clipfind_fallback("judge_beats_override", type(exc).__name__, exc=exc)
        return None


def _log(site: str, before: tuple[int, int], r, applied: tuple[int, int]) -> None:
    decision_log(
        "clipfind",
        "beats_shadow",
        site=site,
        before=list(before),
        refined=[r.start_ms, r.end_ms],
        applied=list(applied),
        chosen=r.chosen,
        reason=r.reason,
        beats=r.beats.to_dict() if r.beats else None,
    )


def refine_stream_candidate(
    *,
    cand,
    llm,
    title,
    hook,
    start_ms,
    end_ms,
    video_moments,
    words,
    signals,
    raw_channels,
    duration_s,
    max_clip_s,
    meta_cf,
) -> tuple[int, int]:
    f = _flags()
    if not any(f.values()):
        return start_ms, end_ms
    from clips_worker.streamer.signals.chat import STREAMER_CHAT_LAG_S

    vm = _match_vm(cand, video_moments)
    rc = raw_channels or {}
    text = " ".join(
        str(x or "")
        for x in (
            (vm or {}).get("what_happened"),
            (vm or {}).get("why_it_works"),
            (llm or {}).get("reason"),
            title,
            hook,
        )
    )
    inp = RefineInputs(
        start_ms=start_ms,
        end_ms=end_ms,
        range_start_ms=0,
        range_end_ms=int(duration_s * 1000),
        min_ms=0,
        max_ms=int(max_clip_s * 1000),
        peak_ms=int(cand["peak_ms"]),
        text=text,
        words=words or [],
        energy=rc.get("_raw_reaction") or rc.get("_raw_audio") or signals.get("audio"),
        visual=signals.get("video"),
        chat=_unshift(signals.get("chat"), int(STREAMER_CHAT_LAG_S)),
        gemini_setup_ms=(_jb[0] if (_jb := _judge_override(llm)) else _vm_ms(vm, "start")),
        gemini_payoff_ms=(_jb[1] if _jb else _vm_ms(vm, "peak")),
        pad_lo_ms=start_ms - 30_000,
        pad_hi_ms=end_ms + 15_000,
    )
    r = refine_window(inp)
    ns = r.start_ms if (f["CLIPFIND_SETUP_LOOKBACK"] and r.beats) else start_ms
    ne = r.end_ms if (f["CLIPFIND_REACTION_TAIL"] and r.beats) else end_ms
    if r.beats and (ns, ne) != (start_ms, end_ms):
        ns, ne = fit_max(ns, ne, r.beats, inp.max_ms)
    if f["CLIPFIND_BEATS_SHADOW"]:
        _log("fusion", (start_ms, end_ms), r, (ns, ne))
    if r.beats and (f["CLIPFIND_SETUP_LOOKBACK"] or f["CLIPFIND_REACTION_TAIL"]):
        meta_cf["beats"] = r.beats.to_dict()
        if f["CLIPFIND_REACTION_TAIL"]:
            meta_cf["reaction_end_ms"] = int(r.beats.reaction_end_ms)
    if r.beats and f["CLIPFIND_VARIANTS"]:
        meta_cf["variants"] = r.variants
    return ns, ne


def refine_upload_pick(
    pick: dict,
    *,
    words,
    sentences,
    signals_by_idx,
    visual_moments,
    range_start_ms,
    range_end_ms,
    max_ms,
) -> None:
    f = _flags()
    if not any(f.values()):
        return
    from clips_worker.video_picker import absolute_moment_ms, moment_abs_span_ms
    from clips_worker.visual_boundaries import visual_moments_overlapping_window

    laugh_spans = [
        (sentences[i].start_ms, sentences[i].end_ms)
        for i, s in enumerate(sentences)
        if getattr(signals_by_idx.get(s.idx), "laugh", False)
    ]
    start_ms = int(pick["start_ms"])
    end_ms = int(pick["end_ms"])
    vm = None
    if visual_moments:
        ovs = visual_moments_overlapping_window(
            visual_moments,
            window_start_ms=start_ms,
            window_end_ms=end_ms,
            range_start_ms=range_start_ms,
            pad_ms=5000,
        )
        vm = ovs[0] if ovs else None
    title = str(pick.get("title") or "")
    hook = str(pick.get("hook") or pick.get("pass1_why") or "")
    reason = str(pick.get("reason") or pick.get("pass2_why") or "")
    text = " ".join(
        x
        for x in (
            title,
            hook,
            reason,
            (vm or {}).get("what_happened"),
            (vm or {}).get("why_it_works"),
        )
        if x
    )
    peak_ms = pick.get("boundary_payoff_ms")
    if peak_ms is None and vm is not None:
        peak_ms = absolute_moment_ms(vm, range_start_ms)
    if peak_ms is not None:
        peak_ms = int(peak_ms)
    gemini_setup_ms = None
    gemini_payoff_ms = None
    if vm is not None:
        s_ms, e_ms = moment_abs_span_ms(vm, range_start_ms)
        gemini_setup_ms = s_ms
        gemini_payoff_ms = absolute_moment_ms(vm, range_start_ms) or e_ms
    inp = RefineInputs(
        start_ms=start_ms,
        end_ms=end_ms,
        range_start_ms=range_start_ms,
        range_end_ms=range_end_ms,
        min_ms=15_000,
        max_ms=int(max_ms),
        peak_ms=peak_ms,
        text=text,
        words=words or [],
        laugh_spans=laugh_spans,
        gemini_setup_ms=gemini_setup_ms,
        gemini_payoff_ms=gemini_payoff_ms,
    )
    r = refine_window(inp)
    ns = r.start_ms if (f["CLIPFIND_SETUP_LOOKBACK"] and r.beats) else start_ms
    ne = r.end_ms if (f["CLIPFIND_REACTION_TAIL"] and r.beats) else end_ms
    if r.beats and (ns, ne) != (start_ms, end_ms):
        ns, ne = fit_max(ns, ne, r.beats, inp.max_ms)
    if f["CLIPFIND_BEATS_SHADOW"]:
        _log("finalize", (start_ms, end_ms), r, (ns, ne))
    if r.beats and (f["CLIPFIND_SETUP_LOOKBACK"] or f["CLIPFIND_REACTION_TAIL"]):
        pick["start_ms"] = ns
        pick["end_ms"] = ne
        if f["CLIPFIND_REACTION_TAIL"]:
            pick["clipfind_reaction_end_ms"] = int(r.beats.reaction_end_ms)
        cf = pick.setdefault("aiMeta", {}).setdefault("clipfind", {})
        cf["beats"] = r.beats.to_dict()
    if r.beats and f["CLIPFIND_VARIANTS"]:
        pick.setdefault("aiMeta", {}).setdefault("clipfind", {})["variants"] = r.variants


def _neighbor_overlap(start_ms: int, end_ms: int, picks: list[Any], idx: int, get_bounds) -> bool:
    for j, other in enumerate(picks):
        if j == idx:
            continue
        os, oe = get_bounds(other)
        if max(start_ms, os) < min(end_ms, oe):
            return True
    return False


def validate_frozen(
    picks: list[Any],
    *,
    get_beats: Callable[[Any], dict | None],
    get_bounds: Callable[[Any], tuple[int, int]],
    set_bounds: Callable[[Any, int, int], None],
    demote: Callable[[Any], None],
    max_ms: int,
) -> list[Any]:
    if not clipfind_flag("CLIPFIND_VALIDATE_WINDOW"):
        for pick in picks:
            beats = get_beats(pick)
            if not beats:
                decision_log("clipfind", "validate_window", status="validate_skipped_no_beats")
                continue
            b = ClipBeats(**beats)
            s, e = get_bounds(pick)
            v = validate_window(s, e, b, max_ms)
            decision_log("clipfind", "validate_window", **v)
        return picks
    out = list(picks)
    for i, pick in enumerate(out):
        beats = get_beats(pick)
        if not beats:
            decision_log("clipfind", "validate_window", status="validate_skipped_no_beats")
            continue
        b = ClipBeats(**beats)
        s, e = get_bounds(pick)
        v = validate_window(s, e, b, max_ms)
        decision_log("clipfind", "validate_window", **v)
        if v.get("status") == "repaired":
            rs, re_ = int(v["start_ms"]), int(v["end_ms"])
            if _neighbor_overlap(rs, re_, out, i, get_bounds):
                decision_log("clipfind", "validate_repair_overlap", start_ms=rs, end_ms=re_)
                continue
            set_bounds(pick, rs, re_)
        elif v.get("status") == "demote":
            demote(pick)
    return out


def validate_frozen_stream_picks(picks, settings: dict):
    from clips_worker.target_clip_len import resolve_clip_length_policy

    max_ms = resolve_clip_length_policy(settings).max_ms

    def get_beats(p):
        cf = (p.ai_meta or {}).get("clipfind") if isinstance(p.ai_meta, dict) else None
        return cf.get("beats") if isinstance(cf, dict) else None

    def get_bounds(p):
        return int(p.start_ms), int(p.end_ms)

    def set_bounds(p, s, e):
        p.start_ms, p.end_ms = s, e

    def demote(p):
        cf = p.ai_meta.setdefault("clipfind", {})
        cf["validation"] = "aftermath_only"
        sm = p.ai_meta.setdefault("streamer", {})
        sm["tier"] = "more"
        sm["render"] = False
        from clips_worker.clipfind.ledger import ledger_drop_fusion_pick

        ledger_drop_fusion_pick(p, "validate", "demoted")

    validated = validate_frozen(
        picks,
        get_beats=get_beats,
        get_bounds=get_bounds,
        set_bounds=set_bounds,
        demote=demote,
        max_ms=max_ms,
    )
    primary = [p for p in validated if (p.ai_meta or {}).get("streamer", {}).get("render") is not False]
    demoted = [p for p in validated if p not in primary]
    return primary + demoted


def validate_frozen_upload_picks(picks: list[dict], *, max_ms: int) -> list[dict]:
    def get_beats(p):
        cf = (p.get("aiMeta") or {}).get("clipfind")
        return cf.get("beats") if isinstance(cf, dict) else None

    def get_bounds(p):
        return int(p["start_ms"]), int(p["end_ms"])

    def set_bounds(p, s, e):
        p["start_ms"], p["end_ms"] = s, e

    def demote(p):
        p.setdefault("aiMeta", {}).setdefault("clipfind", {})["validation"] = "aftermath_only"

    validated = validate_frozen(
        picks,
        get_beats=get_beats,
        get_bounds=get_bounds,
        set_bounds=set_bounds,
        demote=demote,
        max_ms=max_ms,
    )
    ok = [p for p in validated if (p.get("aiMeta") or {}).get("clipfind", {}).get("validation") != "aftermath_only"]
    bad = [p for p in validated if p not in ok]
    return ok + bad
