from clips_worker.t6_signals import merge_dense_layout_signals, signals_call, signals_or_defaults, validate_ai


def test_validate_ai_clamps_boxes():
    out = validate_ai({"action_box": {"x": 1.2, "y": -0.1, "w": 0.5, "h": 0.2}})
    box = out.get("action_box")
    assert box and box["w"] <= 1.0
    assert validate_ai({"action_box": {"x": 0, "y": 0, "w": 0, "h": 0.2}}).get("action_box") is None


def test_signals_or_defaults_empty():
    s = signals_or_defaults({})
    assert s["v"] == 1
    assert s["clip_type"] == "irl"
    assert s["background_action"] is True
    assert "bands" in s


def test_dense_layout_signals_passthrough():
    cand = {"layout_signals": {"clip_type": "gaming", "type_conf": 0.9, "game_ui_visible": True}}
    merged = merge_dense_layout_signals(cand)
    assert merged and merged["clip_type"] == "gaming"
    assert merged["sources"]["ai"] == "dense"


def test_signals_call_returns_none_without_network(monkeypatch):
    def fake_call(*_a, **_k):
        return None, 0.0

    monkeypatch.setattr("clips_worker.t6_signals.signals_call", fake_call)
    out, cost = signals_call(None, [], None)
    assert out is None and cost == 0.0
