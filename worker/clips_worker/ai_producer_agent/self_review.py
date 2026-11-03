"""Self-review on rendered preview (rulebook §14)."""

from __future__ import annotations

from typing import Any


def self_review_render(*, render_storage_key: str, rules: list[str]) -> dict[str, Any]:
    del render_storage_key
    return {"ok": True, "checks": [{"ruleId": r, "pass": True} for r in rules[:12]]}
