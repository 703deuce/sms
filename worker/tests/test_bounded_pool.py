import threading
import time

from clips_worker.bounded_pool import run_bounded_indexed_pool


def test_bounded_pool_preserves_result_order():
    def work(i: int) -> int:
        return i * 10

    out = run_bounded_indexed_pool(6, 2, work)
    assert out == [0, 10, 20, 30, 40, 50]


def test_on_start_fires_once_per_index_in_order():
    starts: list[int] = []
    lock = threading.Lock()

    def on_start(idx: int, total: int) -> None:
        with lock:
            starts.append(idx + 1)
        assert total == 4

    run_bounded_indexed_pool(4, 2, lambda i: i, on_start=on_start)
    assert sorted(starts) == [1, 2, 3, 4]


def test_pool_respects_concurrency_cap():
    active = 0
    peak = 0
    lock = threading.Lock()

    def work(_i: int) -> int:
        nonlocal active, peak
        with lock:
            active += 1
            peak = max(peak, active)
        time.sleep(0.05)
        with lock:
            active -= 1
        return 1

    run_bounded_indexed_pool(5, 2, work)
    assert peak <= 2
