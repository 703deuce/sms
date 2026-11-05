"""EF-24: on-demand RVM matte for an export (Modal Matter), reuse by content hash, DB rows, reframe replay."""
from __future__ import annotations

import hashlib
import json
import subprocess
import time
import uuid
from pathlib import Path

L4_USD_PER_GPU_S = 0.000222
CHUNK_S = 20.0
PREROLL_S = 1.0
MAX_WINDOW_S = 3600.0


class MatteSkip(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _file_sha(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def _probe(p: Path) -> tuple[float, float]:
    out = json.loads(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=r_frame_rate:format=duration",
                "-of",
                "json",
                str(p),
            ]
        )
    )
    n, d = (out["streams"][0].get("r_frame_rate") or "30/1").split("/")
    fps = float(n) / float(d or 1) if float(d or 1) else 30.0
    return float(out["format"]["duration"]), round(fps if 1 <= fps <= 120 else 30.0, 3)


def plan_chunks(dur_s: float, chunk_s: float = CHUNK_S, preroll_s: float = PREROLL_S) -> list[tuple[float, float, float]]:
    out, t = [], 0.0
    while t < dur_s - 1e-3:
        d = min(chunk_s, dur_s - t)
        out.append((round(t, 3), round(d, 3), round(min(preroll_s, t), 3)))
        t += d
    return out


def _upload_put_url(object_key: str) -> str:
    from clips_worker.gpu_encode import _upload_signed_put_url

    return _upload_signed_put_url(object_key)


def _find_ready(conn, clip_id: str, params_hash: str) -> tuple[str, str] | None:
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, "storageKey" FROM ai_generations
               WHERE "clipId" = %s AND kind = 'BG_MATTE' AND status = 'READY' AND params->>'hash' = %s
               ORDER BY "createdAt" DESC LIMIT 1""",
            (clip_id, params_hash),
        )
        row = cur.fetchone()
    return (row[0], row[1]) if row else None


def _insert_generation(conn, gen_id, workspace_id, clip_id, params) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO ai_generations (id, "workspaceId", "clipId", kind, status, provider, prompt, params, "updatedAt")
               VALUES (%s, %s, %s, 'BG_MATTE', 'RUNNING', 'modal', 'bg_matte', %s::jsonb, now())""",
            (gen_id, workspace_id, clip_id, json.dumps(params)),
        )
    conn.commit()


def _finish_generation(conn, gen_id, status, *, storage_key=None, params=None, cost=None, error=None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE ai_generations SET status = %s, "storageKey" = COALESCE(%s, "storageKey"),
               params = COALESCE(%s::jsonb, params), "costUsd" = COALESCE(%s, "costUsd"), error = %s, "updatedAt" = now()
               WHERE id = %s""",
            (status, storage_key, json.dumps(params) if params is not None else None, cost, error, gen_id),
        )
    conn.commit()


def _usage_row(conn, workspace_id, project_id, clip_id, gen_id, gpu_s: float) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO ai_usage (id, "workspaceId", "projectId", "clipId", "generationId", provider, model, units, "unitType", "costUsdMicros")
               VALUES (%s, %s, %s, %s, %s, 'modal', 'L4:bg_matte', %s, 'gpu_seconds', %s)""",
            (
                f"use_{uuid.uuid4().hex}",
                workspace_id,
                project_id,
                clip_id,
                gen_id,
                gpu_s,
                int(round(gpu_s * L4_USD_PER_GPU_S * 1e6)),
            ),
        )
    conn.commit()


