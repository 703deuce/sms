"""Run indexed tasks with bounded concurrency; results preserve input order."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, TypeVar

R = TypeVar("R")


def run_bounded_indexed_pool(
    count: int,
    max_workers: int,
    worker: Callable[[int], R],
    on_start: Callable[[int, int], None] | None = None,
    on_complete: Callable[[int, R | None], None] | None = None,
    index_order: list[int] | None = None,
) -> list[R]:
    if count <= 0:
        return []
    workers = max(1, max_workers)
    results: list[R | None] = [None] * count
    order = index_order if index_order is not None else list(range(count))

    def _task(idx: int) -> tuple[int, R]:
        if on_start is not None:
            on_start(idx, count)
        return idx, worker(idx)

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(_task, i) for i in order if 0 <= i < count]
        for fut in as_completed(futures):
            idx, row = fut.result()
            results[idx] = row
            if on_complete is not None:
                on_complete(idx, row)
    return [row for row in results if row is not None]
