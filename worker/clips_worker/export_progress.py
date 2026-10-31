"""FV4a: real export progress, liveness and cancellation for the full edits render.

Before FV4a the export reported fake steps (58, 62, 66, 70, 74 % over the first minute) and then
nothing while ffmpeg ran. A full-length 1080p video takes several full re-encode passes
(layout/blur-fit, crop/flip keyframes, captions, zoom, …), each tens of minutes on the worker's
per-slot thread budget, so the web watchdog saw "no progress for 20 min", requeued the job and the
original process kept rendering as an orphan next to the retry.

While a ``RenderProgress`` is installed (one job per slot process — slots are forked processes), a
tiny ``ffmpeg`` shim is put first on ``PATH``. It execs the real ffmpeg with ``-progress <dir>/<pid>.txt``
added as a global option and nothing else changed (stdout / stderr / pipes / -v untouched). Because it is
on PATH it also covers grandchildren: the speakercrop / blur-fit layout pass runs ffmpeg from a separate
Python process (prototype/v3), which is the longest pass of a full-length export. The tracker reads
``out_time_us`` from those files to report:

* ``step`` / ``steps``  — current heavy pass and the estimated pass count (``~``),
* ``step_pct``          — % of the current pass (ffmpeg output time / clip length),
* ``progress``          — overall 10–89 %, monotonic (FV4b bands: prep 0–10, encode 10–90, upload 90–100),
* ``eta_s``             — FV4b: elapsed ÷ encode fraction, smoothed; None until ~10 % of the encode,
* ``activity``          — a token that changes whenever ffmpeg advances or work files grow; the web
  watchdog treats a change as progress, so a long but healthy render is never "stalled".

``cancel(reason)`` terminates the running ffmpeg(s) and makes the next one refuse to start: used for
a lost claim (the watchdog / stale-lock recovery requeued the job), a worker-side stall (ffmpeg output
time not moving for ``FFMPEG_STALL_SEC``) and the hard cap (``RENDER_MAX_SECONDS``).
"""
from __future__ import annotations

import os
import re
import shutil
import signal
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path

_ACTIVE: "RenderProgress | None" = None

HEAVY_PASS_MIN_S = 15.0
# FV4b: one overall % for the whole export, from one render fraction per phase.
PREP_LO, PREP_HI = 0, 10
ENCODE_LO, ENCODE_HI = 10, 90
UPLOAD_LO, UPLOAD_HI = 90, 100
PROGRESS_LO = ENCODE_LO
PROGRESS_HI = ENCODE_HI - 1  # 90+ is reserved for the upload
ETA_MIN_FRAC = 0.10  # no ETA before 10 % of the encode work (too noisy)
ETA_UPLOAD_S = 30  # tail after the encode: post / upload / checks
ETA_SMOOTH = 0.3  # weight of a fresh estimate (the rest follows the running countdown)
_OUT_TIME_RE = re.compile(rb"out_time_(?:us|ms)=(\d+)")
_SHIM = """#!/bin/sh
d="$FV4A_PROGRESS_DIR"
if [ -n "$d" ] && [ -d "$d" ]; then
  if [ -e "$d/CANCEL" ]; then
    echo "ffmpeg not started: export canceled" >&2
    exit 255
  fi
  exec "{real}" -progress "$d/$$.txt" "$@"
fi
exec "{real}" "$@"
"""


class RenderCanceled(RuntimeError):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


CANCEL_MESSAGES = {
    "claim_lost": "This export was restarted elsewhere; this copy stopped.",
    "stalled": "The export stopped making progress (video processing froze). Please try again.",
    "timeout": "The export took longer than the maximum render time for this length. Please try again or export a shorter range.",
}


def cancel_message(reason: str) -> str:
    return CANCEL_MESSAGES.get(reason, f"Export stopped ({reason}).")


def overall_progress(phase: str, frac: float = 0.0) -> int:
    """FV4b: overall export % for ``phase`` ('prep' | 'encode' | 'upload' | 'done') at ``frac`` (0..1)."""
    if phase == "done":
        return 100
    lo, hi = {"prep": (PREP_LO, PREP_HI), "encode": (ENCODE_LO, ENCODE_HI), "upload": (UPLOAD_LO, UPLOAD_HI)}[phase]
    f = min(1.0, max(0.0, float(frac or 0.0)))
    return min(hi - 1, lo + int((hi - lo) * f))  # the band's top belongs to the next phase


