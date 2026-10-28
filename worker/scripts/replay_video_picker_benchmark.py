#!/usr/bin/env python3
"""One-off Gemini video-picker replay (no edge reassess, no render)."""
from __future__ import annotations

import json
import os
import sys
import time
import tempfile
from pathlib import Path

# Run from worker image: PYTHONPATH=/app python3 scripts/replay_video_picker_benchmark.py

PROJECT_ID = os.environ.get("BENCH_PROJECT_ID", "proj_3edeaf9309b74bbfa8ce5313b0e346c3")
UPLOAD_KEY = os.environ.get(
    "BENCH_SOURCE_KEY",
    "ws/ws_1/uploads/upl_6e0b931f3b8b4d7b9f7d905682d70b7c/source.mp4",
)

MODEL_38 = "gemini-3.8-flash"
MODEL_LITE = "gemini-3.5-flash-lite"
MODEL_25 = "gemini-2.5-flash"

SETTING_PATCHES: list[tuple[str, dict]] = [
    ("a_baseline", {}),
    ("b_medium_res", {"VIDEO_PICKER_MEDIA_RES": "MEDIA_RESOLUTION_MEDIUM"}),
    ("c_fps_1_0", {"VIDEO_PICKER_FPS": "1.0"}),
    ("d_transcript_first", {"VIDEO_PICKER_USER_PART_ORDER": "transcript_first"}),
    ("d_video_first", {"VIDEO_PICKER_USER_PART_ORDER": "video_first"}),
]


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
    try:
        import psycopg2

        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute("SELECT * FROM clip_projects WHERE id = %s", (PROJECT_ID,))
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
    return (
        format_timestamped_transcript(sentences, 0, duration_s * 1000) if sentences else ""
    )


def run_variant(
    name: str,
    env_patch: dict,
    *,
    model: str,
    shared_src: Path,
    transcript: str,
    duration_s: int = 226,
) -> dict:
    from clips_worker.video_picker import make_watch_proxy, watch_video_file

    scratch = Path(tempfile.mkdtemp(prefix=f"vp_bench_{name}_"))
    proxy = scratch / "watch.mp4"
    make_watch_proxy(shared_src, proxy, 0.0, float(duration_s))

    patch = {**env_patch, "VIDEO_PICKER_MODEL": model}
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
    status = meta.get("status")
    err = meta.get("error")
    rate_limited = status == 429 or (err and "429" in str(err))
    return {
        "variant": name,
        "model": meta.get("model") or model,
        "fps": meta.get("fps"),
        "media_resolution": meta.get("media_resolution"),
        "user_part_order": meta.get("user_part_order"),
        "prompt_tokens": meta.get("prompt_tokens"),
        "output_tokens": meta.get("output_tokens"),
        "pricing_usd_per_1m": meta.get("pricing_usd_per_1m"),
        "est_usd": meta.get("est_usd"),
        "sections": meta.get("sections") or [],
        "moments": moment_rows(moments),
        "coverage": cov,
        "ok": meta.get("ok"),
        "status": status,
        "rate_limited": rate_limited,
        "error": err,
    }


def build_variant_list() -> list[tuple[str, dict, str]]:
    out: list[tuple[str, dict, str]] = []
    for name, patch in SETTING_PATCHES:
        out.append((f"38_{name}", patch, MODEL_38))
    out.append(("25_a_baseline", {}, MODEL_25))
    best = {"VIDEO_PICKER_USER_PART_ORDER": "transcript_first"}
    # Model shootout at winning settings (3.8 side = 38_d_transcript_first above).
    out.append(("e_35_flash_lite", best, MODEL_LITE))
    return out


def pick_default_model(results: list[dict]) -> str | None:
    """Prefer 3.8-flash when multiple models hit apex+meow at transcript_first."""
    winners: list[tuple[str, float]] = []
    for row in results:
        if not row.get("ok"):
            continue
        cov = row.get("coverage") or {}
        if not (cov.get("apex") and cov.get("meow")):
            continue
        if row.get("user_part_order") != "transcript_first" and not str(row.get("variant", "")).startswith("e_"):
            continue
        model = str(row.get("model") or "")
        cost = float(row.get("est_usd") or 999.0)
        winners.append((model, cost))
    if not winners:
        for row in results:
            if not row.get("ok"):
                continue
            cov = row.get("coverage") or {}
            if cov.get("apex") and cov.get("meow"):
                winners.append((str(row.get("model") or ""), float(row.get("est_usd") or 999.0)))
    if not winners:
        return None
    prefer = {MODEL_38: 0, MODEL_LITE: 1}
    winners.sort(key=lambda t: (prefer.get(t[0], 9), t[1]))
    return winners[0][0]


def main() -> None:
    sleep_s = float(os.environ.get("BENCH_SLEEP_S", "25"))
    only = (os.environ.get("BENCH_ONLY") or "").strip()
    duration_s = 226
    root = Path(tempfile.mkdtemp(prefix="vp_bench_shared_"))
    shared_src = _shared_download(root)
    transcript = _load_transcript(float(duration_s))
    print(f"[bench] shared source={shared_src} transcript_chars={len(transcript)}", flush=True)

    variants = build_variant_list()
    if only:
        variants = [v for v in variants if v[0] == only or v[0].endswith(only)]
        if not variants:
            raise SystemExit(f"BENCH_ONLY={only!r} matched no variants")
    results: list[dict] = []
    for i, (name, patch, model) in enumerate(variants):
        print(f"[bench] === {name} model={model} ===", flush=True)
        try:
            row = run_variant(
                name,
                patch,
                model=model,
                shared_src=shared_src,
                transcript=transcript,
                duration_s=duration_s,
            )
        except Exception as exc:
            row = {
                "variant": name,
                "model": model,
                "ok": False,
                "error": str(exc)[:400],
                "rate_limited": "429" in str(exc),
            }
        results.append(row)
        print(json.dumps(row, indent=2), flush=True)
        if i + 1 < len(variants) and sleep_s > 0:
            time.sleep(sleep_s)

    winner = pick_default_model(results)
    summary = {
        "recommended_VIDEO_PICKER_MODEL": winner,
        "models": [MODEL_38, MODEL_LITE, MODEL_25],
    }
    print(f"[bench] summary {json.dumps(summary)}", flush=True)

    out = Path(os.environ.get("BENCH_OUT", "/tmp/video_picker_benchmark_mixed_4min.json"))
    out.write_text(json.dumps({"summary": summary, "results": results}, indent=2), encoding="utf-8")
    print(f"[bench] wrote {out}", flush=True)


if __name__ == "__main__":
    main()
