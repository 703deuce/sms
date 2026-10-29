"""C3 no-regression goldens — captured on master before C3 seam behavior; flags-off path unchanged."""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from clips_worker.clipfind.context import bind_clipfind, unbind_clipfind
from clips_worker.streamer.llm_rank import SCHEMA, _load_prompt, rank_candidates_batch

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "clipfind"
GOLDEN_RANK = FIXTURES / "golden_c3_rank.json"
GOLDEN_LLM_BATCH = FIXTURES / "golden_c3_llm_batch.json"


def _flat(n: int, v: float = 0.12) -> list[float]:
    return [v] * n


def rank_fixture():
    duration_ms = 600_000
    duration_s = 600
    audio = _flat(duration_s)
    transcript = _flat(duration_s, 0.1)
    reaction = _flat(duration_s, 0.05)
    for t in range(120, 140):
        audio[t] = 0.85
    for t in range(300, 320):
        audio[t] = 0.9
    words = []
    t = 118.0
    for i in range(80):
        words.append({"w": f"w{i}", "s": round(t, 3), "e": round(t + 0.25, 3)})
        t += 0.35
    video_moments = [
        {
            "start_ms": 120_000,
            "end_ms": 155_000,
            "peak_ms": 130_000,
            "what_happened": "A",
            "why_it_works": "B",
        },
        {
            "start_ms": 300_000,
            "end_ms": 335_000,
            "peak_ms": 310_000,
            "what_happened": "C",
            "why_it_works": "D",
        },
        {
            "start_ms": 450_000,
            "end_ms": 480_000,
            "peak_ms": 465_000,
            "what_happened": "E",
            "why_it_works": "F",
        },
    ]
    chat_messages = []
    for sec in (125, 126, 127, 305, 306):
        chat_messages.append({"timestamp": sec * 1000, "text": "!clip moment", "user": "u1"})
    viewer_clips = [
        {"vod_offset_s": 300, "duration_s": 20, "id": "vc1"},
        {"vod_offset_s": 300, "duration_s": 20, "id": "vc2"},
    ]
    settings = {
        "streamer": {"clipCount": 4, "minClipS": 15, "maxClipS": 60},
        "leadS": 20,
        "tailS": 10,
    }

    def fake_ranker(candidates, words, signals):
        rows = []
        for c in candidates:
            rows.append(
                {
                    "id": c["id"],
                    "score": 75,
                    "keep": True,
                    "category": "funny",
                    "title": "Test moment",
                    "hook": "hook",
                    "setup_start_s": c["start_ms"] / 1000 - 5,
                    "payoff_end_s": c["end_ms"] / 1000,
                }
            )
        return rows

    return (
        duration_ms,
        words,
        settings,
        video_moments,
        chat_messages,
        viewer_clips,
        audio,
        transcript,
        reaction,
        fake_ranker,
    )


def _run_rank_golden() -> dict:
    from clips_worker.streamer.rank import rank_moments

    (
        duration_ms,
        words,
        settings,
        video_moments,
        chat_messages,
        viewer_clips,
        audio,
        transcript,
        reaction,
        fake_ranker,
    ) = rank_fixture()
    picks, payload = rank_moments(
        audio_path=Path("/dev/null"),
        words=words,
        duration_ms=duration_ms,
        settings=settings,
        llm_ranker=fake_ranker,
        use_llm=True,
        chat_messages=chat_messages,
        viewer_clips=viewer_clips,
        vod_signal_curves={
            "audio": audio,
            "transcript": transcript,
            "reaction": reaction,
            "speakerChange": _flat(600, 0.0),
        },
        video_moments=video_moments,
        transcript_ok=True,
    )
    return {
        "picks": [
            _normalize_pick_meta(
                {
                    "start_ms": p.start_ms,
                    "end_ms": p.end_ms,
                    "score": p.score,
                    "ai_meta": p.ai_meta,
                }
            )
            for p in picks
        ],
        "clipCues": payload.get("clipCues"),
    }