class EtaSmoother:
    """FV4b: a stable ETA from elapsed time ÷ fraction done.

    raw = elapsed · (1 − f) / f (+ a fixed upload tail). Hidden until ``f ≥ ETA_MIN_FRAC``. Between
    updates the previous value counts down with wall time; a fresh raw estimate only pulls it by
    ``ETA_SMOOTH`` and may raise it by at most 15 % (+ 30 s) per update, so it can't jump 2 → 12 min.
    """

    def __init__(self, *, min_frac: float = ETA_MIN_FRAC, tail_s: float = ETA_UPLOAD_S, alpha: float = ETA_SMOOTH) -> None:
        self.min_frac = min_frac
        self.tail_s = tail_s
        self.alpha = alpha
        self._eta: float | None = None
        self._at: float | None = None

    def update(self, elapsed_s: float, frac: float, now: float) -> int | None:
        if frac < self.min_frac or elapsed_s <= 0:
            return None
        raw = elapsed_s * (1.0 - min(frac, 0.999)) / frac + self.tail_s
        if self._eta is None or self._at is None:
            eta = raw
        else:
            running = max(0.0, self._eta - max(0.0, now - self._at))
            eta = running + self.alpha * (raw - running)
            eta = min(eta, running * 1.15 + 30.0)
        self._eta, self._at = max(0.0, eta), now
        return int(round(self._eta))


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, "") or default)
    except ValueError:
        return default


def render_max_seconds(length_s: float) -> float:
    """Hard cap for one export: 15 min + RENDER_MAX_X (default 10) x the output length, 30 min..6 h."""
    explicit = os.environ.get("RENDER_MAX_SECONDS")
    if explicit:
        try:
            return max(60.0, float(explicit))
        except ValueError:
            pass
    x = _env_float("RENDER_MAX_X", 10.0)
    return min(6 * 3600.0, max(1800.0, 900.0 + x * max(0.0, length_s)))


def ffmpeg_stall_seconds() -> float:
    """No ffmpeg output-time / work-file movement for this long → the render is stuck (default 15 min)."""
    return max(60.0, _env_float("FFMPEG_STALL_SEC", 900.0))


def estimate_export_passes(edits: dict) -> int:
    """Heavy full-length re-encodes the full edits render will run (an estimate, shown as "~")."""
    from clips_worker.motion import has_layer_fx

    n = 2  # layout / blur-fit render + captions / compose
    if has_layer_fx(edits, "video"):
        n += 1
    if edits.get("transitions"):
        n += 1
    if edits.get("broll"):
        n += 1
    if edits.get("color"):
        n += 1
    if isinstance(edits.get("zoom"), dict) and edits["zoom"].get("enabled"):
        n += 1
    if edits.get("sourceSegments"):
        n += 1
    return n


def descendant_cpu_seconds(root_pid: int | None = None) -> float:
    """CPU seconds used by live descendants of this process (python layout pass, ffmpeg, …).

    Part of the activity token: the speakercrop face / voice analysis runs before its ffmpeg starts and
    writes nothing for minutes, but it burns CPU. A frozen ffmpeg burns none.
    """
    root = root_pid or os.getpid()
    try:
        tick = os.sysconf("SC_CLK_TCK")
    except (ValueError, OSError, AttributeError):
        tick = 100
    parent: dict[int, int] = {}
    cpu: dict[int, int] = {}
    try:
        entries = os.listdir("/proc")
    except OSError:
        return 0.0
    for name in entries:
        if not name.isdigit():
            continue
        try:
            with open(f"/proc/{name}/stat", "rb") as fh:
                raw = fh.read()
        except OSError:
            continue
        rest = raw[raw.rfind(b")") + 2:].split()
        try:
            pid = int(name)
            parent[pid] = int(rest[1])
            cpu[pid] = int(rest[11]) + int(rest[12])
        except (IndexError, ValueError):
            continue
    total = 0
    for pid in cpu:
        p, hops = parent.get(pid), 0
        while p and p != root and hops < 32:
            p, hops = parent.get(p), hops + 1
        if p == root and pid != root:
            total += cpu[pid]
    return total / float(tick or 100)


