"""Near-live chunk planning (mirrors new-app near-live/chunk-range.ts)."""
from __future__ import annotations

NEAR_LIVE_MIN_CHUNK_MS = 8 * 60 * 1000
NEAR_LIVE_MAX_CHUNK_MS = 20 * 60 * 1000


def plan_near_live_chunk(
    archive_duration_ms: int,
    processed_end_ms: int,
    min_chunk_ms: int = NEAR_LIVE_MIN_CHUNK_MS,
    max_chunk_ms: int = NEAR_LIVE_MAX_CHUNK_MS,
) -> tuple[int, int, int] | None:
    start_ms = max(0, processed_end_ms)
    if archive_duration_ms <= start_ms:
        return None
    available = archive_duration_ms - start_ms
    if available < min_chunk_ms:
        return None
    chunk = min(max_chunk_ms, available)
    end_ms = start_ms + chunk
    return start_ms, end_ms, end_ms
