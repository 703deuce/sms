"""Layout director: Viterbi + post-process for multiperson clipper."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any

import numpy as np

try:
    from scipy.optimize import linear_sum_assignment
except ImportError:  # pragma: no cover
    linear_sum_assignment = None

SWITCH_SEC = float(os.environ.get("DIRECTOR_SWITCH_SEC", "1.5"))
MIN_SHOT_CLOSE = float(os.environ.get("MIN_SHOT_CLOSE", "2.25"))
MIN_SHOT_MULTI = float(os.environ.get("MIN_SHOT_MULTI", "3.0"))
LEAD_SEC = float(os.environ.get("DIRECTOR_LEAD_SEC", "0.4"))
HYST_MARGIN = float(os.environ.get("DIRECTOR_HYST_MARGIN", "0.15"))
HYST_HOLD_SEC = float(os.environ.get("DIRECTOR_HYST_HOLD_SEC", "0.6"))
DIAR_W = float(os.environ.get("DIAR_W", "0.6"))
VIS_W = float(os.environ.get("VIS_W", "0.4"))
BACKCHANNEL_MAX = float(os.environ.get("BACKCHANNEL_MAX", "0.8"))

BACKCHANNEL_RE = re.compile(
    r"^(yeah|right|mhm|uh-?huh|okay|ok|yep|wow|laughter|ha+)$",
    re.I,
)

LAYOUTS = ("close", "two_up", "grid3", "grid4", "wide", "side", "screen_pip")


@dataclass
class StyleConfig:
    name: str
    allow_close: bool = True
    allow_two_up: bool = True
    allow_grid3: bool = True
    allow_grid4: bool = True
    allow_wide: bool = True
    locked_off: bool = False


STYLE_MAP: dict[str, StyleConfig] = {
    "speaker_follow": StyleConfig("speaker_follow", allow_two_up=False, allow_grid3=False, allow_grid4=False),
    "dynamic": StyleConfig("dynamic"),
    "split_debate": StyleConfig("split_debate", allow_grid3=False, allow_grid4=False),
    "grid": StyleConfig("grid", allow_close=False, allow_two_up=False),
    "grid3": StyleConfig("grid3", allow_close=False, allow_two_up=False, allow_grid4=False),
    "grid4": StyleConfig("grid4", allow_close=False, allow_two_up=False, allow_grid3=False),
    "locked_off": StyleConfig("locked_off", locked_off=True),
    "split": StyleConfig("split", allow_close=False, allow_grid3=False, allow_grid4=False),
    "fit": StyleConfig("fit", allow_close=False, allow_two_up=False, allow_grid3=False, allow_grid4=False, allow_wide=True),
    "fill": StyleConfig("fill", allow_close=True, allow_two_up=False, allow_grid3=False, allow_grid4=False),
    "screen_pip": StyleConfig(
        "screen_pip",
        allow_close=False,
        allow_two_up=False,
        allow_grid3=False,
        allow_grid4=False,
        allow_wide=False,
    ),
    "side": StyleConfig("side", allow_close=False, allow_grid3=False, allow_grid4=False),
}


def style_config(name: str) -> StyleConfig:
    return STYLE_MAP.get(name, STYLE_MAP["dynamic"])


def hungarian_map_speakers(M: np.ndarray, min_overlap_s: float = 1.0) -> dict[int, int]:
    """Map diarization speaker index -> person index. -1 if unmapped."""
    if linear_sum_assignment is None or M.size == 0:
        return {}
    n_spk, n_per = M.shape
    if n_spk == 0 or n_per == 0:
        return {}
    r, c = linear_sum_assignment(-M)
    out: dict[int, int] = {}
    for ri, ci in zip(r, c):
        if M[ri, ci] >= min_overlap_s:
            out[int(ri)] = int(ci)
    return out


def combine_speaking_probs(
    diar_prob: np.ndarray,
    visual_prob: np.ndarray,
) -> np.ndarray:
    """Shape (n_persons, n_frames)."""
    if diar_prob.size == 0:
        return visual_prob
    return DIAR_W * diar_prob + VIS_W * visual_prob


def _allowed_states(n_persons: int, style: StyleConfig) -> list[tuple[str, tuple[int, ...]]]:
    states: list[tuple[str, tuple[int, ...]]] = []
    if style.allow_wide:
        states.append(("wide", tuple()))
    if n_persons >= 1 and style.allow_close:
        for p in range(n_persons):
            states.append(("close", (p,)))
    if n_persons >= 2 and style.allow_two_up:
        for i in range(n_persons):
            for j in range(i + 1, n_persons):
                states.append(("two_up", (i, j)))
    if n_persons >= 3 and style.allow_grid3:
        states.append(("grid3", tuple(range(min(3, n_persons)))))
    if n_persons >= 4 and style.allow_grid4:
        states.append(("grid4", tuple(range(min(4, n_persons)))))
    return states or [("wide", tuple())]


def emission_score(
    layout: str,
    slots: tuple[int, ...],
    speak: np.ndarray,
    visible: np.ndarray,
    penalty_off: float = 0.35,
) -> float:
    """Slot-mean cost: lower is better for Viterbi (negated score)."""
    n_per, _ = speak.shape
    if not slots:
        return 0.0 if layout == "wide" else -0.5
    slot_scores = [float(np.nanmean(speak[p])) for p in slots if p < n_per]
    if not slot_scores:
        return -1.0
    mean_active = float(np.mean(slot_scores))
    prior = {"close": 0.0, "two_up": 0.08, "grid3": 0.12, "grid4": 0.15, "wide": 0.2}.get(layout, 0.1)
    off_pen = 0.0
    for p in range(n_per):
        if p in slots:
            continue
        sp = float(np.nanmean(speak[p]))
        if sp > 0.45:
            off_pen += penalty_off * sp
    return mean_active - prior - off_pen


def apply_switch_hysteresis(speak: np.ndarray, fps: float) -> np.ndarray:
    """Dominant speaker per frame; switch only if challenger leads by margin for HYST_HOLD_SEC."""
    n_per, n_frames = speak.shape
    if n_frames == 0:
        return speak
    hold = max(1, int(round(HYST_HOLD_SEC * fps)))
    dominant = np.zeros(n_frames, dtype=np.int32)
    current = int(np.argmax(speak[:, 0]))
    challenger = current
    lead = 0
    for t in range(n_frames):
        order = np.argsort(-speak[:, t])
        top, second = int(order[0]), int(order[1]) if n_per > 1 else top
        if top != current and speak[top, t] - speak[current, t] >= HYST_MARGIN:
            if top == challenger:
                lead += 1
            else:
                challenger = top
                lead = 1
            if lead >= hold:
                current = challenger
                lead = 0
        else:
            challenger = current
            lead = 0
        dominant[t] = current
    out = speak.copy()
    for t in range(n_frames):
        for p in range(n_per):
            if p != dominant[t]:
                out[p, t] *= 0.35
    return out


def viterbi_layouts(
    speak: np.ndarray,
    visible: np.ndarray,
    fps: float,
    style: StyleConfig,
    *,
    cut_frames: set[int] | None = None,
) -> list[tuple[str, tuple[int, ...]]]:
    n_per, n_frames = speak.shape
    states = _allowed_states(n_per, style) if n_per else [("wide", ())]
    switch_cost = SWITCH_SEC * fps
    n_states = len(states)
    if n_frames == 0:
        return []
    emit = np.zeros((n_frames, n_states))
    for t in range(n_frames):
        for si, (lay, slots) in enumerate(states):
            emit[t, si] = emission_score(
                lay,
                slots,
                speak[:, t : t + 1],
                visible[:, t : t + 1],
            )
    dp = np.full((n_frames, n_states), -1e9)
    bp = np.zeros((n_frames, n_states), dtype=np.int32)
    dp[0] = emit[0]
    for t in range(1, n_frames):
        for sj in range(n_states):
            best = -1e18
            bi = 0
            for si in range(n_states):
                free_cut = cut_frames and t in cut_frames
                trans = 0.0 if si == sj or free_cut else -switch_cost
                val = dp[t - 1, si] + trans
                if val > best:
                    best = val
                    bi = si
            dp[t, sj] = best + emit[t, sj]
            bp[t, sj] = bi
    path = [int(np.argmax(dp[-1]))]
    for t in range(n_frames - 1, 0, -1):
        path.append(int(bp[t, path[-1]]))
    path.reverse()
    return [states[s] for s in path]


def is_backchannel_turn(words: list[dict], i0: int, i1: int) -> bool:
    if i1 <= i0:
        return True
    dur = words[i1 - 1]["e"] - words[i0]["s"]
    if dur < BACKCHANNEL_MAX:
        text = " ".join(str(words[k].get("w", "")).strip() for k in range(i0, i1)).strip()
        if BACKCHANNEL_RE.match(text):
            return True
        if dur < 0.5:
            return True
    return False


def merge_short_segments(
    frames: list[tuple[str, tuple[int, ...]]],
    fps: float,
) -> list[tuple[str, tuple[int, ...]]]:
    if not frames:
        return frames
    min_close = int(round(MIN_SHOT_CLOSE * fps))
    min_multi = int(round(MIN_SHOT_MULTI * fps))
    changed = True
    arr = list(frames)
    while changed:
        changed = False
        segs: list[tuple[int, int]] = []
        s = 0
        for j in range(1, len(arr) + 1):
            if j == len(arr) or arr[j] != arr[s]:
                segs.append((s, j))
                s = j
        for idx, (a, b) in enumerate(segs):
            lay = arr[a][0]
            need = min_close if lay == "close" else min_multi if lay in ("two_up", "grid3", "grid4") else min_close
            if b - a < need and len(segs) > 1:
                nb = segs[idx - 1] if idx > 0 else segs[idx + 1]
                arr[a:b] = [arr[nb[0]]] * (b - a)
                changed = True
                break
    return arr


def apply_overlap_rules(
    frames: list[tuple[str, tuple[int, ...]]],
    speak: np.ndarray,
    fps: float,
    style: StyleConfig,
) -> list[tuple[str, tuple[int, ...]]]:
    n_per, n_frames = speak.shape
    win = int(round(6 * fps))
    overlap_win = int(round(1.5 * fps))
    out = list(frames)
    for t in range(n_frames):
        t0 = max(0, t - win)
        active = []
        for p in range(n_per):
            if np.nanmean(speak[p, t0 : t + 1]) > 0.35:
                active.append(p)
        if len(active) >= 2 and style.allow_two_up:
            pair = tuple(sorted(active[:2]))
            # require 3s overlap window
            block = speak[active, max(0, t - int(3 * fps)) : t + 1]
            if block.size and np.mean(block > 0.35) >= 0.5:
                out[t] = ("two_up", pair)
        if len(set(active)) >= 3:
            if style.allow_grid4 and len(active) >= 4:
                out[t] = ("grid4", tuple(active[:4]))
            elif style.allow_grid3:
                out[t] = ("grid3", tuple(active[:3]))
    return out


def frames_to_segments(
    times: np.ndarray,
    frames: list[tuple[str, tuple[int, ...]]],
    words: list[dict] | None,
    fps: float = 30.0,
) -> list[dict[str, Any]]:
    if not frames:
        return []
    segs: list[dict[str, Any]] = []
    s = 0
    for j in range(1, len(frames) + 1):
        if j == len(frames) or frames[j] != frames[s]:
            t0 = float(times[s])
            t1 = float(times[min(j, len(times) - 1)])
            lay, slots = frames[s]
            segs.append(
                {
                    "t0": t0,
                    "t1": t1,
                    "layout": lay,
                    "slots": [f"P{p + 1}" for p in slots],
                }
            )
            s = j
    if words and LEAD_SEC > 0:
        for i in range(1, len(segs)):
            wstart = next((w["s"] for w in words if w["s"] >= segs[i]["t0"]), segs[i]["t0"])
            new_t0 = max(segs[i - 1]["t0"] + 1.0 / max(fps, 1e-6), wstart - LEAD_SEC)
            new_t0 = min(new_t0, segs[i]["t1"] - 1.0 / max(fps, 1e-6))
            segs[i]["t0"] = new_t0
            segs[i - 1]["t1"] = new_t0
    return segs


def run_director(
    times: np.ndarray,
    speak: np.ndarray,
    visible: np.ndarray,
    fps: float,
    style_name: str,
    words: list[dict] | None = None,
    *,
    cut_sample_idx: set[int] | None = None,
) -> list[dict[str, Any]]:
    style = style_config(style_name)
    speak = apply_switch_hysteresis(speak, fps)
    if style.locked_off:
        n_per = speak.shape[0]
        med_x = [0] * max(1, n_per)
        return [
            {
                "t0": float(times[0]),
                "t1": float(times[-1]),
                "layout": "close",
                "slots": ["P1"] if n_per else [],
                "locked_cx": med_x,
            }
        ]
    path = viterbi_layouts(speak, visible, fps, style, cut_frames=cut_sample_idx)
    path = apply_overlap_rules(path, speak, fps, style)
    path = merge_short_segments(path, fps)
    return frames_to_segments(times, path, words, fps)