def _normalize_pick_meta(row: dict) -> dict:
    am = dict(row.get("ai_meta") or {})
    cf = dict(am.get("clipfind") or {})
    cf.pop("cf_id", None)
    am["clipfind"] = cf
    row = dict(row)
    row["ai_meta"] = am
    return row


def _run_llm_batch_golden() -> dict:
    captured: dict = {}

    def fake_chat_json(system, user, schema, label):
        captured["system"] = system
        captured["schema"] = schema
        captured["label"] = label
        return {
            "candidates": [
                {
                    "id": "cand_0",
                    "score": 70,
                    "keep": True,
                    "title": "t",
                    "hook": "h",
                    "category": "funny",
                    "suggestedCaption": None,
                    "hashtags": [],
                    "setup_start_s": 10.0,
                    "payoff_end_s": 40.0,
                }
            ]
        }

    batch = [
        {
            "id": "cand_0",
            "start_ms": 120_000,
            "end_ms": 155_000,
            "peak_ms": 130_000,
            "signal_peak": 0.7,
        }
    ]
    import clips_worker.picker.llm as llm_mod
    import clips_worker.streamer.llm_rank as llm_rank_mod
    from unittest import mock

    with mock.patch.object(llm_mod, "chat_json", fake_chat_json), mock.patch.object(
        llm_rank_mod, "chat_json", fake_chat_json
    ):
        rank_candidates_batch(batch, [], {"audio": [0.1] * 600})
    return {
        "system": captured.get("system"),
        "schema_is_llm_rank_schema": captured.get("schema") is SCHEMA,
        "label": captured.get("label"),
        "prompt_is_stream_moments": captured.get("system") == _load_prompt(),
    }


def _write_goldens() -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    GOLDEN_RANK.write_text(json.dumps(_run_rank_golden(), indent=2, default=str), encoding="utf-8")
    GOLDEN_LLM_BATCH.write_text(json.dumps(_run_llm_batch_golden(), indent=2), encoding="utf-8")


@pytest.fixture(autouse=True)
def _clipfind_ctx(monkeypatch):
    for name in (
        "CLIPFIND_ALL_OFF",
        "CLIPFIND_ON_PROJECTS",
        "CLIPFIND_ON_WORKSPACES",
    ):
        monkeypatch.delenv(name, raising=False)
    unbind_clipfind()
    yield
    unbind_clipfind()


def _assert_golden(path: Path, actual: dict) -> None:
    assert path.is_file(), f"missing golden {path}; run GENERATE_C3_GOLDEN=1 pytest once"
    expected = json.loads(path.read_text(encoding="utf-8"))
    assert actual == expected


@pytest.mark.parametrize(
    "env",
    [
        {},
        {"CLIPFIND_ALL_OFF": "1"},
        {"CLIPFIND_ON_PROJECTS": "other_proj", "ctx_project": "proj_x"},
    ],
)
def test_rank_moments_golden_no_regression(monkeypatch, env: dict):
    for k, v in env.items():
        if k == "ctx_project":
            continue
        monkeypatch.setenv(k, v)
    proj = env.get("ctx_project", "proj_golden")
    bind_clipfind(workspace_id="ws_golden", job_type="STREAM_ANALYZE", project_id=proj)
    actual = _run_rank_golden()
    _assert_golden(GOLDEN_RANK, actual)


@pytest.mark.parametrize(
    "env",
    [
        {},
        {"CLIPFIND_ALL_OFF": "1"},
        {"CLIPFIND_ON_PROJECTS": "other_proj", "ctx_project": "proj_x"},
    ],
)
def test_llm_rank_batch_golden_no_regression(monkeypatch, env: dict):
    for k, v in env.items():
        if k == "ctx_project":
            continue
        monkeypatch.setenv(k, v)
    proj = env.get("ctx_project", "proj_golden")
    bind_clipfind(workspace_id="ws_golden", job_type="STREAM_ANALYZE", project_id=proj)
    actual = _run_llm_batch_golden()
    _assert_golden(GOLDEN_LLM_BATCH, actual)


if os.environ.get("GENERATE_C3_GOLDEN") == "1":
    _write_goldens()
