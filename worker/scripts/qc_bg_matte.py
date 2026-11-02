#!/usr/bin/env python3
"""EF-24 item 1 QC: first 10 s of two clips through RVM (Standard + Detail) on Modal L4 (DEV env)."""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

CLIPS = ["clip_5f19e510a23241c29190475d4723aa21", "clip_d46c686b0a234a17985d8e369b00bee9"]
L4 = 0.000222
CAP_USD = 1.00


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=float, default=10.0)
    ap.add_argument("--out", default="/tmp/ef24_qc")
    ap.add_argument("--qualities", default="standard,detail")
    a = ap.parse_args()
    if os.environ.get("MODAL_ENVIRONMENT", "") != "dev":
        print("refusing: set MODAL_ENVIRONMENT=dev (QC must not use the prod Modal env)")
        return 2
    import modal
    import psycopg2

    from clips_worker import storage
    from clips_worker.gpu_encode import _upload_signed_put_url

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    Matter = modal.Cls.from_name(os.environ.get("MODAL_APP_NAME", "transovo-gpu"), "Matter")
    spent = 0.0
    with psycopg2.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        for cid in CLIPS:
            cur.execute(
                'SELECT "segmentKey", "sourceSegKey", "sourceSegStartMs", "startMs" FROM clips WHERE id = %s',
                (cid,),
            )
            row = cur.fetchone()
            if not row:
                print(f"{cid}: not found")
                continue
            seg_key, ssk, ss0, start_ms = row
            key, off = (ssk, max(0, (start_ms - (ss0 or 0)) / 1000.0)) if ssk else (seg_key, 0.0)
            src_url = storage.sign_url(key)
            src = out / f"{cid}_src.mp4"
            subprocess.check_call(
                [
                    "ffmpeg",
                    "-y",
                    "-v",
                    "error",
                    "-ss",
                    f"{off:.3f}",
                    "-t",
                    f"{a.seconds}",
                    "-i",
                    src_url,
                    "-c:v",
                    "libx264",
                    "-crf",
                    "16",
                    "-c:a",
                    "aac",
                    str(src),
                ]
            )
            for q in a.qualities.split(","):
                if spent >= CAP_USD * 0.8:
                    print(f"stop: spent ${spent:.3f} ≥ 80% of ${CAP_USD}")
                    return 1
                up_key = f"qc/ef24/{cid}_{q}_{int(time.time())}.mp4"
                t0 = time.time()
                r = Matter().matte.remote(
                    {
                        "src_url": src_url,
                        "start_s": off,
                        "dur_s": a.seconds,
                        "preroll_s": 0.0,
                        "fps": 30,
                        "short_side": 1080,
                        "quality": q,
                        "median": True,
                        "out_upload_url": _upload_signed_put_url(up_key),
                    }
                )
                wall = time.time() - t0
                if not r.get("ok"):
                    print(f"{cid} {q}: FAILED {r}")
                    continue
                spent += r["gpu_seconds"] * L4
                alpha = out / f"{cid}_{q}_alpha.mp4"
                urllib.request.urlretrieve(storage.sign_url(up_key), alpha)
                _composites(src, alpha, out / f"{cid}_{q}")
                per_min = r["gpu_seconds"] * (60.0 / a.seconds)
                print(
                    f"{cid} {q}: frames={r['frames']} fps={r['frames'] / max(1e-6, r['gpu_seconds']):.1f} "
                    f"gpu_s={r['gpu_seconds']:.1f} wall_s={wall:.1f} cold={r['cold_start']} "
                    f"mean_alpha={r['mean_alpha']:.3f} billed_gpu_s_per_src_min={per_min:.0f} "
                    f"usd_per_src_min={per_min * L4:.4f}"
                )
    print(f"TOTAL GPU spend ≈ ${spent:.3f} (cap ${CAP_USD})")
    return 0


def _composites(src: Path, alpha: Path, stem: Path) -> None:
    common = ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-i", str(alpha)]
    ma = "[1:v]format=gray[ma]"
    subprocess.check_call(
        common
        + [
            "-filter_complex",
            f"{ma};[0:v]format=yuv420p,split[f][b];[b]drawbox=c=0x00ff00:t=fill[g];[f][ma]alphamerge[fa];[g][fa]overlay=shortest=1[v]",
            "-map",
            "[v]",
            "-c:v",
            "libx264",
            "-crf",
            "18",
            f"{stem}_green.mp4",
        ]
    )
    subprocess.check_call(
        common
        + [
            "-filter_complex",
            f"{ma};[0:v]format=yuv420p,split[f][b];[b]gblur=sigma=24[g];[f][ma]alphamerge[fa];[g][fa]overlay=shortest=1[v]",
            "-map",
            "[v]",
            "-c:v",
            "libx264",
            "-crf",
            "18",
            f"{stem}_blur.mp4",
        ]
    )
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", str(alpha), "-c:v", "libx264", "-crf", "18", f"{stem}_alpha.mp4"])
    subprocess.check_call(
        common
        + [
            "-filter_complex",
            f"{ma};[0:v]format=yuv420p,split[f][o];[o]drawbox=c=0x00ff00:t=fill[g0];[f][ma]alphamerge[fa];[g0][fa]overlay=shortest=1[c];"
            f"[0:v]format=yuv420p[o2];[o2][c]hstack=inputs=2[v]",
            "-map",
            "[v]",
            "-c:v",
            "libx264",
            "-crf",
            "18",
            f"{stem}_sbs.mp4",
        ]
    )


if __name__ == "__main__":
    raise SystemExit(main())
