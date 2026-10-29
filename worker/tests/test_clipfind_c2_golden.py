"""C2 no-regression goldens — capture on master before seam edits; assert under default / ALL_OFF / other project."""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from clips_worker.clipfind.context import bind_clipfind, unbind_clipfind
from clips_worker.picker.cleanup import finalize_picks
from clips_worker.picker.sentences import Sentence
from clips_worker.picker.signals import SentenceSignals
from clips_worker.streamer.boundaries import snap_fusion_pick
from clips_worker.streamer.fusion import fuse_moments

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "clipfind"
GOLDEN_FUSION = FIXTURES / "golden_fusion.json"
GOLDEN_SNAP = FIXTURES / "golden_fusion_snap.json"
GOLDEN_FINALIZE = FIXTURES / "golden_finalize.json"


def _flat(n: int, v: float = 0.12) -> list[float]:
    return [v] * n


def fusion_fixture_inputs() -> tuple[int, dict, list[dict], dict, list[dict]]:
    duration_s = 900
    audio = _flat(duration_s)
    video = _flat(duration_s)
    chat = _flat(duration_s, 0.05)
    for t in list(range(120, 140)) + list(range(300, 320)):
        audio[t] = 0.85
        video[t] = 0.75
    for t in range(568, 606):
        video[t] = 0.92
        audio[t] = 0.88
    for t in range(602, 612):
        chat[t] = 0.7
    words: list[dict] = []
    t = 565.0
    for tok in (
        "five kill streak rolling fury badge pops squad wiped chat goes insane celebration"
    ).split():
        words.append({"w": tok, "s": round(t, 3), "e": round(t + 0.28, 3)})
        t += 0.32
    video_moments = [
        {
            "start_ms": 120_000,
            "end_ms": 155_000,
            "peak_ms": 130_000,
            "what_happened": "Team fight win",
            "why_it_works": "Chaotic comeback",
        },
        {
            "start_ms": 568_000,
            "end_ms": 610_000,
            "peak_ms": 598_000,
            "what_happened": "Fury badge after five kill streak",
            "why_it_works": "Setup to badge payoff",
        },
        {
            "start_ms": 300_000,
            "end_ms": 335_000,
            "peak_ms": 310_000,
            "what_happened": "Clutch play",
            "why_it_works": "High tension",
        },
    ]
    settings = {
        "streamer": {"clipCount": 4, "minClipS": 15, "maxClipS": 60},
        "leadS": 20,
        "tailS": 10,
    }
    signals = {
        "audio": audio,
        "video": video,
        "chat": chat,
        "transcript": _flat(duration_s, 0.1),
        "viewerClips": None,
    }
    return duration_s, signals, words, settings, video_moments


def _serialize_fusion_picks(picks) -> list[dict]:
    out = []
    for p in picks:
        out.append(
            {
                "start_ms": int(p.start_ms),
                "end_ms": int(p.end_ms),
                "score": int(p.score),
                "ai_meta": p.ai_meta,
            }
        )
    return out


def _run_fusion_golden() -> list[dict]:
    duration_s, signals, words, settings, video_moments = fusion_fixture_inputs()
    picks, _ = fuse_moments(
        duration_s=duration_s,
        signals=signals,
        words=words,
        settings=settings,
        llm_ranker=None,
        video_moments=video_moments,
        transcript_ok=True,
    )
    return _serialize_fusion_picks(picks)


def _run_snap_golden() -> list[dict]:
    duration_s, signals, words, settings, video_moments = fusion_fixture_inputs()
    picks, _ = fuse_moments(
        duration_s=duration_s,
        signals=signals,
        words=words,
        settings=settings,
        llm_ranker=None,
        video_moments=video_moments,
        transcript_ok=True,
    )
    snapped = []
    for p in picks:
        sp = snap_fusion_pick(
            p,
            words,
            range_start_ms=0,
            range_end_ms=duration_s * 1000,
        )
        snapped.append(
            {
                "start_ms": int(sp.start_ms),
                "end_ms": int(sp.end_ms),
                "score": int(sp.score),
                "ai_meta": sp.ai_meta,
            }
        )
    return snapped


