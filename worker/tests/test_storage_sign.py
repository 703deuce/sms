import json
from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError

from clips_worker.storage import sign_upload_url, sign_url


@patch.dict(
    "os.environ",
    {
        "STORAGE_DRIVER": "s3",
        "S3_BUCKET": "clips",
        "S3_ENDPOINT": "https://s3.us-east-005.backblazeb2.com",
        "S3_ACCESS_KEY_ID": "k",
        "S3_SECRET_ACCESS_KEY": "s",
        "SUPABASE_URL": "https://x.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "k",
    },
)
def test_sign_url_s3_miss_falls_back_to_supabase():
    payload = json.dumps({"signedURL": "/object/sign/clips/ws/a?token=t"}).encode()

    class Resp:
        def read(self):
            return payload

        def __enter__(self):
            return self

        def __exit__(self, *a):
            pass

    missing = ClientError({"Error": {"Code": "404", "Message": "Not Found"}}, "HeadObject")

    with patch("clips_worker.storage._s3_object_meta", side_effect=missing):
        with patch("urllib.request.urlopen", return_value=Resp()):
            url = sign_url("ws/legacy-audio.wav")
    assert "supabase.co" in url


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
