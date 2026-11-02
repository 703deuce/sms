"""RVM inference params (no Modal import — safe for worker unit tests)."""


def downsample_ratio(w: int, h: int) -> float:
    """Pick RVM downsample_ratio so internal long side sits in ~256-512px (fp32 scalar)."""
    ht = float(h)
    if ht >= 1900:
        return 0.25
    if 1240 <= ht <= 1320:
        return 0.375
    lo = 256.0 / ht
    hi = 512.0 / ht
    return round(max(lo, min(hi, 512.0 / ht)), 4)


WARMUP_OUTPUT_FRAMES = 15
