"""clips_worker/clipfind/refine.py — clipfind C2 boundary refiner: pure functions, no I/O, no flag reads (seams read flags)."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any

LOOKBACK_MAX_MS = 30_000      # CLIPFIND_SETUP_LOOKBACK_MAX_S
TAIL_CAP_MS = 15_000          # CLIPFIND_REACTION_TAIL_CAP_S
ACTION_GAP_MS = 6_000         # gap allowed inside one connected action sequence
TALK_PAUSE_MS = 1_500         # pause that ends a speaker run / topic
ACTION_LEAD_MS = 2_000        # lead-in before first active second
SCARE_LEAD_MS = 12_000        # horror: the quiet approach is the setup
CHAT_LAG_MS = 6_000           # == STREAMER_CHAT_LAG_S (signals/chat.py)

_ACTION = re.compile(r"\b(badges?|streaks?|aces?|victory|win screen|wins?|#1|squad wiped|wipe[sd]?|eliminat\w*|kills?|clutch|1v\d|multi-?kill|knock(ed)?|downed|fury)\b", re.I)
_SCARE = re.compile(r"\b(jump ?scare|scared?|horror|spooked)\b", re.I)
_LAUGH = re.compile(r"\b(laugh\w*|lul|kekw|joke|jokes|deadpan|sarcas\w*|punchline|roast\w*)\b", re.I)
_TALK = re.compile(r"\b(answers?|explains?|reveals?|story|argument|closing|why|confess\w*|hot take|question)\b", re.I)


@dataclass
class RefineInputs:
    start_ms: int
    end_ms: int
    range_start_ms: int
    range_end_ms: int
    min_ms: int
    max_ms: int
    peak_ms: int | None = None
    text: str = ""                                   # what_happened + title + hook
    words: list[dict] = field(default_factory=list)  # {"w","s","e"} seconds, absolute timeline
    energy: list[float] | None = None                # 1 Hz, index = second on the same timeline
    visual: list[float] | None = None                # 1 Hz
    chat: list[float] | None = None                  # 1 Hz, UNSHIFTED (event-time + lag)
    laugh_spans: list[tuple[int, int]] = field(default_factory=list)  # uploads: laugh sentences (ms)
    gemini_setup_ms: int | None = None
    gemini_payoff_ms: int | None = None
    pad_lo_ms: int | None = None                     # hard clamp (saved padding); default range
    pad_hi_ms: int | None = None


@dataclass
class ClipBeats:
    setup_start_ms: int
    event_ms: int
    payoff_ms: int
    reaction_end_ms: int
    indicator: str               # action|scare|laugh|talk|none
    source: str = "heuristic"
    confidence: float = 0.0
    evidence: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RefineResult:
    start_ms: int
    end_ms: int
    beats: ClipBeats | None
    variants: dict[str, dict[str, int | str]]
    chosen: str                  # "unchanged" | variant/cut name
    reason: str


def detect_indicator(text: str) -> str:
    t = text or ""
    if _SCARE.search(t):
        return "scare"
    if _ACTION.search(t):
        return "action"
    if _LAUGH.search(t):
        return "laugh"
    if _TALK.search(t):
        return "talk"
    return "none"


def _at(curve: list[float] | None, ms: int) -> float | None:
    if not curve:
        return None
    i = int(ms // 1000)
    return float(curve[i]) if 0 <= i < len(curve) else None


def _pct(xs: list[float], q: float) -> float:
    s = sorted(xs)
    return s[min(len(s) - 1, max(0, int(q * (len(s) - 1))))]


def _sentences(words: list[dict]) -> list[tuple[int, int, str]]:
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        gap = (nxt["s"] - w["e"]) * 1000 if nxt else 1e9
        if str(w["w"]).rstrip().endswith((".", "?", "!")) or gap >= TALK_PAUSE_MS:
            out.append((int(cur[0]["s"] * 1000), int(cur[-1]["e"] * 1000), " ".join(x["w"] for x in cur)))
            cur = []
    return out


def snap_start_to_word(ms: int, words: list[dict]) -> int:
    """Never start mid-word: move to the start of the word containing ms."""
    for w in words:
        s, e = int(w["s"] * 1000), int(w["e"] * 1000)
        if s <= ms < e:
            return s
    return ms


def snap_end_to_word(ms: int, words: list[dict], limit_ms: int) -> int:
    """Never end mid-word: if ms is inside a word, run to the next word end that is
    followed by a >=300ms gap (within +1.5s). In silence, keep ms."""
    hi = min(limit_ms, ms + 1500)
    for i, w in enumerate(words):
        s, e = int(w["s"] * 1000), int(w["e"] * 1000)
        if e < ms:
            continue
        if s >= ms:
            break
        j = i
        while j + 1 < len(words) and words[j + 1]["s"] - words[j]["e"] < 0.3 and words[j + 1]["e"] * 1000 <= hi:
            j += 1
        return min(limit_ms, int(words[j]["e"] * 1000))
    return min(limit_ms, ms)


def look_back_action(payoff_ms: int, curve: list[float], lo_ms: int) -> int | None:
    thr = _pct(curve, 0.60)
    if (_at(curve, payoff_ms) or 0) < thr and (_at(curve, payoff_ms - 1000) or 0) < thr:
        return None
    first_active, t = payoff_ms, payoff_ms
    while t >= lo_ms:
        v = _at(curve, t)
        if v is not None and v > thr:
            first_active = t
        elif first_active - t > ACTION_GAP_MS:
            break
        t -= 1000
    return max(lo_ms, (first_active // 1000) * 1000 - ACTION_LEAD_MS)


def look_back_talk(payoff_ms: int, words: list[dict], lo_ms: int, want_question: bool) -> int | None:
    sents = [s for s in _sentences(words) if s[0] < payoff_ms and s[1] >= lo_ms]
    if not sents:
        return None
    if want_question:
        for s0, s1, txt in reversed(sents):
            if txt.rstrip().endswith("?") and s0 >= lo_ms:
                return s0
    # speaker run / topic start: walk back while the pause between sentences < 1.5s
    start = sents[-1][0]
    for j in range(len(sents) - 1, 0, -1):
        if sents[j][0] - sents[j - 1][1] >= TALK_PAUSE_MS or sents[j - 1][0] < lo_ms:
            break
        start = sents[j - 1][0]
    return start


def chat_onset_ms(chat: list[float] | None, payoff_ms: int, lo_ms: int) -> int | None:
    if not chat:
        return None
    hi = min(len(chat) - 1, payoff_ms // 1000 + 15)
    win = chat[max(0, lo_ms // 1000): hi + 1]
    if not win or max(win) <= 0:
        return None
    peak = max(win)
    base = _pct(chat, 0.5)
    if peak <= base * 2:
        return None
    for i in range(max(0, lo_ms // 1000), hi + 1):
        if chat[i] >= 0.5 * peak:
            return i * 1000 - CHAT_LAG_MS     # event time ~ onset - lag
    return None


def reaction_end(inp: RefineInputs, payoff_ms: int, hi_ms: int) -> tuple[int, str]:
    cap = min(hi_ms, payoff_ms + TAIL_CAP_MS)
    if inp.laugh_spans:                                 # uploads: laugh sentences after the payoff
        end, src = payoff_ms, "laugh_span"
        for s, e in sorted(inp.laugh_spans):
            if s <= end + 1500 and e > end:
                end = e
        if end > payoff_ms:
            return min(cap, end), src
    if inp.energy:
        xs = list(inp.energy)
        med = _pct(xs, 0.5)
        mad = _pct([abs(x - med) for x in xs], 0.5)
        base = med + 0.5 * mad
        chat_peak = max((inp.chat or [0])[payoff_ms // 1000: cap // 1000 + 1] or [0])
        calm_since, t = None, payoff_ms
        while t <= cap:
            a = _at(inp.energy, t)
            c = _at(inp.chat, t) or 0.0
            calm = (a is None or a <= base) and (chat_peak <= 0 or c < 0.5 * chat_peak)
            if calm:
                calm_since = t if calm_since is None else calm_since
                if t - calm_since >= 1000:
                    return calm_since, "energy_chat_decay"
            else:
                calm_since = None
            t += 250
        return cap, "cap"
    return min(cap, payoff_ms + 1500), "default_1500"


def _complete(start: int, end: int, b: ClipBeats) -> int:
    s = 0
    s += 3 if start <= b.event_ms <= end else 0
    s += 3 if start <= b.payoff_ms + 1000 <= end else 0
    s += 2 if start <= b.setup_start_ms else 0
    s += 1 if end >= b.reaction_end_ms else 0
    return s


def fit_max(start: int, end: int, b: ClipBeats, max_ms: int) -> tuple[int, int]:
    """Over max: trim setup first (not past event-3s), then aftermath (not before payoff+1s)."""
    if end - start <= max_ms:
        return start, end
    start = min(max(start, end - max_ms), max(start, b.event_ms - 3000))
    if end - start > max_ms:
        end = max(start + max_ms, min(end, b.payoff_ms + 1000))
    if end - start > max_ms:                            # event..payoff alone > max: keep payoff
        start = end - max_ms
    return start, end


def refine_window(inp: RefineInputs) -> RefineResult:
    s0, e0 = int(inp.start_ms), int(inp.end_ms)
    unchanged = RefineResult(s0, e0, None, {"standard": {"startMs": s0, "endMs": e0, "label": "Standard"}}, "unchanged", "")
    lo = inp.range_start_ms if inp.pad_lo_ms is None else max(inp.range_start_ms, inp.pad_lo_ms)
    hi = inp.range_end_ms if inp.pad_hi_ms is None else min(inp.range_end_ms, inp.pad_hi_ms)
    indicator = detect_indicator(inp.text)
    if (indicator == "none" and inp.gemini_payoff_ms is not None and inp.visual
            and (_at(inp.visual, inp.gemini_payoff_ms) or 0) > _pct(inp.visual, 0.80)):
        indicator = "action"                             # Gemini-picked + visual curve high = evidence
    if indicator == "none" and inp.gemini_setup_ms is None:
        unchanged.reason = "no_indicator"                # loud false alarm: never inflate
        return unchanged
    payoff = inp.gemini_payoff_ms if inp.gemini_payoff_ms is not None else inp.peak_ms
    if payoff is None or not (s0 - LOOKBACK_MAX_MS <= payoff <= e0 + (15_000 if inp.gemini_payoff_ms is not None else 5000)):
        payoff = (s0 + e0) // 2
    if inp.laugh_spans and indicator == "laugh":     # uploads: payoff = punchline before first laugh
        first = min((s for s, _ in inp.laugh_spans if s >= s0 - 5000), default=None)
        if first is not None:
            payoff = min(payoff, first)
    lb_lo = max(lo, payoff - LOOKBACK_MAX_MS)
    ev: dict[str, Any] = {"indicator": indicator}
    setup = None
    if indicator == "action":
        curve = inp.visual or inp.energy
        setup = look_back_action(payoff, curve, lb_lo) if curve else None
        ev["action_curve"] = "visual" if inp.visual else ("energy" if inp.energy else None)
    elif indicator == "scare":
        setup = max(lb_lo, payoff - SCARE_LEAD_MS)
    elif indicator in ("laugh", "talk") and inp.words:
        setup = look_back_talk(payoff, inp.words, lb_lo, want_question=(indicator == "talk"))
    onset = chat_onset_ms(inp.chat, payoff, lb_lo)
    ev["chat_onset_ms"] = onset
    if setup is not None and onset is not None and lb_lo <= onset < setup:
        setup = onset
    if inp.gemini_setup_ms is not None and lb_lo <= inp.gemini_setup_ms:
        setup = inp.gemini_setup_ms if setup is None else min(setup, inp.gemini_setup_ms)
    ev["look_back_ms"] = setup
    if setup is None:
        unchanged.reason = "no_setup_evidence"
        return unchanged
    setup = snap_start_to_word(max(lb_lo, setup), inp.words)
    event = payoff if indicator in ("laugh", "talk") else max(setup, min(payoff, (onset or payoff)))
    rend, rsrc = reaction_end(inp, payoff, hi)
    if indicator == "none":                              # Gemini-backed but no indicator: no tail inflation
        rend = min(rend, max(e0, payoff + 1500))
    rend = snap_end_to_word(rend, inp.words, hi)
    ev["reaction_src"] = rsrc
    b = ClipBeats(setup, event, payoff, rend, indicator, confidence=0.7 if inp.gemini_setup_ms is not None else 0.55, evidence=ev)
    cuts = {
        "full": (setup, max(rend, min(e0, rend + 3000))),
        "short_tail": (setup, min(rend, payoff + 2000)),
        "short_setup": (max(setup, event - 8000), rend),
    }
    best, best_key = None, None
    for name, (cs, ce) in cuts.items():
        cs, ce = fit_max(max(lo, cs), min(hi, ce), b, inp.max_ms)
        key = (_complete(cs, ce, b), ce - cs if ce - cs <= inp.max_ms else -1)
        if ce > cs and (best_key is None or key > best_key):
            best, best_key = (name, cs, ce), key
    name, cs, ce = best
    # C2.1 never shrink: the refiner only moves the start EARLIER (setup) and the end LATER
    # (reaction). It may only cut below the original window when over max, via fit_max.
    cs, ce = fit_max(min(cs, s0), max(ce, e0), b, inp.max_ms)
    if not (cs <= (inp.peak_ms if inp.peak_ms is not None else payoff) <= ce):
        unchanged.reason = "refined_drops_peak"
        return unchanged
    tight_s = max(lo, event - 1000)
    tight_e = min(hi, max(payoff + 1500, tight_s + 6000))
    ext_s = max(lo, setup - 10_000)
    ext_e = min(hi, rend + 8000, ext_s + 90_000)
    variants = {
        "tight": {"startMs": tight_s, "endMs": tight_e, "label": "Tight"},
        "standard": {"startMs": cs, "endMs": ce, "label": "Standard"},
        "extended": {"startMs": ext_s, "endMs": ext_e, "label": "Extended"},
    }
    return RefineResult(cs, ce, b, variants, name, "ok")


def validate_window(start_ms: int, end_ms: int, b: ClipBeats | None, max_ms: int) -> dict[str, Any]:
    if b is None:
        return {"status": "skipped_no_beats"}
    m = 300
    after_only = start_ms > b.event_ms or start_ms >= b.payoff_ms - 1000
    ok = (start_ms + m <= b.event_ms <= end_ms - m) and (start_ms + m <= b.payoff_ms <= end_ms - m) and not after_only
    if ok:
        return {"status": "ok"}
    rs, re_ = fit_max(min(start_ms, b.event_ms - 2000, b.setup_start_ms), max(end_ms, b.payoff_ms + 1000), b, max_ms)
    if rs + m <= b.event_ms and b.payoff_ms <= re_ - m:
        return {"status": "repaired", "start_ms": rs, "end_ms": re_, "aftermath_only": after_only}
    return {"status": "demote", "aftermath_only": after_only}
