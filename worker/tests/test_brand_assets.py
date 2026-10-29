from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BRAND = REPO / "worker/assets/brand"


def test_brand_pngs_exist_and_match_web():
    pairs = [
        ("twitch_white_128.png", REPO / "new-app/public/brand/twitch_white_128.png"),
        ("kick_black_128.png", REPO / "new-app/public/brand/kick_black_128.png"),
    ]
    for name, web_path in pairs:
        worker_path = BRAND / name
        assert worker_path.is_file(), name
        assert web_path.is_file(), name
        assert worker_path.read_bytes() == web_path.read_bytes(), name


def test_brand_svgs_present_for_regen():
    assert (REPO / "new-app/public/brand/twitch.svg").is_file()
    assert (REPO / "new-app/public/brand/kick.svg").is_file()
