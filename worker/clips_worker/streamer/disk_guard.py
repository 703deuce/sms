"""Refuse new stream pipeline work when worker scratch disk is too full."""
from __future__ import annotations

import os
import shutil
import sys

from clips_worker.streamer.config import DISK_GUARD_PCT, SCRATCH


def ensure_streamer_scratch_dir() -> os.PathLike[str]:
    """Create STREAMER_SCRATCH_DIR before disk_usage or import work (default /tmp/streamer)."""
    SCRATCH.mkdir(parents=True, exist_ok=True)
    return SCRATCH


def scratch_disk_used_pct() -> float:
    try:
        ensure_streamer_scratch_dir()
        usage = shutil.disk_usage(SCRATCH)
    except OSError as exc:
        print(
            f"[clipper:stream] disk_guard scratch_disk_usage_failed path={SCRATCH} err={exc!s}",
            file=sys.stderr,
            flush=True,
        )
        return 0.0
    if usage.total <= 0:
        return 100.0
    return 100.0 * usage.used / usage.total


def disk_guard_blocks_new_stream_work() -> bool:
    pct = scratch_disk_used_pct()
    if pct <= DISK_GUARD_PCT:
        return False
    print(
        f"[clipper:stream] disk_guard_blocked usedPct={pct:.1f} threshold={DISK_GUARD_PCT} "
        f"scratch={SCRATCH}",
        file=sys.stderr,
        flush=True,
    )
    return True
