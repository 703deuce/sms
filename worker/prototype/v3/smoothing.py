"""Pan smoothing for multiperson crops (critically damped + optional One-Euro)."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class FollowState:
    x: float
    v: float = 0.0


@dataclass
class OneEuroState:
    x: float
    dx: float = 0.0
    initialized: bool = False


def one_euro(
    x: float,
    dt: float,
    st: OneEuroState,
    *,
    min_cutoff: float = 1.0,
    beta: float = 0.007,
    d_cutoff: float = 1.0,
) -> float:
    if not st.initialized:
        st.x = x
        st.initialized = True
        return x
    dx = (x - st.x) / max(dt, 1e-6)
    alpha_d = _alpha(d_cutoff, dt)
    st.dx = alpha_d * dx + (1 - alpha_d) * st.dx
    cutoff = min_cutoff + beta * abs(st.dx)
    alpha = _alpha(cutoff, dt)
    st.x = alpha * x + (1 - alpha) * st.x
    return st.x


def _alpha(cutoff: float, dt: float) -> float:
    tau = 1.0 / (2 * np.pi * cutoff)
    return 1.0 / (1.0 + tau / max(dt, 1e-6))


def follow(
    target_x: float,
    dt: float,
    st: FollowState,
    crop_w: float,
    *,
    frame_w: float | None = None,
    dz: float = 0.18,
    omega: float = 4.0,
    vmax: float = 0.15,
) -> float:
    err = target_x - st.x
    if abs(err) < dz * crop_w / 2:
        target_x = st.x
    a = omega * omega * (target_x - st.x) - 2 * omega * st.v
    st.v += a * dt
    cap = vmax * (frame_w if frame_w is not None else crop_w)
    st.v = max(-cap, min(cap, st.v))
    st.x += st.v * dt
    return st.x


def smooth_centers(
    targets: np.ndarray,
    fps: float,
    frame_w: float,
    *,
    cut_indices: list[int] | None = None,
) -> np.ndarray:
    """EMA + One-Euro + frame-width pan cap; NaN holds previous; snap at hard cuts."""
    out = np.full_like(targets, np.nan, dtype=float)
    st = FollowState(x=float(np.nanmedian(targets[np.isfinite(targets)]) if np.any(np.isfinite(targets)) else 0.0))
    euro = OneEuroState(x=st.x)
    dt = 1.0 / max(fps, 1e-6)
    cuts = set(cut_indices or [])
    prev = st.x
    for i, tgt in enumerate(targets):
        if i in cuts:
            st = FollowState(x=float(tgt) if np.isfinite(tgt) else prev)
            euro = OneEuroState(x=st.x)
        if not np.isfinite(tgt):
            out[i] = prev
            continue
        eased = one_euro(float(tgt), dt, euro)
        prev = follow(eased, dt, st, crop_w=frame_w * 0.45, frame_w=frame_w)
        out[i] = prev
    return out
