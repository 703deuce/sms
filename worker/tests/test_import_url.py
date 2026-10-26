from clips_worker.import_url_parse import (
    classify_url,
    drive_download_url,
    normalize_dropbox_url,
    parse_drive_file_id,
)


def test_classify_drive_dropbox_youtube():
    assert classify_url("https://drive.google.com/file/d/abc123/view?usp=sharing") == "drive"
    assert classify_url("https://www.dropbox.com/s/xyz/video.mp4?dl=0") == "dropbox"
    assert classify_url("https://youtu.be/abc") == "youtube"
    assert classify_url("https://example.com/x") == "unsupported"


def test_parse_drive_id():
    assert parse_drive_file_id("https://drive.google.com/file/d/AbC-12/view") == "AbC-12"
    assert parse_drive_file_id("https://drive.google.com/open?id=foo9") == "foo9"


def test_dropbox_dl_rewrite():
    u = normalize_dropbox_url("https://www.dropbox.com/s/abc/file.mp4?dl=0")
    assert "dl=1" in u
    u2 = normalize_dropbox_url("https://www.dropbox.com/scl/fi/abc/file.mp4")
    assert "raw=1" in u2


def test_drive_download_url():
    assert "id=abc" in drive_download_url("abc")
