"""Run indexed tasks with bounded concurrency; results preserve input order."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Callable, TypeVar

R = TypeVar("R")


def run_bounded_indexed_pool(
    count: int,
    max_workers: int,
    worker: Callable[[int], R],
    on_start: Callable[[int, int], None] | None = None,
) -> list[R]:
    if count <= 0:
        return []
    workers = max(1, max_workers)

    def _task(idx: int) -> tuple[int, R]:
        if on_start is not None:
            on_start(idx, count)
        return idx, worker(idx)

    with ThreadPoolExecutor(max_workers=workers) as executor:
        pairs = list(executor.map(_task, range(count)))
    pairs.sort(key=lambda p: p[0])
    return [row for _, row in pairs]
