"""Self-review on rendered preview (rulebook §14)."""

from __future__ import annotations

from typing import Any


def review(p: dict[str, Any]) -> dict[str, Any]:
    edl = p.get("edl") or {}
    joins = []
    trim = edl.get("trim") or {}
    if "in" in trim:
        joins.append(int(trim["in"]))
    if "out" in trim:
        joins.append(int(trim["out"]))
    for row in edl.get("cutRanges") or []:
        if isinstance(row, (list, tuple)) and len(row) == 2:
            joins.extend([int(row[0]), int(row[1])])
    words = p.get("words") or []
    issues: list[dict[str, Any]] = []
    for t in joins:
        for w in words:
            s = int(float(w.get("s", 0)) * 1000)
            e = int(float(w.get("e", 0)) * 1000)
            if s < t < e:
                issues.append({"code": "partial_word", "atOutMs": t, "detail": w.get("w", "")})
                break
    passed = len(issues) == 0
    return {"passed": passed, "pass": passed, "issues": issues, "costUsd": 0}
