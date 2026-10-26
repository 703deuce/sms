from pathlib import Path

from clips_worker.job_types import JOB_TYPES, job_types_sql_in
from clips_worker.main import DISPATCH


def test_dispatch_matches_job_types():
    assert set(JOB_TYPES) == set(DISPATCH)


def test_sql_includes_every_type():
    sql = job_types_sql_in()
    for t in JOB_TYPES:
        assert f"'{t}'" in sql


def test_main_sql_builders_use_job_types():
    src = Path(__file__).resolve().parents[1] / "clips_worker" / "main.py"
    text = src.read_text()
    assert "job_types_sql_in()" in text
    assert "JOB_TYPES" in text or "job_types" in text
