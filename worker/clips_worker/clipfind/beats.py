"""Beat labels for clipfind C2 — heuristic path; dense/Gemini override later (C3)."""
from __future__ import annotations

import os
import re
from dataclasses import asdict, dataclass, field
from typing import Any

from clips_worker.clipfind.flags import clipfind_fallback, clipfind_flag
from clips_worker.decision_log import decision_log

SETUP_LOOKBACK_MAX_S = float(os.environ.get("CLIPFIND_SETUP_LOOKBACK_MAX_S", "30"))
REACTION_TAIL_CAP_S = float(os.environ.get("CLIPFIND_REACTION_TAIL_CAP_S", "15"))

_BADGE_KW = re.compile(
    r"badge|streak|ace|victory|win\s*screen|#\s*1|eliminated|squad\s*wiped|fury",
    re.I,
)
_LAUGH_KW = re.compile(r"laugh|lul|lol|haha", re.I)
_KILL_KW = re.compile(r"kill|elimination|knock|downed|wiped", re.I)
_SCARE_KW = re.compile(r"jumpscare|scare|horror", re.I)


@dataclass
class ClipBeats:
    setup_start_ms: int
    event_ms: int
    payoff_ms: int
    reaction_end_ms: int
    indicator: str
    source: str
    confidence: float
    evidence: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _ms_from_s(val: Any, range_start_ms: int = 0) -> int | None:
    if val is None or val == "":
        return None
    try:
        sec = float(val)
    except (TypeError, ValueError):
        return None
    if sec <= 0:
        return None
    return int(range_start_ms + sec * 1000)


def detect_indicator(
    *,
    what_happened: str = "",
    title: str = "",
    text_blob: str = "",
) -> str:
    blob = " ".join((what_happened, title, text_blob)).strip()
    if not blob:
        return "none"
    if _BADGE_KW.search(blob):
        return "badge"
    if _KILL_KW.search(blob):
        return "kill"
    if _SCARE_KW.search(blob):
        return "scare"
    if _LAUGH_KW.search(blob):
        return "laugh"
    if "?" in blob:
        return "closing_line"
    return "none"


