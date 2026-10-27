from clips_worker.picker_stats import (
    log_project_pass2_stats,
    record_pass2_batch_ok,
    record_pass2_heuristic_fallback,
)


def test_log_project_pass2_stats(capsys):
    record_pass2_batch_ok("p2", moments_scored=3)
    record_pass2_heuristic_fallback("p2")
    log_project_pass2_stats("p2")
    out = capsys.readouterr().out
    assert "[clipper:pass2] project_summary" in out
    assert "batch_ok=1" in out
    assert "heuristic_fallback=1" in out
    assert "fallback_rate=0.500" in out
