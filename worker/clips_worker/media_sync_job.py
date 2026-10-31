"""E5 MEDIA_SYNC: audio-based sync of an uploaded angle to the project's main source.

Reuses the streamer verification aligner (clips_worker.streamer.align: PCM extraction, normalised
cross-correlation confidence / peak-ratio policy) at angle scale: FFT correlation of a probe window
from one file against the other (both directions, best wins).

Result → clip_project_media."syncOffsetMs" (angle media ms = main source ms + syncOffsetMs),
"syncConfidence", "syncStatus" ('done' | 'low_confidence' | 'failed'). Rooms angles never need this
(their host-clock offsets come from recording_tracks."actualStartHostMs").
"""
from __future__ import annotations

import tempfile
from pathlib import Path

import numpy as np

from clips_worker.streamer.align import _extract_pcm, _read_pcm

SR = 16000
REF_MAX_S = 240.0
PROBE_S = 20.0
# Same acceptance as streamer.align.apply_segment_align_policy.
MIN_CONFIDENCE = 0.6
MIN_PEAK_RATIO = 1.5


def _xcorr_find(ref: np.ndarray, probe: np.ndarray) -> tuple[int, float, float]:
    """Best lag (samples) of `probe` inside `ref`, normalised peak, peak ratio (vs ±0.5 s exclusion)."""
    n, m = len(ref), len(probe)
    if m < SR // 2 or n < m:
        return 0, 0.0, 0.0
    size = 1 << int(np.ceil(np.log2(n + m)))
    corr = np.fft.irfft(np.fft.rfft(ref, size) * np.conj(np.fft.rfft(probe, size)), size)[: n - m + 1]
    energy = np.concatenate([[0.0], np.cumsum(ref.astype(np.float64) ** 2)])
    win = np.sqrt(np.maximum(energy[m:] - energy[:-m], 1e-12))[: n - m + 1]
    norm = corr / (win * (np.linalg.norm(probe) + 1e-9))
    best = int(np.argmax(norm))
    peak = float(norm[best])
    mask = np.ones_like(norm, dtype=bool)
    mask[max(0, best - SR // 2): best + SR // 2] = False
    second = float(norm[mask].max()) if mask.any() else 0.0
    return best, peak, peak / (max(second, 0.0) + 1e-9)


def _probe_duration(path: Path) -> float:
    import subprocess

    try:
        return float(
            subprocess.check_output(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], text=True
            ).strip()
        )
    except (subprocess.CalledProcessError, ValueError, OSError):
        return 0.0


def estimate_sync_ms(main: Path, angle: Path) -> tuple[int, float, float]:
    """(syncMs, confidence, peak_ratio): angle media ms = main ms + syncMs."""
    with tempfile.TemporaryDirectory() as td:
        tdp = Path(td)
        main_dur = _probe_duration(main) or REF_MAX_S
        angle_dur = _probe_duration(angle) or REF_MAX_S

        def pcm(src: Path, a: float, b: float, name: str) -> np.ndarray:
            out = tdp / name
            _extract_pcm(src, a, b, out)
            return _read_pcm(out)

        best: tuple[int, float, float] = (0, 0.0, 0.0)
        # Probe from the angle, found in the main track.
        a0 = min(10.0, max(0.0, angle_dur / 3))
        probe = pcm(angle, a0, min(angle_dur, a0 + PROBE_S), "pa.pcm")
        ref = pcm(main, 0.0, min(main_dur, REF_MAX_S), "rm.pcm")
        lag, conf, ratio = _xcorr_find(ref, probe)
        if conf > best[1]:
            best = (int(round(a0 * 1000 - lag * 1000 / SR)), conf, ratio)
        # Probe from the main track, found in the angle (angle started earlier).
        m0 = min(10.0, max(0.0, main_dur / 3))
        probe = pcm(main, m0, min(main_dur, m0 + PROBE_S), "pm.pcm")
        ref = pcm(angle, 0.0, min(angle_dur, REF_MAX_S), "ra.pcm")
        lag, conf, ratio = _xcorr_find(ref, probe)
        if conf > best[1]:
            best = (int(round(lag * 1000 / SR - m0 * 1000)), conf, ratio)
        return best


def run_media_sync_job(conn, job: dict) -> None:
    from clips_worker.storage import download_object

    payload = job.get("payload") or {}
    if isinstance(payload, str):
        import json

        payload = json.loads(payload or "{}")
    media_id = str(payload.get("mediaId") or "")
    project_id = str(job.get("projectId") or "")
    with conn.cursor() as cur:
        cur.execute(
            'SELECT m."uploadId", m."workspaceId", u.key, pu.key FROM clip_project_media m '
            'JOIN clip_uploads u ON u.id = m."uploadId" AND u."workspaceId" = m."workspaceId" '
            'JOIN clip_projects p ON p.id = m."projectId" '
            'JOIN clip_uploads pu ON pu.id = p."uploadId" '
            'WHERE m.id = %s AND m."projectId" = %s',
            (media_id, project_id),
        )
        row = cur.fetchone()
    status, offset, conf = "failed", None, None
    try:
        if not row:
            raise RuntimeError("media_or_main_source_missing")
        with tempfile.TemporaryDirectory() as td:
            tdp = Path(td)
            main_p, angle_p = tdp / "main.bin", tdp / "angle.bin"
            download_object(row[3], main_p)
            download_object(row[2], angle_p)
            offset, conf, ratio = estimate_sync_ms(main_p, angle_p)
            status = "done" if conf >= MIN_CONFIDENCE and ratio >= MIN_PEAK_RATIO else "low_confidence"
            print(f"[clipper:media_sync] media={media_id} offset_ms={offset} conf={conf:.3f} ratio={ratio:.2f}", flush=True)
    finally:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE clip_project_media SET "syncOffsetMs" = %s, "syncConfidence" = %s, "syncStatus" = %s '
                'WHERE id = %s AND "projectId" = %s',
                (offset, conf, status, media_id, project_id),
            )
        conn.commit()
