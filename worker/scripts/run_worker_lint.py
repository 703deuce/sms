#!/usr/bin/env python3
"""Static analysis gate for worker/clips_worker (F821/F823/F811)."""
from __future__ import annotations

import subprocess
import sys


def main() -> int:
    try:
        import ruff  # noqa: F401
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "ruff"])
    cmd = [
        sys.executable,
        "-m",
        "ruff",
        "check",
        "clips_worker",
        "--select",
        "F821,F823,F811",
        "--ignore",
        "F401",
    ]
    print("[lint-worker]", " ".join(cmd), flush=True)
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
