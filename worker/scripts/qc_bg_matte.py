#!/usr/bin/env python3
"""EF-24 item 1 QC: first 10 s of two clips through RVM (Standard + Detail) on Modal L4."""
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


def _resolve_clip_source(cur, clip_id: str) -> tuple[str, float, str] | None:
    from clips_worker.clip_source_media import resolve_clip_export_source

    cur.execute(
        """
        SELECT c.id, c."workspaceId", c."projectId", c."startMs", c."endMs",
               c."sourceSegKey", c."sourceSegStartMs", c."previewKey",
               u.key AS source_key, p."proxyKey"
        FROM clips c
        JOIN clip_projects p ON p.id = c."projectId"
        LEFT JOIN clip_uploads u ON u.id = p."uploadId"
        WHERE c.id = %s
        """,
        (clip_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    (
        cid,
        workspace_id,
        project_id,
        start_ms,
        _end_ms,
        source_seg_key,
        source_seg_start_ms,
        preview_key,
        source_key,
        proxy_key,
    ) = row
    ctx = {
        "clipId": cid,
        "workspaceId": workspace_id,
        "projectId": project_id,
        "startMs": start_ms,
        "sourceSegKey": source_seg_key,
        "sourceSegStartMs": source_seg_start_ms,
        "previewKey": preview_key,
        "source_key": source_key,
        "proxyKey": proxy_key,
    }
    key, source_offset_ms, reason = resolve_clip_export_source(ctx)
    if not key:
        return None
    off_s = max(0.0, (int(start_ms) - int(source_offset_ms)) / 1000.0)
    return key, off_s, reason


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=float, default=10.0)
    ap.add_argument("--out", default="/tmp/ef24_qc")
    ap.add_argument("--qualities", default="standard,detail")
    a = ap.parse_args()
    modal_env = os.environ.get("MODAL_ENVIRONMENT", "main")
    print(f"modal_env={modal_env}")
    import modal
    import psycopg2

    from clips_worker import storage
    from clips_worker.gpu_encode import _upload_signed_put_url

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    app_name = os.environ.get("MODAL_APP_NAME", "transovo-gpu")
    Matter = modal.Cls.from_name(app_name, "Matter")
    spent = 0.0
    with psycopg2.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        for cid in CLIPS:
            resolved = _resolve_clip_source(cur, cid)
            if not resolved:
                print(f"{cid}: no export source")
                continue
            key, off, reason = resolved
            print(f"{cid}: source={reason} key_tail={key[-48:]} off_s={off:.3f}")
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
