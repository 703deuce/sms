"""Write worker/tests/fixtures/cut_cmd_golden.json — run once before motion_render refactors."""
from __future__ import annotations

import json
from pathlib import Path

from clips_worker.motion import TRANSITION_TYPES, cut_transition_windows
from clips_worker.motion_render import build_cut_transition_cmd

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "cut_cmd_golden.json"

CLIP_START = 0
W, H = 1920, 1080
FULL_DUR = 30.0
SEGS = [(0, 5000), (5000, 10000), (10000, 15000)]


def main() -> None:
    cases: list[dict] = []
    idx = 0
    for ttype in TRANSITION_TYPES:
        trs = [{"srcMs": 5000, "type": ttype, "durationMs": 400}]
        if ttype in ("zoom_in", "zoom_out"):
            trs.append({"srcMs": 10000, "type": ttype, "durationMs": 600})
        wins = cut_transition_windows(SEGS, trs)
        if not wins:
            continue
        cmd = build_cut_transition_cmd(
            Path("/tmp/cut.mp4"),
            Path("/tmp/full_render.mp4"),
            Path("/tmp/out.mp4"),
            wins,
            CLIP_START,
            W,
            H,
            FULL_DUR,
        )
        cases.append({"id": idx, "type": ttype, "windows": len(wins), "cmd": cmd})
        idx += 1
    # two-window crossfade mix
    trs2 = [
        {"srcMs": 5000, "type": "crossfade", "durationMs": 400},
        {"srcMs": 10000, "type": "wipe_left", "durationMs": 500},
    ]
    wins2 = cut_transition_windows(SEGS, trs2)
    cases.append(
        {
            "id": idx,
            "type": "multi",
            "windows": len(wins2),
            "cmd": build_cut_transition_cmd(
                Path("/tmp/cut.mp4"),
                Path("/tmp/full_render.mp4"),
                Path("/tmp/out.mp4"),
                wins2,
                CLIP_START,
                W,
                H,
                FULL_DUR,
            ),
        }
    )
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_text(json.dumps(cases, indent=2) + "\n")
    print(f"wrote {FIXTURE} ({len(cases)} cases)")


if __name__ == "__main__":
    main()
