#!/usr/bin/env python3
"""Replay gemini-3.8 (+ optional lite backup) on mixed_4min."""
from __future__ import annotations

import json
import os
import sys
import time
import tempfile
from pathlib import Path

PROJECT_ID = os.environ.get("BENCH_PROJECT_ID", "proj_3edeaf9309b74bbfa8ce5313b0e346c3")
UPLOAD_KEY = os.environ.get(
    "BENCH_SOURCE_KEY",
    "ws/ws_1/uploads/upl_6e0b931f3b8b4d7b9f7d905682d70b7c/source.mp4",
)

MODEL_38 = os.environ.get("VIDEO_PICKER_MODEL", "gemini-3.8-flash")
MODEL_LITE = os.environ.get("VIDEO_PICKER_FALLBACK_MODEL", "gemini-3.5-flash-lite")

CURRENT_SETTINGS: dict = {}

TRUTH = {
    "talk_pre": (0.0, 80.4),
    "apex_gameplay": (80.4, 170.4),
    "talk_meow": (170.4, 226.0),
    "champion_banner": 168.0,
    "firefight": (118.0, 145.0),
    "move_fast_line": 81.0,
    "win_line": 163.0,
}


def score_coverage(moments: list[dict]) -> dict[str, bool]:
    apex = meow = False
    for m in moments:
        try:
            ss = float(m.get("start_s", 0))
            es = float(m.get("end_s", ss))
            peak = float(m.get("peak_s", (ss + es) / 2))
        except (TypeError, ValueError):
            continue
        if max(ss, 78) < min(es, 175) or (95 <= peak <= 170):
            cats = m.get("category") or []
            if isinstance(cats, str):
                cats = [cats]
            if "gaming" in cats or peak >= 95:
                apex = True
        if ss >= 165 or es >= 200 or peak >= 168:
            meow = True
    return {"apex": apex, "meow": meow}


def moment_rows(moments: list[dict]) -> list[dict]:
    return [
        {
            "start_s": m.get("start_s"),
            "end_s": m.get("end_s"),
            "peak_s": m.get("peak_s"),
            "category": m.get("category"),
            "score": m.get("score"),
            "what": (m.get("what_happened") or "")[:120],
        }
        for m in moments
    ]


def _shared_download(scratch: Path) -> Path:
    src = scratch / "source.mp4"
    if not src.is_file():
        from clips_worker.storage import download_object

        download_object(UPLOAD_KEY, src)
    return src


def _load_transcript(duration_s: float) -> str:
    from clips_worker.video_picker import format_timestamped_transcript
    from clips_worker.picker.sentences import build_sentences

    words: list[dict] = []
    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute('SELECT "transcriptWords" FROM clip_projects WHERE id = %s', (PROJECT_ID,))
    row = cur.fetchone()
    conn.close()
    if row and row[0]:
        words = row[0] if isinstance(row[0], list) else json.loads(row[0])
    sentences = build_sentences(words, 0, duration_s * 1000) if words else []
    return format_timestamped_transcript(sentences, 0, duration_s * 1000) if sentences else ""


def run_variant(
    name: str,
    env_patch: dict,
    *,
    model: str,
    disable_fallback: bool,
    shared_src: Path,
    transcript: str,
    duration_s: int = 226,
) -> dict:
    from clips_worker.video_picker import make_watch_proxy, watch_video_file

    scratch = Path(tempfile.mkdtemp(prefix=f"vp_bench_{name}_"))
    proxy = scratch / "watch.mp4"
    make_watch_proxy(shared_src, proxy, 0.0, float(duration_s))

    patch = {**env_patch, "VIDEO_PICKER_MODEL": model}
    if disable_fallback:
        patch["VIDEO_PICKER_FALLBACK_MODEL"] = ""
    saved = {k: os.environ.get(k) for k in patch}
    os.environ.update({k: str(v) for k, v in patch.items()})
    try:
        moments, meta = watch_video_file(
            proxy,
            duration_s=duration_s,
            chunk_label=f"bench_{name}",
            transcript_text=transcript,
            skip_edge_reassess=True,
            model_override=model,
            fail_open=False,
        )
    except Exception as exc:
        return {
            "variant": name,
            "model_requested": model,
            "ok": False,
            "error": str(exc)[:500],
        }
    finally:
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    return {
        "variant": name,
        "model_requested": meta.get("model_requested"),
        "model_used": meta.get("model_used"),
        "model_fallback": meta.get("model_fallback"),
        "fallback_reason": meta.get("fallback_reason"),
        "input_mode": meta.get("input_mode"),
        "est_usd": meta.get("est_usd"),
        "prompt_tokens": meta.get("prompt_tokens"),
        "output_tokens": meta.get("output_tokens"),
        "pricing_usd_per_1m": meta.get("pricing_usd_per_1m"),
        "sections": meta.get("sections"),
        "moments": moment_rows(moments),
        "coverage": score_coverage(moments),
        "ok": meta.get("ok"),
        "error": meta.get("error"),
    }


def run_with_503_retries(name: str, **kwargs) -> dict:
    wait_s = float(os.environ.get("BENCH_503_WAIT_S", "90"))
    tries = int(os.environ.get("BENCH_503_TRIES", "4"))
    last: dict = {}
    for attempt in range(tries):
        if attempt:
            print(f"[bench] wait {wait_s}s then retry {attempt + 1}/{tries}", flush=True)
            time.sleep(wait_s)
        last = run_variant(name, CURRENT_SETTINGS, **kwargs)
        if last.get("ok"):
            return last
        err = (last.get("error") or "").lower()
        if "503" not in err and "high demand" not in err:
            return last
    return last


def main() -> None:
    duration_s = 226
    root = Path(tempfile.mkdtemp(prefix="vp_bench_shared_"))
    shared_src = _shared_download(root)
    transcript = _load_transcript(float(duration_s))
    results: list[dict] = []

    print(f"[bench] === gemini_3_8 (fallback enabled) ===", flush=True)
    row38 = run_with_503_retries(
        "gemini_3_8_flash",
        model=MODEL_38,
        disable_fallback=False,
        shared_src=shared_src,
        transcript=transcript,
        duration_s=duration_s,
    )
    results.append(row38)
    print(json.dumps(row38, indent=2), flush=True)

    time.sleep(float(os.environ.get("BENCH_SLEEP_S", "20")))

    print(f"[bench] === gemini_3_5_flash_lite (direct, no fallback) ===", flush=True)
    rowlite = run_variant(
        "gemini_3_5_flash_lite_direct",
        CURRENT_SETTINGS,
        model=MODEL_LITE,
        disable_fallback=True,
        shared_src=shared_src,
        transcript=transcript,
        duration_s=duration_s,
    )
    results.append(rowlite)
    print(json.dumps(rowlite, indent=2), flush=True)

    out = Path(os.environ.get("BENCH_OUT", "/tmp/video_picker_benchmark_mixed_4min.json"))
    out.write_text(json.dumps({"truth": TRUTH, "results": results}, indent=2), encoding="utf-8")
    print(f"[bench] wrote {out}", flush=True)


if __name__ == "__main__":
    main()
