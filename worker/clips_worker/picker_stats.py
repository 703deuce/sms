"""Per-project pass2 batch telemetry for prod logs."""
from __future__ import annotations

_PROJECT_PASS2: dict[str, dict[str, int]] = {}


def _bucket(project_id: str | None) -> dict[str, int]:
    key = (project_id or "").strip() or "_unknown"
    return _PROJECT_PASS2.setdefault(
        key,
        {"batch_ok": 0, "heuristic_fallback": 0, "moments_capped": 0},
    )


def record_pass2_batch_ok(project_id: str | None, moments_scored: int = 0) -> None:
    b = _bucket(project_id)
    b["batch_ok"] += 1
    if moments_scored > 0:
        b["batch_moments"] = b.get("batch_moments", 0) + int(moments_scored)


def record_pass2_heuristic_fallback(project_id: str | None) -> None:
    _bucket(project_id)["heuristic_fallback"] += 1


def record_pass2_moments_capped(project_id: str | None, dropped: int) -> None:
    if dropped > 0:
        _bucket(project_id)["moments_capped"] += int(dropped)


def log_project_pass2_stats(project_id: str | None) -> None:
    key = (project_id or "").strip() or "_unknown"
    bucket = _PROJECT_PASS2.pop(key, None)
    if not bucket:
        return
    batch_ok = int(bucket.get("batch_ok") or 0)
    fallback = int(bucket.get("heuristic_fallback") or 0)
    attempts = batch_ok + fallback
    rate = (fallback / attempts) if attempts else 0.0
    print(
        f"[clipper:pass2] project_summary project={project_id or '-'} "
        f"batch_ok={batch_ok} heuristic_fallback={fallback} fallback_rate={rate:.3f} "
        f"moments_capped={int(bucket.get('moments_capped') or 0)}",
        flush=True,
    )
