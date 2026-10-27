"""Loud picker / rank failures (no secrets in logs)."""
from __future__ import annotations


def log_picker_error(provider: str, message: str, status: int | str | None = None) -> None:
    st = status if status is not None else "n/a"
    msg = (message or "unknown error").replace("\n", " ")[:400]
    print(f"[clipper:picker_error] provider={provider} status={st} message={msg}", flush=True)
