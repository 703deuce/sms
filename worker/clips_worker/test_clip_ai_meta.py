from clips_worker.clip_ai_meta import finalize_clip_ai_meta


def test_finalize_clip_ai_meta_merges_reframe_and_n_persons():
    pick = {"aiMeta": {"hook": "Strong opener", "pass1_why": "High energy"}}
    reframe = {"layoutRouteShadow": {"nPersons": 3, "route": "grid3"}}
    out = finalize_clip_ai_meta(pick, reframe, "speaker_follow", "grid3")
    assert out["hook"] == "Strong opener"
    assert out["pass1_why"] == "High energy"
    assert out["nPersons"] == 3
    assert out["layoutResolved"] == "grid3"
    assert out["cropMethod"] == "speaker_follow"
