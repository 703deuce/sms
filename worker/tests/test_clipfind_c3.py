"""C3a pure-module tests (judge, payoff markers, dense orchestration, eval scorer). No network, no flags."""
from __future__ import annotations

import pytest

from clips_worker.clipfind import c3_markers as M
from clips_worker.clipfind import dense as D
from clips_worker.clipfind import judge as J
from clips_worker.tools import eval_clipfind as E

QUIET = {"payoff": 9, "standalone": 8, "hook": 7, "reaction": 8, "rewatch": 8}
WEAK = {"payoff": 2, "standalone": 3, "hook": 2, "reaction": 1, "rewatch": 2}


def _item(**kw):
    row = {"id": "c1", "archetype": "quick_wit", "event_present": True, "setup_start_s": 10.0, "payoff_s": 20.0,
           "reaction_end_s": 24.0, "hook_s": None, "beat_evidence": {"setup": "q", "payoff": "a", "reaction": "(pause)"},
           "criteria": dict(QUIET), "penalties": {"context_needed": 0, "boundary": 0, "risk": 0}, "score": 8.0,
           "quiet_moment": True, "standalone_ok": True, "risk_flags": [], "observation_confidence": 0.8,
           "why": "deadpan answer", "title": "Deadpan", "verdict": "keep"}
    row.update(kw)
    return row


# ---------------------------------------------------------------- judge
def test_quiet_moment_can_reach_advance():
    j = J.parse_judge_item(_item(), 0, 60)
    assert j["score"] >= 8 and j["band"] == "advance" and j["verdict"] == "keep"


def test_model_score_can_raise_rubric_weak_still_ranked_not_auto_demote():
    rubric = J.parse_judge_item(_item(score=1.0), 0, 60)
    raised = J.parse_judge_item(_item(score=10.0), 0, 60)
    assert raised["score"] >= rubric["score"]
    loud_weak = J.parse_judge_item(_item(criteria=dict(WEAK), score=10.0), 0, 60)
    assert loud_weak["score"] >= 4 and loud_weak["verdict"] == "keep"


def test_penalties_subtract_without_risk():
    j = J.parse_judge_item(_item(score=0.0, penalties={"context_needed": 4, "boundary": 5, "risk": 9}), 0, 60)
    assert j["score"] == pytest.approx(J.rubric_score(QUIET, {"context_needed": 2, "boundary": 2}), abs=0.01)


@pytest.mark.parametrize("s,p,r", [(30, 20, 40), (10, 20, 70), (-5, 20, 24), (20, 20, 24)])
def test_parse_rejects_bad_times(s, p, r):
    assert J.parse_judge_item(_item(setup_start_s=s, payoff_s=p, reaction_end_s=r), 0, 60) is None


def test_no_event_is_demote_not_none():
    j = J.parse_judge_item(_item(event_present=False, archetype="none", setup_start_s=0, payoff_s=0, reaction_end_s=0), 0, 60)
    assert j is not None and j["verdict"] == "demote" and J.judge_beats_ms(j) is None


def test_risk_actions():
    assert J.risk_action(["minor"]) == "block"
    assert J.risk_action(["private_info", "bystander_target"]) == "block"
    assert J.risk_action(["bystander_target"]) == "none"
    assert J.risk_action(["hate_or_harassment"]) == "demote"
    assert J.risk_action(["creator_regret"]) == "demote"
    assert J.risk_action(["violence_or_medical", "third_party_media"]) == "none"
    assert J.risk_action(["not_a_flag"]) == "none"


def test_llm_row_never_deletes_and_scales():
    j = J.parse_judge_item(_item(verdict="demote", risk_flags=["minor"]), 0, 60)
    row = J.judge_to_llm_row(j)
    assert row["keep"] is True and row["score"] == int(round(j["score"] * 10))
    assert row["category"] == "funny" and row["setup_start_s"] == 10.0 and row["payoff_end_s"] == 24.0
    assert row["_judge"]["risk_action"] == "block"


def test_beats_ms_offset():
    j = J.parse_judge_item(_item(), 0, 60)
    assert J.judge_beats_ms(j, 100.0) == {"setup": 110000, "payoff": 120000, "reaction_end": 124000}


def test_transcript_marks_pauses_speakers_and_rebases():
    words = [{"w": "what", "s": 100.0, "e": 100.3, "speaker": "S1"}, {"w": "time?", "s": 100.4, "e": 100.8, "speaker": "S1"},
             {"w": "never.", "s": 102.0, "e": 102.4, "speaker": "S2"}]
    out = J.transcript_lines(words, 90, 110, rel_to=90)
    assert "[t=10.0] (S1) what time?" in out and "(pause 1.2 s)" in out and "[t=12.0] (S2) never." in out


