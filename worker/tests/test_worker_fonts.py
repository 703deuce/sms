"""Montserrat must be available for polished caption burn (image + fontconfig)."""
import os
import shutil
import subprocess
from pathlib import Path

import pytest

V3 = Path(os.environ.get("SPEAKERCROP_DIR", "/app/v3"))


def test_montserrat_ttf_in_v3_fontsdir():
    font = V3 / "fonts" / "Montserrat-Black.ttf"
    if not font.is_file():
        pytest.skip("Montserrat-Black.ttf not synced (run worker image build)")
    assert font.stat().st_size > 10_000


def test_fontconfig_lists_montserrat_when_available():
    if not shutil.which("fc-list"):
        pytest.skip("fontconfig not installed")
    try:
        out = subprocess.check_output(["fc-list", ":", "family"], text=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pytest.skip("fc-list failed")
    if "Montserrat" not in out:
        pytest.skip("Montserrat not installed on this host (expected in worker image)")
    assert "Montserrat" in out


def test_poppins_extrabold_in_v3_fontsdir():
    font = V3 / "fonts" / "Poppins-ExtraBold.ttf"
    if not font.is_file():
        pytest.skip("Poppins-ExtraBold.ttf not synced (run worker image build)")
    assert font.stat().st_size > 10_000


def test_fontconfig_lists_poppins_when_available():
    if not shutil.which("fc-list"):
        pytest.skip("fontconfig not installed")
    try:
        out = subprocess.check_output(["fc-list", ":", "family"], text=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pytest.skip("fc-list failed")
    if "Poppins" not in out:
        pytest.skip("Poppins not installed on this host (expected in worker image)")
    assert "Poppins" in out


# --- EP1: pinned fonts + canonical libass family names --------------------------------------
import hashlib  # noqa: E402

# sha256 of the repo copies (= the files the editor preview's libass-wasm loads from
# new-app/public/fonts/clip). The image used to curl GitHub master for Montserrat / Anton.
PINNED_SHA256 = {
    "Anton-Regular.ttf": "a4ba3a92350ebb031da0cb47630ac49eb265082ca1bc0450442f4a83ab947cab",
    "Montserrat-Black.ttf": "ea67b37f8776eebea135cd1fe9adeaf6f9427683e8dc11ab8398b6be5f102c60",
    "Poppins-ExtraBold.ttf": "94a215f88fbde9099cb3bd1431b8142aba26af36f8771effec56a94bc3aad1fd",
}
_REPO = Path(__file__).resolve().parent.parent.parent


@pytest.mark.parametrize("name,sha", sorted(PINNED_SHA256.items()))
def test_bundled_fonts_are_pinned(name, sha):
    for d in (V3 / "fonts", _REPO / "worker" / "prototype" / "v3" / "fonts"):
        if (d / name).is_file():
            assert hashlib.sha256((d / name).read_bytes()).hexdigest() == sha
            return
    pytest.skip(f"{name} not present")


def test_web_preview_fonts_equal_worker_fonts():
    web = _REPO / "new-app" / "public" / "fonts" / "clip"
    if not web.is_dir():
        pytest.skip("new-app not in this tree (worker image)")
    pairs = {f: _REPO / "worker" / "prototype" / "v3" / "fonts" / f for f in PINNED_SHA256}
    for f in ("ArchivoBlack.ttf", "Bangers.ttf", "BebasNeue.ttf", "Inter.ttf", "Lato.ttf", "LuckiestGuy.ttf", "Oswald.ttf"):
        pairs[f] = _REPO / "worker" / "v3" / "fonts" / "t6" / f
    for f, src in pairs.items():
        assert (web / f).read_bytes() == src.read_bytes(), f


@pytest.mark.parametrize(
    "family,file",
    [("Montserrat Black", "Montserrat-Black.ttf"), ("Poppins ExtraBold", "Poppins-ExtraBold.ttf"),
     ("Anton", "Anton-Regular.ttf"), ("Lato Black", "Lato.ttf"), ("DejaVu Sans:bold", "DejaVuSans-Bold.ttf")],
)
def test_fontconfig_resolves_canonical_names(family, file):
    if not shutil.which("fc-match") or not (V3 / "fonts" / "Anton-Regular.ttf").is_file():
        pytest.skip("worker image only")
    out = subprocess.check_output(["fc-match", "-f", "%{file}", family], text=True)
    assert out.endswith(file), (family, out)


# The Docker image must use the same 13 pinned ASS faces as the browser.
# Run the real fontconfig resolution checks in the image, where all fonts exist.
_PINNED_T6_FAMILIES = (
    ("Rubik", "Rubik.ttf"),
    ("Gabarito", "Gabarito.ttf"),
    ("Fira Sans Condensed", "FiraSansCondensed-Bold.ttf"),
    ("DM Serif Display", "DMSerifDisplay-Regular.ttf"),
    ("Playfair Display", "PlayfairDisplay.ttf"),
    ("Caveat", "Caveat.ttf"),
    ("Space Grotesk", "SpaceGrotesk.ttf"),
    ("Space Mono", "SpaceMono-Regular.ttf"),
    ("Noto Sans Arabic", "NotoSansArabic.ttf"),
    ("Noto Sans Devanagari", "NotoSansDevanagari.ttf"),
    ("Noto Sans Thai", "NotoSansThai.ttf"),
    ("Noto Sans JP", "NotoSansJP.ttf"),
    ("Noto Emoji", "NotoEmoji.ttf"),
)


@pytest.mark.parametrize("family,filename", _PINNED_T6_FAMILIES)
def test_image_fontconfig_uses_exact_pinned_t6_bytes(family, filename):
    pinned = V3 / "fonts" / "t6" / filename
    if not pinned.is_file():
        pytest.skip("pinned T6 font not installed on this host (run worker image)")
    if not shutil.which("fc-match"):
        pytest.skip("fontconfig not installed")
    selected = subprocess.check_output(["fc-match", "-f", "%{file}", family], text=True)
    assert Path(selected).is_file(), (family, selected)
    assert Path(selected).read_bytes() == pinned.read_bytes(), (
        family, f"fontconfig selected {selected!r} rather than pinned {pinned}"
    )


def test_docker_font_install_does_not_install_conflicting_emoji_package():
    source = _REPO / "worker" / "Dockerfile"
    if not source.is_file():
        pytest.skip("source checkout only; Dockerfile not copied into worker image")
    dockerfile = source.read_text()
    install_block = dockerfile.split("RUN apt-get update", 1)[1].split("&& rm -rf", 1)[0]
    assert "fonts-noto-color-emoji" not in install_block
    # Retain the strict image-build checks for every pinned ASS family.
    for family, filename in _PINNED_T6_FAMILIES:
        assert f"""cmp -s "$(fc-match -f '%{{file}}' '{family}')" "/app/v3/fonts/t6/{filename}" """ .strip() in dockerfile


def test_brand_installer_does_not_download_duplicate_playfair():
    source = _REPO / "worker" / "scripts" / "download-brand-google-fonts.sh"
    if not source.is_file():
        pytest.skip("source checkout only; installer not copied to this image path")
    installer = source.read_text()
    commands = "\n".join(
        line for line in installer.splitlines() if not line.lstrip().startswith("#")
    )
    assert "PlayfairDisplay-wght.ttf" not in commands
    assert "playfairdisplay/PlayfairDisplay" not in commands
