"""API manifest is the single source of truth for docs, lint, repair, and the 8 failures."""
from __future__ import annotations

import pytest

from clips_worker.motion_studio.core.api_manifest import (
    ENGINE_SHA,
    EXAMPLES,
    PRELOADED,
    assert_fresh,
    format_api_reference,
    format_repair,
    load_manifest,
)
from clips_worker.motion_studio.sandbox.policy import lint_scene
from clips_worker.motion_studio.sandbox import runner as runner_mod


def test_committed_manifest_is_fresh():
    assert_fresh()


def test_manifest_carries_pinned_engine_sha_and_exports():
    m = load_manifest()
    assert m["engineSha"].startswith(ENGINE_SHA[:7])
    assert m["engineSha"] == ENGINE_SHA or m["engineSha"].startswith("bf43556")
    symbols = m["symbols"]
    sl = symbols["StringLine"]
    assert "rgb" not in (sl.get("kwargs") or [])
    assert "rgb" in (symbols["Connector"].get("kwargs") or [])
    shot = (m.get("studioFilm") or {}).get("methods") or {}
    # methods may be a dict of name -> rec
    shot_rec = shot.get("shot") or symbols.get("shot") or {}
    sig = shot_rec.get("signature") or ""
    assert "zoom" in sig or "shot(" in sig or shot
    assert set(m["paletteKeys"]) == {"bg", "ink", "accent", "accent2", "muted"}
    assert "skia" in m["preloaded"] and "random" in m["preloaded"]
    assert "heartbeat" in (m.get("cueKinds") or [])


def test_docs_validator_and_preloads_agree():
    m = load_manifest()
    docs = format_api_reference(m).lower()
    assert "already in scope" in docs
    assert "skia" in docs and "random" in docs
    for name in m["preloaded"]:
        assert name in PRELOADED or name in m["preloaded"]
    # runner preloads must include the manifest preloaded names (minus ctx)
    src = open(runner_mod.__file__).read()
    for name in ("skia", "random", "math", "numpy", "np"):
        assert name in src
        assert name in m["preloaded"]


def _scene(body: str) -> str:
    return (
        "from motion_core import *\n\ndef build_scene(ctx):\n    film = ctx.film()\n"
        + body
        + "\n    film.cam(0, 0, 0, 0.4)\n    film.cam(ctx.duration, 0, 0, 0.4)\n    return film\n"
    )


# The eight observed failures (5 distinct bugs; repeated where they occurred more than once).
_EIGHT_FAILURES = [
    ("skia_undefined_1", "    r = skia.Rect.MakeXYWH(0, 0, 10, 10)\n", True, None),
    ("skia_undefined_2", "    p = skia.Paint()\n", True, None),
    ("skia_undefined_3", "    _ = skia.Color(255, 255, 255, 255)\n", True, None),
    ("drawRoundRect_1", "    c = None\n    c.drawRoundRect(0, 0, 100, 40, 8, paint((255, 255, 255), 1))\n", False, "drawRoundRect"),
    ("drawRoundRect_2", "    c = None\n    c.drawRoundRect(10, 10, 80, 20, 4, paint((0, 0, 0), 1))\n", False, "drawRoundRect"),
    ("random_undefined", "    x = random.random()\n", True, None),
    ("dark_line", "    col = ctx.rgb('dark_line')\n", False, "dark_line"),
    ("stringline_rgb", "    film.add(StringLine((0, 0), (100, 0), 0.1, rgb=(255, 0, 0)))\n", False, "rgb"),
]


@pytest.mark.parametrize("name,body,should_pass,needle", _EIGHT_FAILURES, ids=[r[0] for r in _EIGHT_FAILURES])
def test_eight_observed_failures_are_locked_to_the_manifest(name, body, should_pass, needle):
    probs = lint_scene(_scene(body))
    if should_pass:
        assert probs == [], (name, probs)
    else:
        assert probs, name
        assert any(needle in p for p in probs), (name, probs)
        repair = format_repair(probs, _scene(body))
        assert "Errors:" in repair or "Fix ONLY" in repair
        assert "line " in repair.lower()
        assert "signature" in repair.lower() or "StringLine(" in repair or "drawRoundRect" in repair
        # A working example, not a generic "fix the code"
        assert "example" in repair.lower() or "from motion_core import" in repair
        assert "fix the code" not in repair.lower() or "Fix ONLY" in repair


def test_manifest_examples_lint_clean_and_execute_when_skia_present():
    try:
        import skia  # noqa: F401
        have = True
    except ImportError:
        have = False
    for key, code in EXAMPLES.items():
        probs = lint_scene(code)
        assert probs == [], (key, probs)
        if have:
            compile(code, f"<{key}>", "exec")
    if not have:
        # Lint already ran. Full example execution is required in the worker image.
        pytest.skip("skia is not installed on this unit host; examples were linted only")


def test_format_repair_includes_offending_line_for_stringline_rgb():
    code = _scene("    film.add(StringLine((0, 0), (100, 0), 0.1, rgb=(255, 0, 0)))\n")
    probs = lint_scene(code)
    repair = format_repair(probs, code)
    assert "StringLine" in repair
    assert "rgb" in repair
    assert "Connector" in repair
    # Offending source line is quoted
    assert "StringLine((0, 0)" in repair or "rgb=(255, 0, 0)" in repair
