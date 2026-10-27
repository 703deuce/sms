"""Unit tests for clipper stage logging helpers."""
from __future__ import annotations

from clips_worker.stage_log import log_storage_key, sanitize_log_text


def test_sanitize_redacts_urls_and_bearer() -> None:
    raw = "Bearer sk-secret123 https://example.com/x?token=abc"
    out = sanitize_log_text(raw)
    assert "sk-secret" not in out
    assert "https://" not in out
    assert "(redacted)" in out


def test_log_storage_key_truncates_long_keys() -> None:
    long_key = "ws/" + ("a" * 200)
    label = log_storage_key("object", long_key)
    assert label.startswith("object:")
    assert "…" in label
    assert "?" not in label
