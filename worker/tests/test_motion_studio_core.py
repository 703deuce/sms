"""Motion Studio core smoke tests (run in the worker image build): engine import, word clock, sandbox
policy fails closed, fallback scene renders a probe still, handoff module imports, boundary rule."""
import importlib.util
import shutil
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



@pytest.mark.skipif(importlib.util.find_spec('skia') is None, reason='skia not installed')
def test_score_params_are_seeded_and_world_aware():
    from clips_worker.motion_studio.core.audio import music_seed, score_params
    a = score_params(music_seed("p1", "hello story"), "curious")
    b = score_params(music_seed("p1", "hello story"), "curious")
    c = score_params(music_seed("p1", "a completely different script about collapse"), "curious")
    assert a == b
    assert a["bpm"] != c["bpm"] or a["key"] != c["key"] or a["instruments"] != c["instruments"]
    chart = score_params(1, "curious", "price_chart", "The squeeze")
    assert "sub" in chart["instruments"] or chart["mood"] == "driving"
    assert chart["mode"] in {"minor", "dorian", "major"}


def test_policy_allows_item_subclass_init_but_not_other_dunders():
    from clips_worker.motion_studio.sandbox.policy import PolicyViolation, check_code
    ok = """from motion_core import *
class Pin(Item):
    def __init__(self, x, y, t_in):
        super().__init__(t_in=t_in, t_out=None, z=30, sfx=True)
        self.x, self.y = x, y
    def bounds(self, res):
        return None
    def draw(self, c, res, t):
        pass
def build_scene(ctx):
    return ctx.film()
"""
    check_code(ok)
    for bad in ("def build_scene(ctx):\n    return ctx.__class__",
                "def build_scene(ctx):\n    return ().__class__.__name__"):
        try:
            check_code(bad)
        except PolicyViolation:
            pass
        else:
            raise AssertionError("expected PolicyViolation for " + bad)


@pytest.mark.skipif(importlib.util.find_spec("scipy") is None, reason="scipy not installed")
def test_generate_score_writes_wav_for_short_and_typical_films(tmp_path):
    from clips_worker.motion_studio.core.audio import generate_score, score_params, SR
    params = score_params(1, "curious", "evidence_board", "Blockbuster")
    for dur, anchors in ((2.0, {"peak": 1.0}), (8.0, {"pulse": 1.0, "build": 2.5, "peak": 5.0, "resolve": 6.5})):
        wav = tmp_path / f"score_{int(dur)}s.wav"
        info = generate_score(str(wav), dur, anchors, params)
        assert wav.exists() and wav.stat().st_size > 1000
        assert info["source"] == "generated"
        assert info["params"]["bpm"] == params["bpm"]
        # stereo 16-bit at SR, duration matches to 1 frame
        import wave
        with wave.open(str(wav), "rb") as f:
            assert f.getnchannels() == 2 and f.getframerate() == SR
            assert abs(f.getnframes() / SR - dur) < 1 / SR + 1e-6


@pytest.mark.skipif(importlib.util.find_spec("scipy") is None, reason="scipy not installed")
@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg not installed")
def test_mix_two_pass_loudnorm_on_short_score(tmp_path):
    """2s and 4s beds used to fail the second loudnorm pass with an unspecified layout."""
    from clips_worker.motion_studio.core.audio import generate_score, score_params, silence, mix
    params = score_params(1, "curious", "evidence_board", "Blockbuster")
    for dur in (2.0, 4.0):
        score = tmp_path / f"score_{int(dur)}s.wav"
        vo = tmp_path / f"vo_{int(dur)}s.wav"
        out = tmp_path / f"mix_{int(dur)}s.wav"
        generate_score(str(score), dur, {"peak": max(0.8, dur * 0.5)}, params)
        silence(str(vo), dur)
        meas = mix(str(out), dur, str(vo), str(score), None)
        assert out.exists() and out.stat().st_size > 1000
        assert meas.get("I") is not None
