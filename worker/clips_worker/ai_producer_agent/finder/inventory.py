"""Inventory pass — aggregates best_moments across sources into cacheable inventory.json shape."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def run_inventory(*, sources: list[dict], scratch: Path, conn, run_id: str) -> dict[str, Any]:
    from clips_worker.ai_producer_agent.finder.run import CACHE_SCOPE, run_analyze_payload

    fake_job = {"id": f"inv_{run_id}", "payload": {"mode": "best_moments", "sources": sources, "runId": run_id}}
    best = run_analyze_payload(conn, job=fake_job, payload=fake_job["payload"], progress=lambda *_a, **_k: None)
    rows: list[dict] = []
    for m in best.get("moments") or []:
        rows.append(
            {
                "sourceId": m.get("sourceId"),
                "start_s": m.get("start_s"),
                "end_s": m.get("end_s"),
                "peak_s": m.get("peak_s"),
                "beat_type": m.get("category") or "moment",
                "energy": m.get("score"),
                "laugh": "laugh" in str(m.get("category") or "").lower(),
                "reaction": "reaction" in str(m.get("what_happened") or "").lower(),
                "quote": m.get("what_happened"),
                "visual_action": m.get("why_it_works"),
                "topic": m.get("content_type"),
                "callback_candidates": [],
            }
        )
    out_path = scratch / "inventory.json"
    out_path.write_text(json.dumps({"rows": rows, "scope": CACHE_SCOPE}, indent=2), encoding="utf-8")
    return {"inventory": rows, "path": str(out_path), "meta": best.get("meta") or {}}
