#!/usr/bin/env python3
"""Deploy smoke: import paths + lightweight render_edited_clip overlay gate (≤3 min)."""
from __future__ import annotations

import os
import signal
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch


def _alarm(seconds: int) -> None:
    def _handler(_signum, _frame):
        raise TimeoutError(f"deploy smoke exceeded {seconds}s")

    signal.signal(signal.SIGALRM, _handler)
    signal.alarm(seconds)


def main() -> int:
    _alarm(180)
    import clips_worker.main  # noqa: F401

    from clips_worker.chat_overlay_apply import try_apply_chat_overlay

    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "v.mp4"
        p.write_bytes(b"0")
        try_apply_chat_overlay(
            p,
            Path(td),
            conn=MagicMock(),
            project_id="proj_smoke",
            edits={"chatOverlay": {"enabled": False}},
            clip_start_ms=0,
            clip_end_ms=20_000,
            layout_mode="fit_blur",
            clip_id="smoke",
        )
        with patch("clips_worker.chat_overlay_apply.load_vod_for_project", side_effect=RuntimeError("x")):
            try_apply_chat_overlay(
                p,
                Path(td),
                conn=MagicMock(),
                project_id="proj_smoke",
                edits={"chatOverlay": {"enabled": True}},
                clip_start_ms=0,
                clip_end_ms=20_000,
                layout_mode="fit_blur",
                clip_id="smoke",
            )
    print("deploy_smoke_ok", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except TimeoutError as exc:
        print(str(exc), file=sys.stderr, flush=True)
        raise SystemExit(1)
