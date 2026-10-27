"""Critically damped pan smoothing for multiperson crops."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class FollowState:
    x: float
    v: float = 0.0


def follow(
    target_x: float,
    dt: float,
    st: FollowState,
    crop_w: float,
    *,
    dz: float = 0.18,
    omega: float = 4.0,
    vmax: float = 0.15,
) -> float:
    err = target_x - st.x
    if abs(err) < dz * crop_w / 2:
        target_x = st.x
    a = omega * omega * (target_x - st.x) - 2 * omega * st.v
    st.v += a * dt
    cap = vmax * crop_w
    st.v = max(-cap, min(cap, st.v))
    st.x += st.v * dt
    return st.x
