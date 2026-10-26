import json
from unittest.mock import MagicMock, patch

from clips_worker.storage import sign_upload_url, sign_url


@patch.dict("os.environ", {"SUPABASE_URL": "https://x.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "k"})
def test_sign_url():
    payload = json.dumps({"signedURL": "/object/sign/clips/ws/a?token=t"}).encode()

    class Resp:
        def read(self):
            return payload

        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

    with patch("urllib.request.urlopen", return_value=Resp()):
        url = sign_url("ws/a")
    assert "supabase.co" in url


@patch.dict("os.environ", {"SUPABASE_URL": "https://x.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "k"})
def test_sign_upload_url():
    payload = json.dumps({"url": "https://upload", "token": "tok"}).encode()

    class Resp:
        def read(self):
            return payload

        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

    with patch("urllib.request.urlopen", return_value=Resp()):
        out = sign_upload_url("ws/a")
    assert out["url"] == "https://upload"
    assert out["token"] == "tok"
