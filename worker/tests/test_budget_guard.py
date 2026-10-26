import os
from datetime import datetime, timezone
from unittest.mock import MagicMock

from clips_worker.gpu import budget


def test_allow_false_at_95_percent(monkeypatch):
    monkeypatch.setenv("MODAL_MONTHLY_BUDGET_USD", "30")
    budget._cache_until = 0
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    # 30 * 0.95 * 1e6 = 28_500_000 micros
    cur.fetchone.return_value = (29_000_000,)
    assert budget.allow(conn) is False