def ensure_matte(
    conn,
    clip_src: Path,
    work_dir: Path,
    *,
    workspace_id: str,
    project_id: str,
    clip_id: str,
    quality: str,
    preview_fingerprint: str = "",
    stage=lambda *a, **k: None,
) -> tuple[Path, str]:
    from clips_worker import storage
    from clips_worker.bg_removal import bg_matte_provider
    from clips_worker.gpu import budget
    from clips_worker.gpu.modal_provider import ModalProvider

    if bg_matte_provider() == "cpu":
        raise MatteSkip("cpu_fallback_not_built")
    dur_s, fps = _probe(clip_src)
    if dur_s > MAX_WINDOW_S:
        raise MatteSkip("too_long")
    model = "rvm_resnet50" if quality == "detail" else "rvm_mobilenetv3"
    src_sha = _file_sha(clip_src)
    params_hash = hashlib.sha256(f"{src_sha}|{quality}|{model}|v1|{preview_fingerprint}".encode()).hexdigest()[:32]
    out = work_dir / "bg_matte.mp4"
    hit = _find_ready(conn, clip_id, params_hash)
    if hit:
        storage.download_object(hit[1], out)
        stage("bg_matte_reused", generationId=hit[0])
        return out, hit[0]
    if not budget.allow(conn):
        raise MatteSkip("budget_exceeded")
    gen_id = f"gen_{uuid.uuid4().hex}"
    base = f"ws/{workspace_id}/projects/{project_id}/bg-matte/{gen_id}"
    params = {
        "hash": params_hash,
        "srcSha": src_sha,
        "quality": quality,
        "previewFingerprint": preview_fingerprint or None,
        "model": model,
        "modelVersion": "53d74c6",
        "durS": dur_s,
        "fps": fps,
    }
    _insert_generation(conn, gen_id, workspace_id, clip_id, params)
    t0 = time.time()
    try:
        src_key = f"{base}_src.mp4"
        storage.upload_file(src_key, clip_src, "video/mp4")
        src_url = storage.sign_url(src_key)
        chunks = plan_chunks(dur_s)
        items = [
            {
                "src_url": src_url,
                "start_s": s,
                "dur_s": d,
                "preroll_s": p,
                "fps": fps,
                "short_side": 1080,
                "quality": quality,
                "median": True,
                "out_upload_url": _upload_put_url(f"{base}_c{i:03d}.mp4"),
            }
            for i, (s, d, p) in enumerate(chunks)
        ]
        stage("bg_matte_modal_start", chunks=len(items))
        try:
            res = ModalProvider().matte(items)
        except TimeoutError:
            res = ModalProvider().matte(items)
        if not res or not all(r.get("ok") for r in res):
            raise MatteSkip("gpu_error")
        parts = []
        for i, _ in enumerate(items):
            pth = work_dir / f"bg_matte_c{i:03d}.mp4"
            storage.download_object(f"{base}_c{i:03d}.mp4", pth)
            parts.append(pth)
        lst = work_dir / "bg_matte_concat.txt"
        lst.write_text("".join(f"file '{p}'\n" for p in parts))
        subprocess.check_call(
            ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)]
        )
        storage.upload_file(f"{base}.mp4", out, "video/mp4")
        gpu_s = sum(float(r.get("gpu_seconds") or 0) for r in res)
        frames = sum(int(r.get("frames") or 0) for r in res)
        mean_a = sum(float(r.get("mean_alpha") or 0) * int(r.get("frames") or 0) for r in res) / max(1, frames)
        params["stats"] = {
            "frames": frames,
            "gpuSeconds": round(gpu_s, 2),
            "meanAlpha": round(mean_a, 4),
            "provider": "modal",
            "wallS": round(time.time() - t0, 1),
            "warning": "no_subject" if mean_a < 0.005 else None,
        }
        cost = round(gpu_s * L4_USD_PER_GPU_S, 4)
        _finish_generation(conn, gen_id, "READY", storage_key=f"{base}.mp4", params=params, cost=cost)
        _usage_row(conn, workspace_id, project_id, clip_id, gen_id, gpu_s)
        stage("bg_matte_ready", generationId=gen_id, frames=frames, gpuSeconds=round(gpu_s, 2), costUsd=cost)
        return out, gen_id
    except MatteSkip as e:
        _finish_generation(conn, gen_id, "FAILED", error=e.code)
        raise
    except Exception as e:  # noqa: BLE001
        _finish_generation(conn, gen_id, "FAILED", error=f"gpu_error:{type(e).__name__}")
        raise MatteSkip("gpu_error") from e


def reframe_matte_like_main(matte: Path, clip_src: Path, out: Path, work_dir: Path, replay) -> Path:
    av = work_dir / "bg_matte_av.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(matte),
            "-i",
            str(clip_src),
            "-map",
            "0:v",
            "-map",
            "1:a?",
            "-c",
            "copy",
            "-shortest",
            str(av),
        ]
    )
    replay(av, out)
    return out
