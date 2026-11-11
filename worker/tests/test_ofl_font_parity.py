"""Batch 2 pinned OFL font and renderer contract; no network or paid model calls."""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import pytest
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
SOURCES = json.loads((ROOT / "new-app/scripts/pinned-ofl-font-sources.json").read_text())
BROWSER = ROOT / "new-app/public/fonts/clip"
WORKER = ROOT / "worker/v3/fonts/t6"


def blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


@pytest.mark.parametrize("font", SOURCES["fonts"], ids=lambda f: f["slug"])
def test_pinned_font_licensed_and_byte_identical(font):
    browser = BROWSER / font["local"]
    worker = WORKER / font["local"]
    a = browser.read_bytes()
    b = worker.read_bytes()
    assert a == b, font["slug"]
    assert len(a) == font["size"]
    assert blob_sha(a) == font["blobSha"]
    for dir_ in (BROWSER, WORKER):
        license_bytes = (dir_ / "licenses" / (font["slug"] + "-OFL.txt")).read_bytes()
        assert blob_sha(license_bytes) == font["licenseBlobSha"]
        assert b"SIL OPEN FONT LICENSE Version 1.1" in license_bytes
    parsed = TTFont(worker)
    names = parsed["name"].names
    family_names = {
        n.toUnicode() for n in names if n.nameID in (1, 16)
    }
    assert font["assFamily"] in family_names, (font["assFamily"], sorted(family_names))
    cmap = parsed.getBestCmap() or {}
    # Every selected display face must at least cover the printable Latin reference fixtures.
    assert all(ord(ch) in cmap for ch in "AaZz09!?"), font["slug"]


@pytest.mark.parametrize("font", SOURCES["fonts"], ids=lambda f: f["slug"])
def test_worker_resolves_exact_ass_family_if_font_is_installed(font):
    from clips_worker.captions_ass import resolve_ass_font_name
    from clips_worker.text_items import font_names

    name = font["assFamily"]
    assert resolve_ass_font_name({}, {"font": name}) == name
    assert font_names({"font": name})[0] == name


def test_unicode_fallback_assets_cover_latin_greek_cyrillic_without_tofu():
    from fontTools.ttLib import TTFont
    fallback = TTFont(BROWSER / "DejaVuSans-Bold.ttf").getBestCmap()
    assert fallback
    for ch in "¡éΚαλημέραПривет":
        assert ord(ch) in fallback, f"missing DejaVu fallback glyph U+{ord(ch):04X}"


def test_merged_user_fonts_directory_includes_pinned_t6(tmp_path):
    from clips_worker.user_fonts import merged_fonts_dir

    uploaded = tmp_path / "uploaded.ttf"
    uploaded.write_bytes((BROWSER / "Rubik.ttf").read_bytes())
    merged = merged_fonts_dir(ROOT / "worker/prototype/v3/fonts", [uploaded], tmp_path / "fonts")
    assert (merged / "uploaded.ttf").is_file()
    for f in SOURCES["fonts"]:
        assert (merged / f["local"]).is_file(), f["slug"]
    assert (merged / "Poppins-ExtraBold.ttf").is_file()


@pytest.mark.parametrize("font", SOURCES["fonts"], ids=lambda f: f["slug"])
def test_fontconfig_selects_pinned_family(font):
    result = subprocess.run(["fc-match", "-f", "%{file}", font["assFamily"]],
                            capture_output=True, text=True, check=True)
    assert result.stdout.endswith("/" + font["local"]), (font["assFamily"], result.stdout)

@pytest.mark.parametrize("font", SOURCES["fallbackFonts"], ids=lambda f: f["slug"])
def test_pinned_unicode_fallback_bytes_and_licenses(font):
    browser = (BROWSER / font["local"]).read_bytes()
    worker = (WORKER / font["local"]).read_bytes()
    assert browser == worker
    assert len(browser) == font["size"]
    assert blob_sha(browser) == font["blobSha"]
    for root in (BROWSER, WORKER):
        notice = (root / "licenses" / (font["slug"] + "-OFL.txt")).read_bytes()
        assert blob_sha(notice) == font["licenseBlobSha"]
        assert b"SIL OPEN FONT LICENSE Version 1.1" in notice


@pytest.mark.parametrize("slug,fixture", [
    ("notosansarabic", "مرحبا"),
    ("notosansdevanagari", "नमस्ते"),
    ("notosansthai", "สวัสดี"),
    ("notosansjp", "日本語"),
    ("notoemoji", "🙂"),
])
def test_mixed_unicode_has_actual_pinned_fallback_glyphs(slug, fixture):
    row = next(r for r in SOURCES["fallbackFonts"] if r["slug"] == slug)
    cmap = TTFont(WORKER / row["local"]).getBestCmap() or {}
    missing = [hex(ord(ch)) for ch in fixture if ord(ch) not in cmap]
    assert not missing, (slug, missing)
