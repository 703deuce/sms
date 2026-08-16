"""Tests for internal API client URL resolution."""

import os

import pytest

from transovo_voice.integrations.backend_client import resolve_backend_base_url


def test_resolve_backend_base_url_requires_explicit() -> None:
    os.environ.pop("TRANSOVO_BACKEND_URL", None)
    with pytest.raises(RuntimeError, match="TRANSOVO_BACKEND_URL"):
        resolve_backend_base_url()


def test_resolve_backend_base_url_uses_env() -> None:
    os.environ["TRANSOVO_BACKEND_URL"] = "https://app.example.com/"
    assert resolve_backend_base_url() == "https://app.example.com"
    del os.environ["TRANSOVO_BACKEND_URL"]
