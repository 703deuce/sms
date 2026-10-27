import json
from unittest.mock import MagicMock, patch

from clips_worker.clip_anything_vision import (
    primary_vision_model,
    rank_clipanything_candidates_resilient,
    rank_clipanything_openai,
)


def test_primary_vision_model_default(monkeypatch):
    monkeypatch.delenv("CLIP_ANYTHING_VISION_MODEL", raising=False)
    assert primary_vision_model() == "gpt-6-luna"


def test_resilient_uses_openai_when_configured(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    conn = MagicMock()
    conn.cursor.return_value.__enter__ = lambda s: s
    conn.cursor.return_value.__exit__ = lambda *a: None
    ranked = [{"candidateId": "c0", "score": 90}]
    with patch(
        "clips_worker.clip_anything_vision.rank_clipanything_openai",
        return_value=ranked,
    ) as openai_rank:
        out = rank_clipanything_candidates_resilient(
            conn,
            workspace_id="ws",
            project_id="p1",
            candidates=[{"id": "c0", "start_s": 0, "end_s": 10, "transcript": "hi", "frames": []}],
            user_prompt="",
        )
    assert out == ranked
    openai_rank.assert_called_once()


def test_resilient_falls_back_to_gemini(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    conn = MagicMock()
    gemini_out = [{"candidateId": "c0", "score": 80}]

    def fail_openai(*_a, **_k):
        raise RuntimeError("timeout")

    with patch("clips_worker.clip_anything_vision.rank_clipanything_openai", side_effect=fail_openai):
        with patch("clips_worker.gemini.rank_clipanything_candidates", return_value=gemini_out) as gemini_rank:
            out = rank_clipanything_candidates_resilient(
                conn,
                workspace_id="ws",
                project_id="p1",
                candidates=[{"id": "c0", "start_s": 0, "end_s": 10, "transcript": "hi", "frames": []}],
                user_prompt="",
            )
    assert out == gemini_out
    gemini_rank.assert_called_once()


def test_openai_parses_clips_wrapper(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    payload = {
        "clips": [
            {
                "candidateId": "c0",
                "start": 0,
                "end": 30,
                "title": "T",
                "reason": "r",
                "hook": "h",
                "action": "a",
                "payoff": "p",
                "score": 91,
            }
        ]
    }
    body = json.dumps(
        {
            "choices": [{"message": {"content": json.dumps(payload)}}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 20},
        }
    ).encode()

    class Resp:
        def read(self):
            return body

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    conn = MagicMock()
    conn.cursor.return_value.__enter__ = lambda s: s
    conn.cursor.return_value.__exit__ = lambda *a: None
    with patch("urllib.request.urlopen", return_value=Resp()):
        out = rank_clipanything_openai(
            conn,
            workspace_id="ws",
            project_id="p1",
            candidates=[
                {
                    "id": "c0",
                    "start_s": 0,
                    "end_s": 30,
                    "transcript": "wow",
                    "frames": [{"index": 0, "jpeg": b"\xff\xd8\xff"}],
                }
            ],
            user_prompt="",
            model="gpt-6-luna",
        )
    assert out[0]["candidateId"] == "c0"
    assert out[0]["score"] == 91