def _pid_alive_ffmpeg(pid: int) -> bool:
    try:
        with open(f"/proc/{pid}/cmdline", "rb") as fh:
            return b"ffmpeg" in fh.read()
    except OSError:
        return False


@dataclass
class _Pass:
    pid: int
    started: float
    path: Path
    ended: float | None = None
    out_us: int = 0

    def running_s(self, now: float) -> float:
        return (self.ended or now) - self.started


class RenderProgress:
    def __init__(
        self,
        length_s: float,
        est_passes: int,
        *,
        work_dir: Path | None = None,
        max_seconds: float | None = None,
        stall_seconds: float | None = None,
        clock=time.time,
        pid_alive=_pid_alive_ffmpeg,
        child_cpu=descendant_cpu_seconds,
    ) -> None:
        self.length_s = max(0.5, float(length_s or 0.5))
        self.est_passes = max(1, int(est_passes))
        self.work_dir = Path(work_dir) if work_dir else None
        self.max_seconds = max_seconds if max_seconds is not None else render_max_seconds(self.length_s)
        self.stall_seconds = stall_seconds if stall_seconds is not None else ffmpeg_stall_seconds()
        self._clock = clock
        self._pid_alive = pid_alive
        self._child_cpu = child_cpu
        self.t0 = clock()
        self.passes: dict[int, _Pass] = {}
        self.cancel_reason: str | None = None
        self._lock = threading.Lock()
        self._root = Path(tempfile.mkdtemp(prefix="fv4a_progress_"))
        self.progress_dir = self._root / "prog"
        self.progress_dir.mkdir()
        self._bin = self._root / "bin"
        self._bin.mkdir()
        self._last_progress = PROGRESS_LO
        self._last_frac = 0.0
        self._eta = EtaSmoother()
        self._last_activity: str | None = None
        self._last_activity_at = self.t0
        self._saved_env: dict[str, str | None] = {}
        self.installed = False

    # -- install / uninstall -------------------------------------------------------------------
    def __enter__(self) -> "RenderProgress":
        global _ACTIVE
        real = shutil.which("ffmpeg")
        if real and _ACTIVE is None:
            shim = self._bin / "ffmpeg"
            shim.write_text(_SHIM.format(real=real))
            shim.chmod(0o755)
            for k in ("PATH", "FV4A_PROGRESS_DIR"):
                self._saved_env[k] = os.environ.get(k)
            os.environ["PATH"] = f"{self._bin}{os.pathsep}{os.environ.get('PATH', '')}"
            os.environ["FV4A_PROGRESS_DIR"] = str(self.progress_dir)
            _ACTIVE = self
            self.installed = True
        return self

    def __exit__(self, *exc) -> None:
        global _ACTIVE
        if self.installed:
            for k, v in self._saved_env.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
            if _ACTIVE is self:
                _ACTIVE = None
            self.installed = False
        shutil.rmtree(self._root, ignore_errors=True)

    # -- passes --------------------------------------------------------------------------------
    @staticmethod
    def _read_tail(path: Path) -> bytes:
        try:
            with open(path, "rb") as fh:
                fh.seek(0, os.SEEK_END)
                size = fh.tell()
                fh.seek(max(0, size - 4096))
                return fh.read()
        except OSError:
            return b""

    def _scan(self, now: float) -> None:
        try:
            names = os.listdir(self.progress_dir)
        except OSError:
            return
        for name in names:
            if not name.endswith(".txt"):
                continue
            try:
                pid = int(name[:-4])
            except ValueError:
                continue
            p = self.passes.get(pid)
            if p is None:
                p = _Pass(pid=pid, started=now, path=self.progress_dir / name)
                self.passes[pid] = p
            if p.ended is not None:
                continue
            tail = self._read_tail(p.path)
            vals = _OUT_TIME_RE.findall(tail)
            if vals:
                p.out_us = max(p.out_us, int(vals[-1]))
            if b"progress=end" in tail or not self._pid_alive(pid):
                p.ended = now

    # -- cancel --------------------------------------------------------------------------------
    def cancel(self, reason: str) -> None:
        with self._lock:
            if self.cancel_reason:
                return
            self.cancel_reason = reason
            try:
                (self.progress_dir / "CANCEL").write_text(reason)
            except OSError:
                pass
            self._scan(self._clock())
            pids = [p.pid for p in self.passes.values() if p.ended is None]
        print(f"[clipper:export_progress] cancel reason={reason} running_ffmpeg={len(pids)}", flush=True)
        for pid in pids:
            self._signal(pid, signal.SIGTERM)

        def _kill_later(pids=pids):
            time.sleep(5)
            for pid in pids:
                self._signal(pid, signal.SIGKILL)

        if pids:
            threading.Thread(target=_kill_later, daemon=True).start()

    def _signal(self, pid: int, sig) -> None:
        if not self._pid_alive(pid):
            return
        try:
            os.kill(pid, sig)
        except OSError:
            pass

    def check(self) -> None:
        if self.cancel_reason:
            raise RenderCanceled(self.cancel_reason)

    # -- snapshot ------------------------------------------------------------------------------
    def _dir_bytes(self) -> int:
        if not self.work_dir:
            return 0
        total = 0
        try:
            for root, _dirs, files in os.walk(self.work_dir):
                for f in files[:500]:
                    try:
                        total += os.path.getsize(os.path.join(root, f))
                    except OSError:
                        pass
        except OSError:
            return 0
        return total

    def snapshot(self) -> dict:
        now = self._clock()
        with self._lock:
            self._scan(now)
            passes = sorted(self.passes.values(), key=lambda p: p.started)
            running = [p for p in passes if p.ended is None]
            heavy_done = [p for p in passes if p.ended is not None and p.running_s(now) >= HEAVY_PASS_MIN_S]
            cur = max(running, key=lambda p: p.out_us) if running else None
            cur_frac = min(0.99, (cur.out_us / 1e6) / self.length_s) if cur else 0.0
            cur_heavy = cur is not None and (cur.running_s(now) >= HEAVY_PASS_MIN_S or cur_frac > 0.02)
            work = len(heavy_done) + (cur_frac if cur_heavy else 0.0)
            step = len(heavy_done) + (1 if cur_heavy else 0)
            steps = max(self.est_passes, step)
            # FV4b: one monotonic encode fraction → overall % (10–89) and the ETA.
            frac = max(self._last_frac, min(0.99, work / max(float(steps), work + 0.25)))
            self._last_frac = frac
            progress = max(self._last_progress, min(PROGRESS_HI, overall_progress("encode", frac)))
            self._last_progress = progress
            eta = self._eta.update(now - self.t0, frac, now)
            out_s = int((cur.out_us if cur else 0) / 1e6)
            try:
                cpu_s = int(self._child_cpu() // 10)
            except Exception:
                cpu_s = 0
            activity = f"{len(passes)}:{out_s}:{self._dir_bytes() >> 20}:{cpu_s}"
        if activity != self._last_activity:
            self._last_activity = activity
            self._last_activity_at = now
        return {
            "step": max(1, step),
            "steps": steps,
            "step_pct": int(round(cur_frac * 100)) if cur_heavy else None,
            "progress": progress,
            "frac": round(frac, 4),
            "eta_s": eta,
            "activity": activity,
            "elapsed_s": int(now - self.t0),
            "idle_s": int(now - self._last_activity_at),
        }

    def tick(self) -> dict:
        """Snapshot + worker-side stall / hard-cap checks (cancels the render when exceeded)."""
        snap = self.snapshot()
        if not self.cancel_reason:
            if snap["elapsed_s"] > self.max_seconds:
                self.cancel("timeout")
            elif snap["idle_s"] > self.stall_seconds:
                self.cancel("stalled")
        return snap


def active() -> RenderProgress | None:
    return _ACTIVE


def cancel_active(reason: str) -> bool:
    tr = _ACTIVE
    if tr is None:
        return False
    tr.cancel(reason)
    return True
