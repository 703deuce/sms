from pathlib import Path
from unittest.mock import MagicMock, patch

import clips_worker.elevenlabs_dub as dub


def test_create_dubbing_multipart(tmp_path: Path):
    video = tmp_path / "x.mp4"
    video.write_bytes(b"fake")
    mock_res = MagicMock()
    mock_res.ok = True
    mock_res.json.return_value = {"dubbing_id": "dub_123"}
    with patch.dict("os.environ", {"ELEVENLABS_API_KEY": "test-key"}):
        with patch("clips_worker.elevenlabs_dub.requests.post", return_value=mock_res) as post:
            dub_id = dub.create_dubbing(video, target_lang="es", name="clip_1")
    assert dub_id == "dub_123"
    post.assert_called_once()
    _, kwargs = post.call_args
    assert kwargs["data"]["target_lang"] == "es"
    assert "file" in kwargs["files"]


def test_poll_dubbing_completes():
    ok = MagicMock()
    ok.ok = True
    ok.json.return_value = {"status": "dubbed"}
    with patch.dict("os.environ", {"ELEVENLABS_API_KEY": "test-key"}):
        with patch("clips_worker.elevenlabs_dub.requests.get", return_value=ok):
            with patch("clips_worker.elevenlabs_dub.time.sleep"):
                dub.poll_dubbing("dub_123", timeout_s=5, interval_s=0)
