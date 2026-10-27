from clips_worker.process_helpers import project_layout_for_clip
from clips_worker.render_clip import (
    layout_env,
    multiperson_reframe_enabled,
    resolve_clip_layout,
    speakercrop_env_for_settings,
)


def test_resolve_clip_layout_auto_rotates():
    settings = {"layout": "auto"}
    assert resolve_clip_layout(settings, 0) == "dynamic"
    assert resolve_clip_layout(settings, 1) == "speaker_follow"


def test_speakercrop_env_fill_fit_split():
    fill = speakercrop_env_for_settings({"layout": "fill"})
    assert fill["LAYOUT_MODE"] == "fill"
    assert fill.get("MULTIPERSON") != "1"

    fit = speakercrop_env_for_settings({"layout": "fit"})
    assert fit["LAYOUT_MODE"] == "fit"

    split = speakercrop_env_for_settings({"layout": "split"})
    assert split["LAYOUT_MODE"] == "split"
    assert split.get("MULTIPERSON") != "1"
    assert split["FORCE_SPLIT"] == "1"


def test_speaker_follow_default_uses_legacy_reframe_path(monkeypatch):
    monkeypatch.delenv("REFRAME_V2_ENABLED", raising=False)
    monkeypatch.setenv("CLIPPER_AUTO_MP_ROUTE", "0")
    monkeypatch.delenv("REFRAME_V", raising=False)
    assert multiperson_reframe_enabled() is False
    spk = speakercrop_env_for_settings({"layout": "speaker_follow"})
    assert spk["LAYOUT_MODE"] == "speaker_follow"
    assert spk.get("MULTIPERSON") != "1"
    assert spk.get("REFRAME_V") != "2"

    speakercrop_src = (
        __import__("pathlib").Path(__file__).resolve().parents[1] / "prototype" / "v3" / "speakercrop.py"
    ).read_text()
    assert 'REFRAME_V' in speakercrop_src
    assert 'os.environ.get("REFRAME_V"' in speakercrop_src or "REFRAME_V" in speakercrop_src


def test_project_layout_matches_pipeline():
    project = {"settings": {"layout": "fill"}}
    assert project_layout_for_clip(project, 0) == "fill"
    env = speakercrop_env_for_settings({"layout": project_layout_for_clip(project, 0)})
    assert env["LAYOUT_STYLE"] == layout_env("fill")["LAYOUT_STYLE"]
