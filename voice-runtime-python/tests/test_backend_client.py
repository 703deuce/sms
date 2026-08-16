"""Tests for internal API client URL resolution."""

import os

from transovo_voice.integrations.backend_client import resolve_internal_base_url


def test_resolve_internal_base_url_prefers_explicit() -> None:
    os.environ["VOICE_RUNTIME_INTERNAL_URL"] = "http://10.0.0.1:4000"
    os.environ["PORT"] = "3000"
    assert resolve_internal_base_url() == "http://10.0.0.1:4000"
    del os.environ["VOICE_RUNTIME_INTERNAL_URL"]


def test_resolve_internal_base_url_defaults_to_loopback() -> None:
    os.environ.pop("VOICE_RUNTIME_INTERNAL_URL", None)
    os.environ["APP_URL"] = "https://public.example.com"
    os.environ["PORT"] = "3000"
    assert resolve_internal_base_url() == "http://127.0.0.1:3000"