def test_chat_summary_lag_and_unavailable():
    assert "unavailable" in J.chat_summary(None, 0, 60)
    s = J.chat_summary([{"t_s": 16.0, "text": "KEKW KEKW"}], 0, 60, lag_s=6)
    assert "[t=10] n=1 top=KEKW" in s


def test_prompts_and_schema():
    for p in (J.JUDGE_SYSTEM_BATCH, J.JUDGE_SYSTEM_DENSE):
        assert "Do not raise a score because it is loud" in p and "A QUIET moment can score 9-10" in p
        assert '"reaction_end_s"' in p and '"risk_flags"' in p and "minor:" in p
    assert "FRAMES" in J.JUDGE_SYSTEM_DENSE and "There are no frames" in J.JUDGE_SYSTEM_BATCH

    def walk(o):
        if isinstance(o, dict) and o.get("type") == "object":
            assert set(o["required"]) == set(o["properties"]) and o["additionalProperties"] is False
            for v in o["properties"].values():
                walk(v)
        elif isinstance(o, dict) and o.get("type") == "array":
            walk(o["items"])
    walk(J.JUDGE_BATCH_SCHEMA)


# ---------------------------------------------------------------- payoff markers
def test_viewer_clip_offset_bug_and_payoff():
    vc = {"vod_offset_s": 600, "duration_s": 20, "view_count": 5}
    assert int(vc.get("vod_offset_ms") or vc.get("startMs") or 0) // 1000 == 0   # today's clip_cues.py:112 read
    assert M.viewer_clip_payoff_s(vc) == pytest.approx(612.0)
    assert M.viewer_clip_payoff_s({"vod_offset_s": 600, "duration_s": 60}) == pytest.approx(612.0)  # capped 12s
    assert M.viewer_clip_payoff_s({"vod_offset_s": 600, "duration_s": 10}, range_start_s=500) == pytest.approx(106.0)
    assert M.viewer_clip_start_s({"vod_offset_ms": 5000}) == 5.0 and M.viewer_clip_start_s({}) is None


def test_payoff_cue_events():
    ev = [{"kind": "streamer_call", "sec": 5, "weight": 1.0}, {"kind": "chat_call", "sec": 40, "weight": 0.95},
          {"kind": "viewer_clip", "sec": 0, "weight": 0.9}]
    out = M.payoff_cue_events(ev, [{"vod_offset_s": 100, "duration_s": 10}, {"vod_offset_s": 9999}], 300)
    kinds = [(e["kind"], e["sec"], bool(e.get("payoff"))) for e in out]
    assert kinds == [("streamer_call", 5, False), ("chat_call", 40, True), ("viewer_clip", 106, True)]
    curve = M.viewer_cue_curve([{"vod_offset_s": 100, "duration_s": 10}], 300)
    assert curve[106] == 1.0 and curve[104] == 0.75 and curve[0] == 0.0


# ---------------------------------------------------------------- dense
@pytest.mark.parametrize("raw,want", [(None, 1.0), ("", 1.0), ("1", 1.0), ("0.5", 1.0), ("10", 3.0), ("abc", 1.0), ("2", 2.0)])
def test_interval_clamp_never_above_1fps(raw, want, monkeypatch):
    monkeypatch.delenv("CLIPFIND_DENSE_FRAME_INTERVAL_S", raising=False)
    assert D.dense_frame_interval_s(raw) == want
    assert D.dense_fps(raw) <= 1.0


def test_budget_cap(monkeypatch):
    for k in ("CLIPFIND_DENSE_MAX_USD_PER_STREAM_HOUR", "CLIPFIND_DENSE_MAX_USD_PER_JOB"):
        monkeypatch.delenv(k, raising=False)
    assert D.budget_cap_usd(1.0) == 1.0 and D.budget_cap_usd(1 / 6) == pytest.approx(0.30, abs=0.01) and D.budget_cap_usd(8) == 2.0


def test_pad_s_is_25():
    assert D.PAD_S == 25.0


def test_window_caps_at_120s_keeping_the_end():
    lo, hi = D.dense_window(100_000, 130_000, 10_000_000, {"setup_start_ms": 10_000, "reaction_end_ms": 140_000})
    assert hi == 165_000 and hi - lo == 120_000


WORDS = [{"w": f"w{i}", "s": float(i), "e": i + 0.6} for i in range(0, 400)]


def _cands(n):
    return [{"idx": i, "start_ms": 100_000 + i * 60_000, "end_ms": 130_000 + i * 60_000, "beats": None} for i in range(n)]


def _run(cands, call_fn, cap=1.0, price=lambda a, b: 0.01, **kw):
    logs = []
    out = D.run_dense(cands, call_fn=call_fn, price=price, budget=D.Budget(cap), words=WORDS, min_ms=15_000,
                      max_ms=60_000, duration_ms=1_000_000, interval_s=2.5,
                      log=lambda ev, **k: logs.append(ev), **kw)
    return out, logs


