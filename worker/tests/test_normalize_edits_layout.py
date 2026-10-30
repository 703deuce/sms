from clips_worker.edits_render import normalize_edits


def test_normalize_edits_preserves_facecam_and_crop_box():
    raw = {
        "trim": {"in": 1000, "out": 5000},
        "layout": {
            "mode": "facecam_stack",
            "facecam": {
                "box": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.25},
                "gameplay": {"x": 0, "y": 0, "w": 1, "h": 0.7},
                "split": 0.4,
            },
            "cropBox": {"x": 0.05, "y": 0.05, "w": 0.9, "h": 0.9},
            "userPicked": True,
        },
    }
    out = normalize_edits(raw, 0, 10_000)
    layout = out["layout"]
    assert layout["facecam"]["box"]["x"] == 0.1
    assert layout["cropBox"]["w"] == 0.9
    assert layout.get("userPicked") is True


def test_normalize_edits_keeps_layout_template():
    raw = {
        "trim": {"in": 0, "out": 5000},
        "layout": {"mode": "facecam_stack", "template": {"id": "G1", "auto": True, "reason": "test"}},
    }
    out = normalize_edits(raw, 0, 10_000)
    assert out["layout"]["template"]["id"] == "G1"
