#!/usr/bin/env python3
"""Gemini 3.8 video-picker replay on mixed_4min (labeled frames, no edge reassess)."""
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

VIDEO_PICKER_MODEL = "gemini-3.8-flash"

CURRENT_SETTINGS: dict = {}

ESCALATIONS: list[tuple[str, dict]] = [
    ("medium_res", {"VIDEO_PICKER_MEDIA_RES": "MEDIA_RESOLUTION_MEDIUM"}),
    ("fps_1_0", {"VIDEO_PICKER_FPS": "1.0"}),
    ("transcript_after_video", {"VIDEO_PICKER_USER_PART_ORDER": "video_first"}),
]

# Rick truth (seconds)
TRUTH = {
    "talk_pre": (0.0, 80.4),
    "apex_gameplay": (80.4, 170.4),
    "talk_meow": (170.4, 226.0),
    "champion_banner": 168.0,
    "firefight": (118.0, 145.0),
}


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


def coverage_ok(cov: dict) -> bool:
    return bool(cov.get("apex") and cov.get("meow"))


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


def _quota_or_429(row: dict) -> bool:
    if row.get("rate_limited") or row.get("status") == 429:
        return True
    err = (row.get("error") or "").lower()
    return "429" in err or "quota exceeded" in err


def _is_503(row: dict) -> bool:
    if row.get("status") == 503:
        return True
    err = (row.get("error") or "").lower()
    return "503" in err or "high demand" in err


def run_variant(
    name: str,
    env_patch: dict,
    *,
    shared_src: Path,
    transcript: str,
    duration_s: int = 226,
) -> dict:
    from clips_worker.video_picker import make_watch_proxy, watch_video_file

    scratch = Path(tempfile.mkdtemp(prefix=f"vp_bench_{name}_"))
    proxy = scratch / "watch.mp4"
    make_watch_proxy(shared_src, proxy, 0.0, float(duration_s))

    patch = {**env_patch, "VIDEO_PICKER_MODEL": VIDEO_PICKER_MODEL}
    if os.environ.get("BENCH_NO_FALLBACK", "1").strip().lower() in ("1", "true", "yes"):
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
            model_override=VIDEO_PICKER_MODEL,
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
    return {
        "variant": name,
        "model_requested": meta.get("model_requested"),
        "model_used": meta.get("model_used") or meta.get("model"),
        "model_fallback": meta.get("model_fallback"),
        "input_mode": meta.get("input_mode"),
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
        "rate_limited": _quota_or_429({"error": err, "status": status}),
        "error": err,
        "time_invalid": meta.get("time_invalid"),
    }


def run_with_503_retries(name: str, patch: dict, **kwargs) -> dict:
    wait_s = float(os.environ.get("BENCH_503_WAIT_S", "120"))
    max_tries = int(os.environ.get("BENCH_503_TRIES", "4"))
    last: dict = {}
    for attempt in range(max_tries):
        if attempt:
            print(f"[bench] 503/wait retry {attempt + 1}/{max_tries} after {wait_s}s", flush=True)
            time.sleep(wait_s)
        last = run_variant(name, patch, **kwargs)
        if last.get("ok"):
            return last
        if _quota_or_429(last):
            print(
                f"\n[bench] *** GEMINI 429/QUOTA on {VIDEO_PICKER_MODEL} — abort (no lite in bench) ***\n",
                flush=True,
            )
            sys.exit(2)
        if last.get("model_fallback"):
            print("[bench] ERROR: lite fallback ran during bench (BENCH_NO_FALLBACK=1)", flush=True)
            sys.exit(3)
        if not _is_503(last):
            break
    return last


def main() -> None:
    sleep_s = float(os.environ.get("BENCH_SLEEP_S", "18"))
    only = (os.environ.get("BENCH_ONLY") or "").strip()
    duration_s = 226
    root = Path(tempfile.mkdtemp(prefix="vp_bench_shared_"))
    shared_src = _shared_download(root)
    transcript = _load_transcript(float(duration_s))
    print(
        f"[bench] model={VIDEO_PICKER_MODEL} labeled_frames=true truth={json.dumps(TRUTH)}",
        flush=True,
    )

    results: list[dict] = []

    def _run(name: str, patch: dict) -> dict:
        print(f"[bench] === {name} ===", flush=True)
        try:
            row = run_with_503_retries(
                name,
                patch,
                shared_src=shared_src,
                transcript=transcript,
                duration_s=duration_s,
            )
        except Exception as exc:
            msg = str(exc)[:400]
            row = {
                "variant": name,
                "model": VIDEO_PICKER_MODEL,
                "ok": False,
                "error": msg,
                "rate_limited": _quota_or_429({"error": msg}),
            }
        results.append(row)
        print(json.dumps(row, indent=2), flush=True)
        return row

    if only in ("38_a_baseline", "a_baseline", "current_settings"):
        _run("38_a_baseline", CURRENT_SETTINGS)
    else:
        first = _run("current_settings", CURRENT_SETTINGS)
        winner = first if first.get("ok") and coverage_ok(first.get("coverage") or {}) else None
        if winner is None and first.get("ok"):
            for ename, patch in ESCALATIONS:
                if sleep_s > 0:
                    time.sleep(sleep_s)
                row = _run(ename, patch)
                if row.get("ok") and coverage_ok(row.get("coverage") or {}):
                    winner = row
                    break

    out = Path(os.environ.get("BENCH_OUT", "/tmp/video_picker_benchmark_mixed_4min.json"))
    out.write_text(json.dumps({"truth": TRUTH, "results": results}, indent=2), encoding="utf-8")
    print(f"[bench] wrote {out}", flush=True)


if __name__ == "__main__":
    main()
