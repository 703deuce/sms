from clips_worker.t6_registry import LEGACY_LAYOUT_MODES, TEMPLATE_IDS, TEMPLATES


def test_template_ids_unique():
    assert len(TEMPLATE_IDS) == len(set(TEMPLATE_IDS))
    assert len(TEMPLATES) == 21


def _vertical_coverage(t: dict) -> float:
    spans: list[tuple[float, float]] = []
    for p in t.get("panels") or []:
        y = float(p.get("y") or 0)
        h = float(p.get("h") or 0)
        spans.append((y, y + h))
    for b in t.get("bands") or []:
        y = float(b.get("y") or 0)
        h = float(b.get("h") or 0)
        spans.append((y, y + h))
    if not spans:
        return 0.0
    spans.sort()
    merged: list[list[float]] = [[spans[0][0], spans[0][1]]]
    for s, e in spans[1:]:
        if s <= merged[-1][1] + 0.001:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    return sum(e - s for s, e in merged)


def test_canvas_coverage_is_full_height():
    for tid, t in TEMPLATES.items():
        cov = _vertical_coverage(t)
        assert abs(cov - 1.0) <= 0.001, f"{tid} coverage {cov}"


def test_fallback_modes_known():
    for tid, t in TEMPLATES.items():
        mode = str(t.get("fallbackMode") or "")
        assert mode in LEGACY_LAYOUT_MODES, f"{tid} fallback {mode}"