def finalize_fixture() -> tuple[list[dict], list[Sentence], dict, list[dict], int, int]:
    range_start_ms, range_end_ms = 0, 120_000
    sentences = [
        Sentence(0, 0, 35_000, "A", "intro line one two three.", 0, 5),
        Sentence(1, 35_000, 70_000, "A", "middle setup for the joke.", 6, 12),
        Sentence(2, 70_000, 95_000, "A", "punchline lands hard.", 13, 18),
    ]
    words = []
    t = 0.0
    for s in sentences:
        for w in s.text.split():
            words.append({"w": w, "s": round(t, 3), "e": round(t + 0.25, 3)})
            t += 0.28
    signals_by_idx = {
        0: SentenceSignals(0, 2.0, 0.1, 0.1, 0, 200, False, False, False, False),
        1: SentenceSignals(1, 2.2, 0.2, 0.1, 100, 150, False, False, False, False),
        2: SentenceSignals(2, 2.5, 0.5, 0.2, 80, 400, True, False, False, False),
    }
    scored = [
        {"start_sentence": 0, "end_sentence": 1, "score": 70, "final": 7.0, "title": "Setup", "archetype": "story"},
        {"start_sentence": 1, "end_sentence": 2, "score": 85, "final": 8.5, "title": "Joke", "archetype": "comedy"},
        {"start_sentence": 0, "end_sentence": 2, "score": 60, "final": 6.0, "title": "Long", "archetype": "story"},
    ]
    return scored, sentences, signals_by_idx, words, range_start_ms, range_end_ms


def _run_finalize_golden() -> list[dict]:
    scored, sentences, signals_by_idx, words, rs, re = finalize_fixture()
    picks = finalize_picks(
        scored,
        sentences,
        signals_by_idx,
        words,
        rs,
        re,
        "comedy_standup",
    )
    return [
        {
            "start_ms": int(p["start_ms"]),
            "end_ms": int(p["end_ms"]),
            "title": p.get("title"),
            "aiMeta": p.get("aiMeta"),
        }
        for p in picks
    ]


def _write_goldens() -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    GOLDEN_FUSION.write_text(json.dumps(_run_fusion_golden(), indent=2, sort_keys=True), encoding="utf-8")
    GOLDEN_SNAP.write_text(json.dumps(_run_snap_golden(), indent=2, sort_keys=True), encoding="utf-8")
    GOLDEN_FINALIZE.write_text(json.dumps(_run_finalize_golden(), indent=2, sort_keys=True), encoding="utf-8")


@pytest.fixture(autouse=True)
def _clipfind_ctx(monkeypatch):
    for name in (
        "CLIPFIND_ALL_OFF",
        "CLIPFIND_ON_PROJECTS",
        "CLIPFIND_ON_WORKSPACES",
        "CLIPFIND_SETUP_LOOKBACK",
        "CLIPFIND_REACTION_TAIL",
        "CLIPFIND_VARIANTS",
        "CLIPFIND_VALIDATE_WINDOW",
    ):
        monkeypatch.delenv(name, raising=False)
    unbind_clipfind()
    yield
    unbind_clipfind()


def _assert_golden(path: Path, actual: list[dict]) -> None:
    assert path.is_file(), f"missing golden {path}; run GENERATE_C2_GOLDEN=1 pytest once"
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
def test_fusion_golden_no_regression(monkeypatch, env: dict):
    for k, v in env.items():
        if k == "ctx_project":
            continue
        monkeypatch.setenv(k, v)
    proj = env.get("ctx_project", "proj_golden")
    bind_clipfind(workspace_id="ws_golden", job_type="STREAM_ANALYZE", project_id=proj)
    actual = _run_fusion_golden()
    _assert_golden(GOLDEN_FUSION, actual)


@pytest.mark.parametrize(
    "env",
    [
        {},
        {"CLIPFIND_ALL_OFF": "1"},
        {"CLIPFIND_ON_PROJECTS": "other_proj", "ctx_project": "proj_x"},
    ],
)
def test_fusion_snap_golden_no_regression(monkeypatch, env: dict):
    for k, v in env.items():
        if k == "ctx_project":
            continue
        monkeypatch.setenv(k, v)
    proj = env.get("ctx_project", "proj_golden")
    bind_clipfind(workspace_id="ws_golden", job_type="STREAM_ANALYZE", project_id=proj)
    actual = _run_snap_golden()
    _assert_golden(GOLDEN_SNAP, actual)


@pytest.mark.parametrize(
    "env",
    [
        {},
        {"CLIPFIND_ALL_OFF": "1"},
        {"CLIPFIND_ON_PROJECTS": "other_proj", "ctx_project": "proj_x"},
    ],
)
def test_finalize_golden_no_regression(monkeypatch, env: dict):
    for k, v in env.items():
        if k == "ctx_project":
            continue
        monkeypatch.setenv(k, v)
    proj = env.get("ctx_project", "proj_golden")
    bind_clipfind(workspace_id="ws_golden", job_type="PROCESS_PROJECT", project_id=proj)
    actual = _run_finalize_golden()
    _assert_golden(GOLDEN_FINALIZE, actual)


if os.environ.get("GENERATE_C2_GOLDEN") == "1":
    _write_goldens()
