from pathlib import Path
from unittest.mock import MagicMock

from clips_worker.captions_ass import resolve_ass_font_name
from clips_worker.user_fonts import prepare_user_fonts, used_font_ids


def test_used_font_ids_includes_caption_user_font():
    edits = {"captions": {"font": "user:font_abc"}, "textItems": []}
    assert "font_abc" in used_font_ids(edits)


def test_prepare_user_fonts_rewrites_caption_font(tmp_path, monkeypatch):
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    cur.fetchall.return_value = [
        ("font_abc", "My Custom", "key/font.ttf", "f.ttf", {"cssEmPerAssFontsize": 0.9}),
    ]

    def fake_download(key, dest):
        Path(dest).write_bytes(b"font")

    monkeypatch.setattr("clips_worker.storage.download_object", fake_download)
    monkeypatch.setattr("clips_worker.caption_fit.register_font_metrics", lambda *a, **k: None)
    monkeypatch.setattr(
        "clips_worker.title_fit.clip_fonts_dir",
        lambda: tmp_path / "bundled",
    )
    (tmp_path / "bundled").mkdir(parents=True, exist_ok=True)

    edits = {"captions": {"font": "user:font_abc"}, "textItems": []}
    out = prepare_user_fonts(conn, "ws1", edits, tmp_path)
    assert out.get("_fontsDir")
    assert out["captions"]["font"] == "My Custom"
    assert out["captions"].get("_userFont") is True


def test_resolve_ass_font_name_user_family():
    name = resolve_ass_font_name({"font": "My Custom", "_userFont": True}, {"font": "Poppins"})
    assert name == "My Custom"


def test_resolve_ass_font_name_unknown_still_fallback():
    name = resolve_ass_font_name({"font": "Not A Real Font"}, {"font": "Poppins"})
    assert "Poppins" in name
