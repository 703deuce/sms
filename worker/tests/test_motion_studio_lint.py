"""Pre-render static checks and per-stage model routing."""
from clips_worker.motion_studio.pipeline import config
from clips_worker.motion_studio.sandbox.policy import lint_scene


def _scene(body: str) -> str:
    return "from motion_core import *\n\ndef build_scene(ctx):\n    film = ctx.film()\n" + body + "\n    film.cam(0, 0, 0, 0.4)\n    film.cam(ctx.duration, 0, 0, 0.4)\n    return film\n"


def test_lint_allows_preloaded_skia_and_random_without_import():
    code = _scene("    r = skia.Rect.MakeXYWH(0, 0, 10, 10)\n    x = ctx.rand.random()\n")
    assert lint_scene(code) == []


def test_lint_flags_stringline_rgb():
    code = _scene("    film.add(StringLine((0, 0), (100, 0), 0.1, rgb=(255, 0, 0)))\n")
    probs = lint_scene(code)
    assert any("StringLine" in p and "rgb" in p for p in probs), probs


def test_lint_flags_wrong_drawroundrect_arity():
    code = _scene("    c = None\n    c.drawRoundRect(0, 0, 100, 40, 8, paint((255, 255, 255), 1))\n")
    probs = lint_scene(code)
    assert any("drawRoundRect" in p and "arity" in p for p in probs), probs


def test_lint_flags_unknown_palette_key():
    code = _scene("    col = ctx.rgb('dark_line')\n")
    probs = lint_scene(code)
    assert any("dark_line" in p and "palette" in p for p in probs), probs


def test_lint_does_not_flag_known_palette_keys():
    code = _scene("    col = ctx.rgb('accent')\n    bg = ctx.palette['bg']\n")
    assert lint_scene(code) == []


def test_model_for_honours_env_and_project_settings(monkeypatch):
    monkeypatch.delenv("MOTION_STUDIO_MODEL", raising=False)
    monkeypatch.delenv("MOTION_STUDIO_MODEL_SCENE_CODE", raising=False)
    monkeypatch.delenv("MOTION_STUDIO_MODEL_PRODUCTION_DESIGNER", raising=False)
    config.apply_project_settings({})
    assert config.model_for("scene_code") == "gpt-6-luna"
    monkeypatch.setenv("MOTION_STUDIO_MODEL_SCENE_CODE", "gpt-6.1-sol")
    assert config.model_for("scene_code") == "gpt-6.1-sol"
    assert config.model_for("production_designer") == "gpt-6-luna"
    config.apply_project_settings({"models": {"production_designer": "gpt-6.1-sol", "scene_code": "gpt-6-luna"}})
    assert config.model_for("production_designer") == "gpt-6.1-sol"
    assert config.model_for("scene_code") == "gpt-6-luna"  # settings.models wins over leftover env? 
    # Precedence I documented: settings.models first, then env. So scene_code should be luna from settings.
    config.apply_project_settings({})
    monkeypatch.delenv("MOTION_STUDIO_MODEL_SCENE_CODE", raising=False)


def test_design_scene_source_tracks_passing_separately():
    import pathlib
    root = pathlib.Path(__file__).resolve().parents[1]
    src = (root / "clips_worker/motion_studio/directors/documentary/engineer.py").read_text()
    fn = src[src.index("def design_scene"):]
    assert "passing" in fn and "failed" in fn
    assert "usedFallback" in fn
    assert "if not empty:" not in fn
    assert "lint_scene" in fn
    assert "api_excerpt_for" in fn
    assert "traceback" in fn


def test_designer_prompt_teaches_core_vs_custom_and_sandbox_contract():
    import pathlib
    from clips_worker.motion_studio.core.api_manifest import format_api_reference
    from clips_worker.motion_studio.core.craft import engineer_system
    from clips_worker.motion_studio.tools.registry import format_tools_reference
    root = pathlib.Path(__file__).resolve().parents[1]
    craft = (root / "clips_worker/motion_studio/core/craft.py").read_text().lower()
    api = format_api_reference().lower()
    assert "core vs custom" in craft
    assert "held photograph" in craft
    assert "no rgb argument" in api or "no 'rgb' argument" in api
    assert "dark_line" in api
    assert "0.25" in api
    assert "drawroundrect" in api or "drawrrect" in api
    assert "skia" in api and "already in scope" in (api + craft)
    system = engineer_system(format_api_reference(), format_tools_reference()).lower()
    assert "already in scope" in system or "already in scope" in api
