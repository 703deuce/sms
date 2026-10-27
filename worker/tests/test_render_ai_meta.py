from pathlib import Path

from clips_worker.render_settings import settings_with_clip_ai_meta


def test_load_render_context_includes_clip_ai_meta_column():
    src = (Path(__file__).resolve().parents[1] / "clips_worker" / "render_job.py").read_text(encoding="utf-8")
    assert 'c."aiMeta"' in src
    assert "settings_with_clip_ai_meta" in src


def test_settings_merge_clip_ai_meta_layout():
    settings = {"layout": "auto", "aspectRatio": "9:16"}
    ai = {"layoutResolved": "grid3", "cropMethod": "reframe_v2"}
    merged = settings_with_clip_ai_meta(settings, ai)
    assert merged["aiMeta"]["layoutResolved"] == "grid3"
