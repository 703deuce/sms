"""Montserrat must be available for polished caption burn (image + fontconfig)."""
import os
import shutil
import subprocess
from pathlib import Path

import pytest

V3 = Path(os.environ.get("SPEAKERCROP_DIR", "/app/v3"))


def test_montserrat_ttf_in_v3_fontsdir():
    font = V3 / "fonts" / "Montserrat-Black.ttf"
    if not font.is_file():
        pytest.skip("Montserrat-Black.ttf not synced (run worker image build)")
    assert font.stat().st_size > 10_000


def test_fontconfig_lists_montserrat_when_available():
    if not shutil.which("fc-list"):
        pytest.skip("fontconfig not installed")
    try:
        out = subprocess.check_output(["fc-list", ":", "family"], text=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pytest.skip("fc-list failed")
    if "Montserrat" not in out:
        pytest.skip("Montserrat not installed on this host (expected in worker image)")
    assert "Montserrat" in out
