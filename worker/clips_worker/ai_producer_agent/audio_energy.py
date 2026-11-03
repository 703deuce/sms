"""Audio energy analysis for AI Producer Agent."""

from __future__ import annotations

from typing import Any


def get_audio_energy(*, storage_key: str, range_ms: tuple[int, int], hop_ms: int = 10) -> dict[str, Any]:
    del storage_key, range_ms, hop_ms
    return {"rmsDb": [], "valleys": [], "bursts": [], "silences": []}
