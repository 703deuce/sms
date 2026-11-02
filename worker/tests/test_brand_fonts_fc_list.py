"""Every curated brand kit font must be registered with fontconfig in the worker image."""
from __future__ import annotations

import shutil
import subprocess

import pytest

from clips_worker.brand_fonts import BRAND_FONT_FC_SUBSTRINGS


def test_fc_list_includes_all_brand_fonts():
    if not shutil.which("fc-list"):
        pytest.skip("fontconfig not installed")
    try:
        out = subprocess.check_output(["fc-list", ":", "family"], text=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pytest.skip("fc-list failed")
    if "Montserrat" not in out and "Inter" not in out:
        pytest.skip("brand fonts not installed on this host (expected in worker image)")
    for display, needle in BRAND_FONT_FC_SUBSTRINGS.items():
        assert needle in out, f"missing font family for {display!r} (expected {needle!r} in fc-list)"

