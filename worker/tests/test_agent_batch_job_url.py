import os
import json
from unittest.mock import patch
from clips_worker.streamer.agent_batch_job import handle_stream_agent_batch

class FakeResponse:
    status=200
    def __enter__(self): return self
    def __exit__(self,*args): pass
    def read(self): return json.dumps({"data":{"status":"running"}}).encode()

def test_tick_uses_worker_callback_url(monkeypatch):
    monkeypatch.setenv("WORKER_CALLBACK_URL","https://callback.example")
    monkeypatch.delenv("APP_URL",raising=False)
    monkeypatch.setenv("WORKER_SHARED_SECRET","secret")
    with patch("clips_worker.main._mark_job_done") as done:
        with patch("urllib.request.urlopen",return_value=FakeResponse()) as urlopen:
            handle_stream_agent_batch(None,{"id":"job_1","projectId":"proj_1","payload":{"batchId":"batch_1"}})
    req=urlopen.call_args.args[0]
    assert req.full_url=="https://callback.example/api/internal/streamer/agent-batches/tick"
    done.assert_called_once_with(None,"job_1")
