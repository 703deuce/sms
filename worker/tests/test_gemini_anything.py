import json
from unittest.mock import MagicMock, patch

from clips_worker.gemini import rank_clipanything_candidates


def test_rank_parses_schema_array():
    payload = [
        {
            "candidateId": "c0",
            "start": 10.0,
            "end": 40.0,
            "title": "Big moment",
            "reason": "hook",
            "hook": "surprise",
            "action": "jump",
            "payoff": "cheer",
            "score": 88,
        }
    ]
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": json.dumps(payload)}]}}],
        "usageMetadata": {"promptTokenCount": 100, "candidatesTokenCount": 50},
    }
    conn = MagicMock()
    conn.cursor.return_value.__enter__ = lambda s: s
    conn.cursor.return_value.__exit__ = lambda *a: None
    with patch("clips_worker.gemini.requests.post", return_value=mock_resp):
        with patch("clips_worker.gemini.discover_model", return_value="gemini-flash-lite-latest"):
            with patch("clips_worker.gemini._key", return_value="test"):
                out = rank_clipanything_candidates(
                    conn,
                    workspace_id="ws_1",
                    project_id="proj_1",
                    candidates=[
                        {
                            "id": "c0",
                            "start_s": 0,
                            "end_s": 30,
                            "transcript": "wow",
                            "frames": [{"index": 0, "jpeg": b"\xff\xd8\xff"}],
                        }
                    ],
                    user_prompt="funny reactions",
                )
    assert out[0]["candidateId"] == "c0"
    assert out[0]["score"] == 88
