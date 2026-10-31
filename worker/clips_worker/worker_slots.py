"""E6: run N job slots per worker container (default lane 2, stream lane 1).

Before E6 ``main()`` was one synchronous loop: claim -> run to completion -> claim. One long
PROCESS_PROJECT (or a burst of RENDER_CLIP jobs) held every other job in QUEUED for 30-47 min.
Each slot is a forked process running the unchanged poll loop with its own instance id
(``{WORKER_ID}:{hex}-s{k}``), so claims stay ``FOR UPDATE SKIP LOCKED``-safe, heartbeats and the
boot-recovery prefix (``{WORKER_ID}:%``) keep working, and a crash in one job cannot take the
others' memory with it.
"""
from __future__ import annotations

import multiprocessing as mp
import os
import signal
import sys
import time
from typing import Callable

from clips_worker.render_concurrency import worker_concurrency


def log(msg: str) -> None:
    print(msg, flush=True)


def slot_instance_id(parent_instance: str, slot: int) -> str:
    return f"{parent_instance}-s{slot}"


def _child(slot: int, parent_instance: str, target: Callable[[], None]) -> None:
    import threading

    from clips_worker import worker_drain, worker_identity

    # Fresh per-slot identity + drain state (the fork copied the parent's).
    worker_identity._INSTANCE_ID = slot_instance_id(parent_instance, slot)
    worker_drain._drain = threading.Event()
    worker_drain._installed = False
    worker_drain.install_drain_handlers()
    log(f"[clipper:worker] slot={slot} instance={worker_identity._INSTANCE_ID} pid={os.getpid()}")
    target()


def run_slots(
    target: Callable[[], None],
    parent_instance: str,
    n: int | None = None,
    max_wait_s: float | None = None,
) -> int:
    """Fork ``n`` slots running ``target`` and supervise them. Returns the exit code to use.

    ``max_wait_s`` (tests only; prod passes None) drains + kills the group after that long so a
    wedged child can never hang the caller forever.
    """
    from clips_worker.worker_drain import drain_timeout_sec

    n = n or worker_concurrency()
    ctx = mp.get_context("fork")
    procs: list[mp.process.BaseProcess] = []
    for k in range(n):
        p = ctx.Process(target=_child, args=(k, parent_instance, target), name=f"clips-slot-{k}", daemon=False)
        p.start()
        procs.append(p)

    draining = {"on": False}

    def _forward(signum, _frame) -> None:
        if not draining["on"]:
            log(f"[clipper:worker] drain requested signal={signum} -> forwarding to {len(procs)} slots")
        draining["on"] = True
        for p in procs:
            if p.is_alive() and p.pid:
                try:
                    os.kill(p.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass

    signal.signal(signal.SIGTERM, _forward)
    signal.signal(signal.SIGINT, _forward)

    deadline: float | None = None
    hard_stop = time.monotonic() + max_wait_s if max_wait_s else None
    while True:
        alive = [p for p in procs if p.is_alive()]
        if not alive:
            break
        if hard_stop is not None and not draining["on"] and time.monotonic() > hard_stop:
            log("[clipper:worker] max_wait_s reached -> draining all slots")
            _forward(signal.SIGTERM, None)
            deadline = time.monotonic() + 5
        if not draining["on"]:
            dead = [p for p in procs if not p.is_alive() and (p.exitcode or 0) != 0]
            if dead:
                # Same contract as the single loop's sys.exit(1): let the orchestrator restart us.
                log(f"[clipper:worker] slot {dead[0].name} exited code={dead[0].exitcode} -> stopping all slots")
                _forward(signal.SIGTERM, None)
        if draining["on"] and deadline is None:
            deadline = time.monotonic() + drain_timeout_sec()
        if deadline is not None and time.monotonic() > deadline:
            for p in alive:
                log(f"[clipper:worker] slot {p.name} did not drain in time -> kill")
                p.kill()
            break
        time.sleep(0.5)
    for p in procs:
        p.join(timeout=5)
    codes = [p.exitcode or 0 for p in procs]
    return next((c for c in codes if c not in (0, -signal.SIGTERM)), 0)


def maybe_run_slots(target: Callable[[], None], parent_instance: str) -> None:
    """Single slot: run inline (exactly the pre-E6 behaviour). More: fork + supervise."""
    n = worker_concurrency()
    if n <= 1:
        target()
        return
    log(f"[clipper:worker] starting {n} job slots (WORKER_CONCURRENCY)")
    sys.exit(run_slots(target, parent_instance, n))
