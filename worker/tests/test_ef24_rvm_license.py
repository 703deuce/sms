from pathlib import Path


def test_rvm_license_files():
    lic = Path(__file__).resolve().parents[1] / "modal_app" / "third_party" / "rvm" / "LICENSE"
    notice = Path(__file__).resolve().parents[1] / "modal_app" / "third_party" / "rvm" / "NOTICE.md"
    root = Path(__file__).resolve().parents[2] / "THIRD_PARTY_NOTICES"
    text = lic.read_text(encoding="utf-8")
    assert "GNU GENERAL PUBLIC LICENSE" in text
    assert "Version 3" in text
    n = notice.read_text(encoding="utf-8")
    assert "Peter Lin" in n
    assert "WACV 2022" in n
    assert "53d74c6826735f01f4406b5ca9075eee27bec094" in n
    assert "RobustVideoMatting" in root.read_text(encoding="utf-8")


def test_worker_image_never_imports_matte():
    root = Path(__file__).resolve().parents[1] / "clips_worker"
    bad = []
    for p in root.rglob("*.py"):
        src = p.read_text(encoding="utf-8", errors="replace")
        if "modal_app.matte" in src or "torch.hub" in src:
            bad.append(str(p.relative_to(root)))
    assert bad == []