def test_budget_stops_calls_and_logs():
    calls = []
    out, logs = _run(_cands(5), lambda c: (calls.append(c["idx"]) or _item(), 0.01), cap=0.025)
    assert calls == [0, 1] and out.budget_exhausted and "dense_budget_exhausted" in logs
    assert set(out.results) == {0, 1}


def test_call_errors_and_invalid_output_are_skipped_not_fatal():
    entries: list[tuple] = []

    def fn(c):
        if c["idx"] == 0:
            raise TimeoutError()
        if c["idx"] == 1:
            return {"garbage": True}, 0.001
        return _item(), 0.001

    out = D.run_dense(
        _cands(3), call_fn=fn, price=lambda a, b: 0.01, budget=D.Budget(1.0), words=WORDS,
        min_ms=15_000, max_ms=60_000, duration_ms=1_000_000, interval_s=2.5,
        log=lambda ev, **k: entries.append((ev, k)),
    )
    assert [s[0] for s in out.skipped] == [0, 1] and set(out.results) == {2}
    assert any(e[0] == "dense_call_error" for e in entries)
    inv = [e for e in entries if e[0] == "dense_invalid_output"]
    assert inv and inv[0][1].get("reason")


def test_dense_clamp_fixes_order_before_parse():
    entries: list[tuple] = []
    raw = _item(setup_start_s=50.0, payoff_s=40.0, reaction_end_s=38.0)

    def fn(c):
        return raw, 0.001

    out = D.run_dense(
        _cands(1), call_fn=fn, price=lambda a, b: 0.01, budget=D.Budget(1.0), words=WORDS,
        min_ms=15_000, max_ms=60_000, duration_ms=1_000_000, interval_s=2.5,
        log=lambda ev, **k: entries.append((ev, k)),
    )
    assert 0 in out.results and not any(e[0] == "dense_invalid_output" for e in entries)


def test_apply_quiet_joke_bounds_word_safe_and_min_len():
    out, _ = _run(_cands(1), lambda c: (_item(setup_start_s=12.3, payoff_s=20.0, reaction_end_s=23.2), 0.001))
    lo = out.results[0]["window_ms"][0]
    s, e, beats = out.bounds[0]
    assert s == lo + 12_000 and e - s >= 15_000 and beats["source"] == "dense"
    assert beats["payoff_ms"] == lo + 20_000


def test_low_confidence_keeps_old_bounds():
    out, logs = _run(_cands(1), lambda c: (_item(observation_confidence=0.3), 0.001))
    assert 0 in out.results and 0 not in out.bounds and "dense_low_confidence" in logs


def test_time_cap():
    t = iter([0.0, 0.0, 999.0, 999.0])
    out, logs = _run(_cands(3), lambda c: (_item(), 0.001), max_stage_s=10, clock=lambda: next(t))
    assert out.time_exhausted and len(out.results) == 1


def test_retier_blocks_demotes_promotes_never_drops():
    items = [{"tier": "primary", "judge": {"risk_action": "block", "risk_flags": ["minor"], "score": 3}},
             {"tier": "primary", "judge": {"verdict": "keep", "score": 8}},
             {"tier": "primary", "judge": {"verdict": "demote", "score": 3}},
             {"tier": "more", "judge": None, "old_score": 7.5},
             {"tier": "more", "judge": {"risk_action": "none", "risk_flags": ["bystander_target"], "score": 8}},
             {"tier": "more", "judge": {"verdict": "keep", "score": 9}}]
    order = D.retier(items)
    assert len(order) == 6 and sorted(order) == list(range(6))
    assert sum(it["tier"] == "primary" for it in items) >= 3
    assert items[0]["tier"] == "more" and items[0]["render"] is False
    assert items[3]["final_score"] == 7.5


# ---------------------------------------------------------------- eval scorer
CASE = {"id": "c3", "archetype": "storytime", "expect": {"setup_start_s": 40.0, "payoff_s": 95.0, "reaction_end_s": 105.0}}


def test_eval_found_and_boundaries():
    r = E.score_case(CASE, [{"start_s": 0, "end_s": 20, "tier": "primary"}, {"start_s": 39, "end_s": 106, "tier": "primary"}])
    assert r["found"] and r["rank"] == 1 and r["top_n"] and r["setup_kept"] and r["reaction_kept"] and r["iou"] > 0.9


def test_eval_aftermath_only_fails_setup():
    r = E.score_case(CASE, [{"start_s": 90, "end_s": 106, "tier": "primary"}])
    assert r["found"] and not r["setup_kept"] and r["reaction_kept"] and r["start_err_s"] == 50.0


