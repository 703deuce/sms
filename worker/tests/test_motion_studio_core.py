"""Motion Studio core smoke tests (run in the worker image build): engine import, word clock, sandbox
policy fails closed, fallback scene renders a probe still, handoff module imports, boundary rule."""
import importlib.util
import os
import pathlib
import re
import tempfile

import pytest

from clips_worker.motion_studio.core.wordclock import WordClock, WordClockMiss, spoken_form


def test_spoken_form():
    assert "percent" in spoken_form("140%")
    assert spoken_form("2021") == "twenty twenty-one"


def test_word_clock_missing_word_raises():
    c = WordClock([{"w": "hello", "s": 0.1, "e": 0.4, "line": "l1"}])
    assert c.W("l1", "hello") == pytest.approx(0.1)
    with pytest.raises(WordClockMiss):
        c.W("l1", "absent")


def test_policy_fails_closed():
    from clips_worker.motion_studio.sandbox.policy import PolicyViolation, check_code
    for bad in ("import os\ndef build_scene(ctx): pass", "def build_scene(ctx):\n    return ().__class__",
                "def build_scene(ctx):\n    open('/etc/passwd')", "x=1"):
        with pytest.raises(PolicyViolation):
            check_code(bad)



@pytest.mark.skipif(importlib.util.find_spec('skia') is None, reason='skia not installed')
def test_fallback_probe_and_runtime_block():
    from clips_worker.motion_studio.core.fallback import FALLBACK_CODE
    from clips_worker.motion_studio.core.render import SandboxError, probe_stills
    words = [{"w": w, "s": 0.3 + i * 0.35, "e": 0.6 + i * 0.35, "line": "l1"} for i, w in enumerate("the price fell by half".split())]
    ctx = {"duration": 3.0, "fps": 30, "seed": 3, "style": {}, "palette": {"bg": "#0d1018", "ink": "#f0f0f0", "accent": "#ffc400"},
           "lines": [{"id": "l1", "text": "The price fell by half", "start": 0.3, "end": 2.0, "hero": "HALF"}], "words": words,
           "emphasis": [], "assets": {}, "data": [], "scene": {"id": "s0"}}
    d = tempfile.mkdtemp()
    res = probe_stills(FALLBACK_CODE, ctx, d, [1.2], 480, 270)
    assert res["ok"] and os.path.exists(res["stills"][0]["path"])
    bad = "import numpy as np\ndef build_scene(ctx):\n    f = ctx.film()\n    f.cam(0, 0, 0, 1)\n    np.load('/etc/hostname')\n    return f\n"
    with pytest.raises(SandboxError) as e:
        probe_stills(bad, ctx, tempfile.mkdtemp(), [0.5], 320, 180)
    assert e.value.kind == "sandbox_policy"


def test_shared_modules_do_not_import_directors():
    root = pathlib.Path(__file__).resolve().parents[1] / "clips_worker" / "motion_studio"
    for sub in ("core", "sandbox"):
        for p in (root / sub).rglob("*.py"):
            assert not re.search(r"motion_studio\.directors", p.read_text()), p
    for p in (root / "pipeline").rglob("*.py"):
        src = p.read_text()
        assert not re.search(r"from clips_worker\.motion_studio\.directors\.documentary", src), p


def test_registry_rejects_undeclared_capability():
    from clips_worker.motion_studio.directors.registry import CapabilityError, get_director
    d = get_director("documentary")
    d.check({"world.canvas"})
    with pytest.raises(CapabilityError):
        d.check({"teleport.anything"})



@pytest.mark.skipif(importlib.util.find_spec('skia') is None, reason='skia not installed')
def test_motion_core_exports_world_items():
    from clips_worker.motion_studio.core import api
    for name in ("GeoMap", "RegionFill", "Board", "Print", "Route", "MapPin", "MAP_LOOKS"):
        assert hasattr(api, name), name


def test_stock_maps_and_places():
    from clips_worker.motion_studio.core.stock import available_maps, load_map, project_ll
    assert "world" in available_maps() and "us" in available_maps()
    world = load_map("world")
    assert "Chicago" in world["places"] and "Tokyo" in world["places"]
    # projector is consistent with stored Chicago
    x, y = project_ll(world, 41.88, -87.63)
    stored = world["places"]["Chicago"]
    assert abs(x - stored[0]) < 0.002 and abs(y - stored[1]) < 0.002
    us = load_map("us")
    assert "Washington" in us["places"] and "California" in (us.get("regions") or {})


def test_fallback_code_follows_world():
    from clips_worker.motion_studio.core.fallback import FALLBACK_CODE, FALLBACK_MAP, FALLBACK_CHART, fallback_code
    assert "ctx.geo" in fallback_code({"scene": {"world": "map"}})
    assert "LineSeries" in fallback_code({"scene": {"world": "price_chart"}})
    assert fallback_code({"scene": {"world": "abstract_field"}}) == FALLBACK_CODE
    assert "GeoMap" in FALLBACK_MAP or "ctx.geo" in FALLBACK_MAP
    assert "LinearAxis" in FALLBACK_CHART



@pytest.mark.skipif(importlib.util.find_spec('skia') is None, reason='skia not installed')
def test_fallback_map_probe():
    from clips_worker.motion_studio.core.fallback import fallback_code
    from clips_worker.motion_studio.core.render import probe_stills
    from clips_worker.motion_studio.core.stock import materialize
    words = [{"w": w, "s": 0.3 + i * 0.4, "e": 0.6 + i * 0.4, "line": "l1"}
             for i, w in enumerate("it spread from Chicago to London".split())]
    ctx = {"duration": 3.0, "fps": 30, "seed": 7,
           "style": {"palette": {"bg": "#071412", "ink": "#e8f5ef", "accent": "#3ee6a1", "accent2": "#f5d76e", "muted": "#6d8a80"}},
           "palette": {"bg": "#071412", "ink": "#e8f5ef", "accent": "#3ee6a1", "accent2": "#f5d76e", "muted": "#6d8a80"},
           "lines": [{"id": "l1", "text": "It spread from Chicago to London", "spoken": "It spread from Chicago to London",
                      "start": 0.3, "end": 2.6, "hero": "CHICAGO"}],
           "words": words, "emphasis": [], "assets": {}, "data": [],
           "scene": {"id": "s0", "index": 0, "visualType": "map", "world": "map", "description": "the map"}}
    d = tempfile.mkdtemp()
    assets = os.path.join(d, "assets")
    materialize(assets)
    res = probe_stills(fallback_code(ctx), ctx, d, [1.2], 480, 270, assets)
    assert res.get("ok"), res
    assert os.path.exists(res["stills"][0]["path"])