def look_back_from_payoff(
    payoff_ms: int,
    *,
    indicator: str,
    range_start_ms: int,
    visual_curve: list[float] | None = None,
    words: list[dict] | None = None,
    max_s: float | None = None,
) -> int | None:
    """Evidence-backed setup start before payoff (C2 §1)."""
    cap_ms = int((max_s if max_s is not None else SETUP_LOOKBACK_MAX_S) * 1000)
    lo = max(range_start_ms, payoff_ms - cap_ms)
    if indicator in ("badge", "kill", "scare", "victory", "streak"):
        if visual_curve:
            p60 = sorted(visual_curve)[int(len(visual_curve) * 0.6)] if visual_curve else 0.0
            thr = max(p60, 0.35)
            gap_limit_ms = 6000
            t_ms = payoff_ms
            last_active = payoff_ms
            step = 1000
            while t_ms >= lo:
                idx = min(len(visual_curve) - 1, max(0, t_ms // 1000))
                if visual_curve[idx] >= thr:
                    last_active = t_ms
                elif last_active - t_ms > gap_limit_ms:
                    return max(lo, t_ms + gap_limit_ms)
                t_ms -= step
            return max(lo, last_active - 2000)
        return lo
    if indicator == "laugh" and words:
        punch_ms = payoff_ms
        sent_start = punch_ms
        for i in range(len(words) - 1, -1, -1):
            w = words[i]
            e_ms = int(float(w.get("e", 0)) * 1000)
            if e_ms > punch_ms:
                continue
            s_ms = int(float(w.get("s", 0)) * 1000)
            if punch_ms - s_ms > 1500:
                break
            sent_start = s_ms
            if w.get("w", "").endswith((".", "!", "?")):
                break
        return max(lo, sent_start)
    if indicator in ("closing_line", "answer"):
        if words:
            for i in range(len(words) - 1, -1, -1):
                w = words[i]
                e_ms = int(float(w.get("e", 0)) * 1000)
                if e_ms > payoff_ms:
                    continue
                if str(w.get("w", "")).rstrip().endswith("?"):
                    return max(lo, int(float(w.get("s", 0)) * 1000))
                if payoff_ms - int(float(w.get("s", 0)) * 1000) > cap_ms:
                    break
        return lo
    return None


def reaction_end_ms(
    payoff_ms: int,
    *,
    range_end_ms: int,
    audio_energy: list[float] | None = None,
    chat_energy: list[float] | None = None,
    cap_s: float | None = None,
) -> int:
    cap = int((cap_s if cap_s is not None else REACTION_TAIL_CAP_S) * 1000)
    hi = min(range_end_ms, payoff_ms + cap)
    baseline = 0.0
    if audio_energy:
        xs = sorted(audio_energy)
        med = xs[len(xs) // 2]
        mad = xs[min(len(xs) - 1, int(len(xs) * 0.75))] - med
        baseline = med + 0.5 * max(mad, 0.01)
    chat_peak = max(chat_energy) if chat_energy else 0.0
    t = payoff_ms
    calm_since: int | None = None
    while t <= hi:
        idx = min(len(audio_energy or []) - 1, max(0, t // 1000)) if audio_energy else 0
        a = (audio_energy or [baseline])[idx] if audio_energy else baseline
        c_idx = min(len(chat_energy or []) - 1, max(0, t // 1000)) if chat_energy else 0
        c = (chat_energy or [0.0])[c_idx] if chat_energy else 0.0
        calm = a <= baseline and (chat_peak <= 0 or c <= chat_peak * 0.5)
        if calm:
            if calm_since is None:
                calm_since = t
            if t - calm_since >= 1000:
                return t
        else:
            calm_since = None
        t += 250
    return hi


def compute_beats_heuristic(
    *,
    start_ms: int,
    end_ms: int,
    range_start_ms: int = 0,
    range_end_ms: int | None = None,
    gemini_moment: dict | None = None,
    llm_row: dict | None = None,
    words: list[dict] | None = None,
    visual_curve: list[float] | None = None,
    audio_energy: list[float] | None = None,
    chat_energy: list[float] | None = None,
) -> ClipBeats | None:
    try:
        hi = range_end_ms if range_end_ms is not None else end_ms + 120_000
        gm = gemini_moment or {}
        lr = llm_row or {}
        what = str(gm.get("what_happened") or lr.get("what_happened") or "")
        title = str(gm.get("title") or lr.get("title") or "")
        indicator = detect_indicator(what_happened=what, title=title)
        payoff_ms = (
            _ms_from_s(gm.get("peak_s"), range_start_ms)
            or _ms_from_s(lr.get("payoff_end_s"), range_start_ms)
            or _ms_from_s(gm.get("end_s"), range_start_ms)
            or int((start_ms + end_ms) / 2)
        )
        event_ms = _ms_from_s(gm.get("peak_s"), range_start_ms) or payoff_ms
        setup_gemini = _ms_from_s(gm.get("start_s"), range_start_ms) or _ms_from_s(
            lr.get("setup_start_s"), range_start_ms
        )
        look = look_back_from_payoff(
            payoff_ms,
            indicator=indicator,
            range_start_ms=range_start_ms,
            visual_curve=visual_curve,
            words=words,
        )
        if setup_gemini is not None and look is not None:
            setup_start_ms = min(setup_gemini, look)
        elif setup_gemini is not None:
            setup_start_ms = setup_gemini
        elif look is not None:
            setup_start_ms = look
        else:
            setup_start_ms = start_ms
        setup_start_ms = max(range_start_ms, int(setup_start_ms))
        react = reaction_end_ms(
            payoff_ms,
            range_end_ms=hi,
            audio_energy=audio_energy,
            chat_energy=chat_energy,
        )
        conf = 0.55 if indicator != "none" else 0.25
        if setup_gemini is not None:
            conf = max(conf, 0.7)
        return ClipBeats(
            setup_start_ms=int(setup_start_ms),
            event_ms=int(event_ms),
            payoff_ms=int(payoff_ms),
            reaction_end_ms=int(react),
            indicator=indicator if indicator != "none" else "none",
            source="heuristic",
            confidence=conf,
            evidence={"what": what[:120], "setup_gemini": setup_gemini, "look_back": look},
        )
    except Exception as exc:
        clipfind_fallback("compute_beats_heuristic", type(exc).__name__)
        return None


def log_beats_shadow(cf_id: str, beats: ClipBeats | None, *, start_ms: int, end_ms: int) -> None:
    if not clipfind_flag("CLIPFIND_BEATS_SHADOW"):
        return
    try:
        payload: dict[str, Any] = {
            "cf_id": cf_id,
            "start_ms": start_ms,
            "end_ms": end_ms,
        }
        if beats:
            payload["beats"] = beats.to_dict()
        decision_log("clipfind", "beats_shadow", **payload)
    except Exception as exc:
        clipfind_fallback("log_beats_shadow", type(exc).__name__)


def build_variants(
    beats: ClipBeats,
    *,
    start_ms: int,
    end_ms: int,
    range_start_ms: int,
    range_end_ms: int,
    time_offset_ms: int = 0,
) -> dict[str, Any]:
    """Tight / standard / extended variant spans (C2 §3)."""
    if not clipfind_flag("CLIPFIND_VARIANTS"):
        return {}
    try:
        def _shift(ms: int) -> int:
            return ms + int(time_offset_ms)

        tight_s = max(range_start_ms, beats.event_ms - 1000)
        tight_e = min(range_end_ms, beats.payoff_ms + 1000)
        if tight_e - tight_s < 6000:
            tight_e = min(range_end_ms, tight_s + 6000)
        ext_s = max(range_start_ms, beats.setup_start_ms - 10_000)
        ext_e = min(range_end_ms, beats.reaction_end_ms + 8000, ext_s + 90_000)
        return {
            "tight": {"startMs": _shift(tight_s), "endMs": _shift(tight_e), "label": "Tight"},
            "standard": {"startMs": _shift(start_ms), "endMs": _shift(end_ms), "label": "Standard"},
            "extended": {"startMs": _shift(ext_s), "endMs": _shift(ext_e), "label": "Extended"},
            "beats": beats.to_dict(),
            "hookMs": _shift(beats.event_ms),
        }
    except Exception as exc:
        clipfind_fallback("build_variants", type(exc).__name__)
        return {}


def apply_beats_to_bounds(
    start_ms: int,
    end_ms: int,
    beats: ClipBeats | None,
    *,
    range_start_ms: int = 0,
    range_end_ms: int | None = None,
) -> tuple[int, int]:
    """Apply C2 boundary flags; flags off or no beats → unchanged."""
    if beats is None:
        return start_ms, end_ms
    s, e = int(start_ms), int(end_ms)
    hi = range_end_ms if range_end_ms is not None else e + 120_000
    try:
        if clipfind_flag("CLIPFIND_SETUP_LOOKBACK"):
            backed = beats.evidence.get("setup_gemini") is not None or beats.evidence.get("look_back") is not None
            if backed and beats.setup_start_ms < s:
                s = max(range_start_ms, beats.setup_start_ms)
        if clipfind_flag("CLIPFIND_REACTION_TAIL"):
            if beats.reaction_end_ms > e:
                e = min(hi, beats.reaction_end_ms)
        return s, e
    except Exception as exc:
        clipfind_fallback("apply_beats_to_bounds", type(exc).__name__)
        return start_ms, end_ms
