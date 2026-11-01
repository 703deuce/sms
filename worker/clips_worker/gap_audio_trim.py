"""RMS-aware gap shortening (mirrors new-app/lib/clips/gap-audio-trim.ts)."""
from __future__ import annotations

import math

SAMPLE_MS = 25
GAP_QUIET_MIN_LINEAR = 10 ** (-40 / 20)


def _merge_intervals(intervals: list[tuple[int, int]]) -> list[tuple[int, int]]:
    if not intervals:
        return []
    sorted_i = sorted(intervals)
    out = [sorted_i[0]]
    for lo, hi in sorted_i[1:]:
        last_lo, last_hi = out[-1]
        if lo <= last_hi + 1:
            out[-1] = (last_lo, max(last_hi, hi))
        else:
            out.append((lo, hi))
    return out


def gap_noise_floor_linear(samples: list[tuple[int, float]]) -> float:
    if not samples:
        return GAP_QUIET_MIN_LINEAR
    vals = sorted(v for _, v in samples)
    idx = min(len(vals) - 1, max(0, int(len(vals) * 0.1)))
    return max(GAP_QUIET_MIN_LINEAR / 4, vals[idx])


def gap_quiet_threshold_linear(noise_floor: float) -> float:
    nf_db = 20 * math.log10(max(noise_floor, 1e-9))
    thr_db = max(nf_db + 6, -40)
    return 10 ** (thr_db / 20)


def rms_samples_from_peaks(peaks: list[float], peaks_per_sec: float) -> list[tuple[int, float]]:
    if not peaks or peaks_per_sec <= 0:
        return []
    step = max(1, round((peaks_per_sec * SAMPLE_MS) / 1000))
    out: list[tuple[int, float]] = []
    for i in range(0, len(peaks), step):
        peak = max(peaks[i : min(len(peaks), i + step)])
        out.append((int((i / peaks_per_sec) * 1000), peak))
    return out


def gap_has_loud_program_audio(gap_start_ms: int, gap_end_ms: int, rms_samples: list[tuple[int, float]] | None) -> bool:
    if not rms_samples:
        return False
    samples = [(t, r) for t, r in rms_samples if gap_start_ms <= t <= gap_end_ms]
    if not samples:
        return False
    thr = gap_quiet_threshold_linear(gap_noise_floor_linear(samples))
    loud_ms = 0
    for _, r in samples:
        if r > thr:
            loud_ms += SAMPLE_MS
    if loud_ms > 150:
        return True
    vals = sorted(r for _, r in samples)
    median = vals[len(vals) // 2]
    return median > GAP_QUIET_MIN_LINEAR * 2


def _quiet_intervals(gap_start_ms: int, gap_end_ms: int, rms_samples: list[tuple[int, float]]) -> list[tuple[int, int]]:
    samples = [(t, r) for t, r in rms_samples if gap_start_ms <= t <= gap_end_ms]
    if not samples:
        return [(gap_start_ms, gap_end_ms)]
    thr = gap_quiet_threshold_linear(gap_noise_floor_linear(samples))
    quiet: list[tuple[int, int]] = []
    for t, r in samples:
        if r <= thr:
            lo = max(gap_start_ms, int(t - SAMPLE_MS / 2))
            hi = min(gap_end_ms, int(t + SAMPLE_MS / 2))
            if hi > lo:
                quiet.append((lo, hi))
    return _merge_intervals(quiet)


def _pick_quiet_cut(quiet: list[tuple[int, int]], remove_ms: int, gap_mid: float) -> list[int] | None:
    if remove_ms <= 40 or not quiet:
        return None
    best = None
    best_dist = 1e18
    for lo, hi in quiet:
        length = hi - lo
        if length < remove_ms + 20:
            continue
        mid = lo + length / 2
        cut_lo = max(lo, int(mid - remove_ms / 2))
        cut_hi = min(hi, int(mid + remove_ms / 2))
        if cut_hi - cut_lo < 40:
            continue
        dist = abs(mid - gap_mid)
        if dist < best_dist:
            best_dist = dist
            best = [cut_lo, cut_hi]
    return best


def gap_shorten_cut_range_with_audio(
    gap_start_ms: int,
    gap_end_ms: int,
    gap_ms: int,
    target_gap_ms: int,
    rms_samples: list[tuple[int, float]] | None,
) -> list[int] | None:
    if gap_ms <= target_gap_ms + 50:
        return None
    if rms_samples is None:
        return None
    if not rms_samples:
        return None
    if gap_has_loud_program_audio(gap_start_ms, gap_end_ms, rms_samples):
        return None
    quiet = _quiet_intervals(gap_start_ms, gap_end_ms, rms_samples)
    quiet_ms = sum(hi - lo for lo, hi in quiet)
    loud_ms = max(0, gap_ms - quiet_ms)
    need_remove = gap_ms - target_gap_ms
    max_remove = min(need_remove, quiet_ms - max(0, target_gap_ms - loud_ms))
    if max_remove <= 50:
        return None
    mid = gap_start_ms + gap_ms / 2
    raw = _pick_quiet_cut(quiet, int(max_remove), mid)
    return raw
