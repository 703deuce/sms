"""Story search mode — text-first, optional re-watch (heuristic)."""

from __future__ import annotations

from pathlib import Path
from typing import Any


def run_story_search(*, sources: list[dict], query: str, scratch: Path) -> dict[str, Any]:
    q = query.strip().lower()
    hits: list[dict] = []
    for src in sources:
        inv = src.get("inventory") or []
        for row in inv if isinstance(inv, list) else []:
            text = " ".join(
                str(row.get(k) or "")
                for k in ("quote", "what_happened", "topic", "match_reason", "beat_type")
            ).lower()
            if q and q not in text:
                continue
            hits.append(
                {
                    "sourceId": src.get("sourceId"),
                    "start_s": row.get("start_s"),
                    "end_s": row.get("end_s"),
                    "beat_type": row.get("beat_type") or "story_beat",
                    "match_reason": row.get("match_reason") or "inventory_match",
                    "confidence": float(row.get("confidence") or 0.5),
                }
            )
    return {"matches": hits[:24], "meta": {"mode": "story_search", "query": query}}