def test_eval_missing_moment_not_found():
    r = E.score_case(CASE, [{"start_s": 200, "end_s": 230, "tier": "primary"}])
    assert not r["found"] and not r["top_n"] and not r["setup_kept"]


def test_eval_unlabeled_excluded():
    case = {"id": "x", "expect": {"setup_start_s": "TODO-label", "payoff_s": "TODO-label", "reaction_end_s": "TODO-label"}}
    res = E.score_all({"cases": [case, CASE]}, {"c3": [{"start_s": 39, "end_s": 106, "tier": "primary"}]})
    assert res["summary"]["unlabeled"] == 1 and res["summary"]["scored"] == 1 and res["summary"]["found"] == 1.0


def test_eval_false_alarm():
    fa = {"id": "raid", "expect_demote": True, "expect": {"span_start_s": 60, "span_end_s": 100}}
    assert E.score_case(fa, [{"start_s": 62, "end_s": 98, "tier": "primary"}])["passed"] is False
    assert E.score_case(fa, [{"start_s": 62, "end_s": 98, "tier": "more"}])["passed"] is True


def test_eval_compare_reports_worse():
    off = {"summary": {"found": 1.0, "setup_kept": 0.5}}
    on = {"summary": {"found": 0.5, "setup_kept": 1.0}}
    lines = E.compare(off, on)
    assert any("found" in x and "worse" in x for x in lines) and any("setup_kept" in x and "better" in x for x in lines)


def test_label_template_shape():
    import json, pathlib
    p = pathlib.Path(__file__).with_name("labels_c3.json")
    if not p.is_file():
        pytest.skip("template lives in C3_assets / worker/tools")
    data = json.loads(p.read_text())
    assert len(data["cases"]) == 5
    assert all(E.score_case(c, [])["status"] == "unlabeled" for c in data["cases"])


# ---- video-first amendment (John, Oct 29) ----
def test_select_puts_video_found_first_default_30():
    items = [{"tier": "primary", "rank": i, "id": f"c{i}"} for i in range(40)]
    items[35]["id"] = "vp_7"; items[35]["tier"] = "more"
    sel = D.select_candidates(items)
    assert len(sel) == 30 and sel[0] == 35


def test_retier_dense_visual_payoff_promotes_quiet_transcript_clip():
    items = [
        {"tier": "primary", "id": "c0", "judge": {"score": 4.5, "verdict": "keep"}},
        {"tier": "primary", "id": "c1", "judge": {"score": 7.0, "verdict": "keep"}},
        {"tier": "more", "id": "c2", "judge": {"score": 9.0, "verdict": "keep"}},
    ]
    order = D.retier(items, stream_hours=1.0)
    assert items[2]["tier"] == "primary" and items[1]["tier"] == "primary"
    assert order[0] == 2


def test_retier_keeps_at_least_one_primary_and_unjudged_old_score():
    items = [{"tier": "primary", "id": "a", "judge": {"score": 2, "verdict": "demote"}},
             {"tier": "more", "id": "b", "judge": None, "old_score": 7.0},
             {"tier": "more", "id": "c", "judge": {"score": 6}}]
    order = D.retier(items, stream_hours=1 / 12)
    assert sorted(order) == [0, 1, 2]
    assert sum(it["tier"] == "primary" for it in items) >= 1
    assert items[1]["final_score"] == 7.0
    assert items[1]["tier"] == "primary"


def test_retier_gaming_floor_for_video_found():
    items = [{"tier": "primary", "id": "vp_1", "old_score": 8.5, "judge": {"score": 5.0, "verdict": "keep"}},
             {"tier": "more", "id": "c1", "judge": {"score": 7.0, "verdict": "keep"}}]
    D.retier(items)
    assert items[0]["tier"] == "primary" and items[0]["final_score"] == 8.5


def test_retier_risk_block_beats_floor():
    items = [{"tier": "primary", "id": "vp_1", "old_score": 9.5,
              "judge": {"score": 9.0, "risk_action": "block", "risk_flags": ["minor"]}},
             {"tier": "more", "id": "c1", "judge": {"score": 6.0}}]
    D.retier(items)
    assert items[0]["tier"] == "more" and items[0]["render"] is False and items[1]["tier"] == "primary"


def test_prompt_says_video_is_primary_and_examples_not_checklist():
    assert "VIDEO IS PRIMARY EVIDENCE" in J.JUDGE_SYSTEM_DENSE and "purely visual" in J.JUDGE_SYSTEM_BATCH
    assert "EXAMPLES, not a checklist" in J.JUDGE_SYSTEM_BATCH
    assert "weak but still ranked" in J.JUDGE_SYSTEM_DENSE
