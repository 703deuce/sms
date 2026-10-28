#!/usr/bin/env python3
"""Deploy smoke: real short clip through cut+caption export + chat overlay fail-open (≤3 min)."""
from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import tempfile
from pathlib import Path

worker_root = Path(__file__).resolve().parents[1]
if str(worker_root) not in sys.path:
    sys.path.insert(0, str(worker_root))
_v3 = worker_root / "prototype" / "v3"
if _v3.is_dir():
    os.environ.setdefault("SPEAKERCROP_DIR", str(_v3))


def _alarm(seconds: int) -> None:
    def _handler(_signum, _frame):
        raise TimeoutError(f"deploy smoke exceeded {seconds}s")

    signal.signal(signal.SIGALRM, _handler)
    signal.alarm(seconds)


def _ffprobe_duration_s(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out)


def _smoke_words(duration_s: float) -> list[dict]:
    words: list[dict] = []
    t = 0.0
    i = 0
    for w in ("Deploy", "smoke", "clip", "renders", "captions", "and", "export", "ok."):
        if t >= duration_s - 0.5:
            break
        e = min(duration_s - 0.05, t + 0.35)
        words.append({"w": w, "s": t, "e": e, "spk": 0, "i": i})
        t = e + 0.08
        i += 1
    if not words:
        words.append({"w": "ok", "s": 0.0, "e": min(1.0, duration_s), "spk": 0, "i": 0})
    return words


def main() -> int:
    _alarm(180)

    worker_root = Path(__file__).resolve().parents[1]
    src = worker_root / "assets" / "smoke_deploy.mp4"
    if not src.is_file():
        print(f"missing smoke asset: {src}", file=sys.stderr, flush=True)
        return 1

    src_dur = _ffprobe_duration_s(src)
    if src_dur < 18.0 or src_dur > 32.0:
        print(f"smoke asset duration out of range: {src_dur}s", file=sys.stderr, flush=True)
        return 1

    clip_end_ms = min(int(src_dur * 1000), 26_000)
    clip_start_ms = 0
    words = _smoke_words(clip_end_ms / 1000.0)

    from clips_worker.chat_overlay_apply import try_apply_chat_overlay  # noqa: F401
    from clips_worker.edits_render import default_edits, normalize_edits, render_edited_clip

    settings = {
        "layout": "fit_blur",
        "captions": {"enabled": True, "presetId": "bold_pop"},
    }

    with tempfile.TemporaryDirectory(prefix="deploy_smoke_") as td:
        work = Path(td)
        work1 = work / "w1"
        work1.mkdir(parents=True, exist_ok=True)
        out1 = work / "export_default.mp4"
        edits1 = normalize_edits(default_edits(clip_start_ms, clip_end_ms), clip_start_ms, clip_end_ms)
        render_edited_clip(
            src,
            out1,
            words,
            edits1,
            clip_start_ms,
            clip_end_ms,
            settings,
            work1,
            conn=None,
            project_id="smoke_proj",
            clip_id="smoke_default",
        )
        if not out1.is_file() or out1.stat().st_size < 10_000:
            print("default export missing or too small", file=sys.stderr, flush=True)
            return 1
        out_dur = _ffprobe_duration_s(out1)
        expected = (clip_end_ms - clip_start_ms) / 1000.0
        if abs(out_dur - expected) > 1.0:
            print(
                f"default export duration {out_dur}s not within 1s of {expected}s",
                file=sys.stderr,
                flush=True,
            )
            return 1
        subprocess.check_call(["ffprobe", "-v", "error", str(out1)])

        work2 = work / "w2"
        work2.mkdir(parents=True, exist_ok=True)
        out2 = work / "export_chat_on.mp4"
        edits2 = normalize_edits(
            {
                **default_edits(clip_start_ms, clip_end_ms),
                "chatOverlay": {"enabled": True},
            },
            clip_start_ms,
            clip_end_ms,
        )
        render_edited_clip(
            src,
            out2,
            words,
            edits2,
            clip_start_ms,
            clip_end_ms,
            settings,
            work2,
            conn=None,
            project_id="smoke_proj",
            clip_id="smoke_chat",
        )
        if not out2.is_file() or out2.stat().st_size < 10_000:
            print("chat-on export missing or too small", file=sys.stderr, flush=True)
            return 1
        out2_dur = _ffprobe_duration_s(out2)
        if abs(out2_dur - expected) > 1.0:
            print(
                f"chat-on export duration {out2_dur}s not within 1s of {expected}s",
                file=sys.stderr,
                flush=True,
            )
            return 1
        subprocess.check_call(["ffprobe", "-v", "error", str(out2)])

    print(json.dumps({"deploy_smoke_ok": True, "src_duration_s": src_dur}), flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except TimeoutError as exc:
        print(str(exc), file=sys.stderr, flush=True)
        raise SystemExit(1)
