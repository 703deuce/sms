import sys
import urllib.error
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

sys.modules.setdefault("psycopg2", MagicMock())
sys.modules.setdefault("psycopg2.extras", MagicMock())

from clips_worker.streamer.autopull_job import _match_twitch_vod
from clips_worker.streamer.errors import RetryableError


def test_helix_503_raises_retryable(monkeypatch):
    monkeypatch.setenv("TWITCH_CLIENT_ID", "cid")
    monkeypatch.setenv("TWITCH_CLIENT_SECRET", "secret")

    err = urllib.error.HTTPError(
        url="https://api.twitch.tv/helix/videos",
        code=503,
        msg="Service Unavailable",
        hdrs=None,
        fp=MagicMock(read=MagicMock(return_value=b'{"error":"unavailable"}')),
    )

    with (
        patch("clips_worker.streamer.autopull_job._helix_app_token", return_value="token"),
        patch("urllib.request.urlopen", side_effect=err),
    ):
        with pytest.raises(RetryableError):
            _match_twitch_vod("user1", datetime(2024, 1, 1, tzinfo=timezone.utc))
