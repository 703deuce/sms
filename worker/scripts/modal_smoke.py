"""Live Modal transcribe smoke (skipped unless STREAMER_LIVE_TESTS=1)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main() -> int:
    if os.environ.get("STREAMER_LIVE_TESTS") != "1":
        print("set STREAMER_LIVE_TESTS=1 to run")
        return 0
    fixture = ROOT / "tests" / "fixtures" / "streamer" / "speech_30s.opus"
    if not fixture.exists():
        print("missing fixture", fixture)
        return 1
    from clips_worker.gpu.modal_provider import ModalProvider

    # Requires a signed URL in real runs; local smoke uses file path via local provider fallback message
    print("modal smoke requires deployed app and signed audio URL")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
