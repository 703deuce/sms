import json
from pathlib import Path

from clips_worker.streamer.urls import parse_stream_url

FIXTURE = Path(__file__).parent / "fixtures" / "stream_urls.json"


def test_stream_url_fixture_parity():
    cases = json.loads(FIXTURE.read_text())
    for row in cases:
        got = parse_stream_url(row["url"])
        exp = row["expect"]
        if exp.get("error") is True:
            assert "error" in got
        elif exp.get("error"):
            assert got.get("error") == exp["error"]
        else:
            assert got.get("error") is None
            for k, v in exp.items():
                assert got.get(k) == v
