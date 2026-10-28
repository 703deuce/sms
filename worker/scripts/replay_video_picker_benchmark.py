#!/usr/bin/env python3
"""One-off Gemini video-picker replay (no edge reassess, no render)."""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

# Run from worker image: PYTHONPATH=/app python3 scripts/replay_video_picker_benchmark.py

PROJECT_ID = os.environ.get("BENCH_PROJECT_ID", "proj_3edeaf9309b74bbfa8ce5313b0e346c3")
UPLOAD_KEY = os.environ.get(
    "BENCH_SOURCE_KEY",
    "ws/ws_1/uploads/upl_6e0b931f3b8b4d7b9f7d905682d70b7c/source.mp4",
)


def _span_overlaps(lo: float, hi: float, a: float, b: float) -> bool:
    return max(lo, a) < min(hi, b)


def score_coverage(moments: list[dict], duration_s: float = 226.0) -> dict[str, bool]:
    apex = False
    meow = False
    for m in moments:
        try:
            ss = float(m.get("start_s", 0))
            es = float(m.get("end_s", ss))
            peak = float(m.get("peak_s", (ss + es) / 2))
        except (TypeError, ValueError):
            continue
        if _span_overlaps(ss, es, 78.0, 175.0) or _span_overlaps(peak, peak + 0.1, 95.0, 170.0):
            cats = m.get("category") or []
            if isinstance(cats, str):
                cats = [cats]
            if "gaming" in cats or peak >= 95.0:
                apex = True
        if ss >= 165.0 or es >= 200.0 or peak >= 168.0:
            meow = True
    return {"apex": apex, "meow": meow}


def moment_rows(moments: list[dict]) -> list[dict]:
    rows = []
    for m in moments:
        rows.append(
            {
                "start_s": m.get("start_s"),
                "end_s": m.get("end_s"),
                "peak_s": m.get("peak_s"),
                "category": m.get("category"),
                "score": m.get("score"),
                "confidence": m.get("confidence"),
                "touches_edge": m.get("touches_edge"),
                "what": (m.get("what_happened") or "")[:120],
            }
        )
    return rows


def run_variant(name: str, env_patch: dict, *, model: str | None = None) -> dict:
    from clips_worker.storage import download_object
    from clips_worker.video_picker import (
        format_timestamped_transcript,
        make_watch_proxy,
        watch_video_file,
    )
    from clips_worker.picker.sentences import build_sentences

    scratch = Path(tempfile.mkdtemp(prefix=f"vp_bench_{name}_"))
    src = scratch / "source.mp4"
    if not src.is_file():
        download_object(UPLOAD_KEY, src)
    proxy = scratch / "watch.mp4"
    duration_s = 226
    make_watch_proxy(src, proxy, 0.0, float(duration_s))

    words: list[dict] = []
    try:
        import psycopg2

        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute('SELECT * FROM clip_projects WHERE id = %s', (PROJECT_ID,))
        row = cur.fetchone()
        if row:
            cols = [d[0] for d in cur.description]
            proj = dict(zip(cols, row))
            tw = proj.get("transcriptWords")
            if tw:
                words = tw if isinstance(tw, list) else json.loads(tw)
        conn.close()
    except Exception as exc:
        print(f"[bench] warn: no transcript from DB: {exc}", flush=True)

    sentences = build_sentences(words, 0, duration_s * 1000) if words else []
    transcript = format_timestamped_transcript(sentences, 0, duration_s * 1000) if sentences else ""

    saved = {k: os.environ.get(k) for k in env_patch}
    os.environ.update({k: str(v) for k, v in env_patch.items()})
    try:
        moments, meta = watch_video_file(
            proxy,
            duration_s=duration_s,
            chunk_label=f"bench_{name}",
            transcript_text=transcript,
            skip_edge_reassess=True,
            model_override=model,
            fps_override=float(env_patch["VIDEO_PICKER_FPS"]) if "VIDEO_PICKER_FPS" in env_patch else None,
            media_resolution_override=env_patch.get("VIDEO_PICKER_MEDIA_RES"),
            user_part_order=env_patch.get("VIDEO_PICKER_USER_PART_ORDER"),
            fail_open=False,
        )
    finally:
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    cov = score_coverage(moments, float(duration_s))
    return {
        "variant": name,
        "model": meta.get("model"),
        "fps": meta.get("fps"),
        "media_resolution": meta.get("media_resolution"),
        "user_part_order": meta.get("user_part_order"),
        "prompt_tokens": meta.get("prompt_tokens"),
        "output_tokens": meta.get("output_tokens"),
        "est_usd": meta.get("est_usd"),
        "sections": meta.get("sections") or [],
        "moments": moment_rows(moments),
        "coverage": cov,
        "ok": meta.get("ok"),
        "error": meta.get("error"),
    }


def main() -> None:
    variants: list[tuple[str, dict, str | None]] = [
        ("a_baseline", {}, None),
        ("b_medium_res", {"VIDEO_PICKER_MEDIA_RES": "MEDIA_RESOLUTION_MEDIUM"}, None),
        ("c_fps_1_0", {"VIDEO_PICKER_FPS": "1.0"}, None),
        ("d_transcript_first", {"VIDEO_PICKER_USER_PART_ORDER": "transcript_first"}, None),
        ("d_video_first", {"VIDEO_PICKER_USER_PART_ORDER": "video_first"}, None),
        ("e_flash", {}, "gemini-2.5-flash"),
        ("e_pro", {}, "gemini-2.5-pro"),
    ]
    results: list[dict] = []
    for name, patch, model in variants:
        print(f"[bench] === {name} ===", flush=True)
        try:
            row = run_variant(name, patch, model=model)
        except Exception as exc:
            row = {"variant": name, "ok": False, "error": str(exc)[:400]}
        results.append(row)
        print(json.dumps(row, indent=2), flush=True)

    out = Path("/tmp/video_picker_benchmark_mixed_4min.json")
    out.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"[bench] wrote {out}", flush=True)


if __name__ == "__main__":
    main()
