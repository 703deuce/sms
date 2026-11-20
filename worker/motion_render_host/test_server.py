"""Offline checks for the private render host (no production server or paid calls)."""
from __future__ import annotations
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from unittest import mock
import urllib.error
import urllib.request

import server

class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.patchers=[
          mock.patch.object(server,"WORK",Path(self.tmp.name)),
          mock.patch.object(server,"SCRATCH",Path(self.tmp.name)/"tmp"),
          mock.patch.object(server,"STATE",Path(self.tmp.name)/"queue.json"),
          mock.patch.object(server,"SECRET","X"*40),
          mock.patch.object(server,"HOST","transovo.ai"),
        ]
        for p in self.patchers:
            p.start();self.addCleanup(p.stop)
        server.QUEUE.clear()
        server.STAGES.clear()
        server.CURRENT=None
        server.load()
    def test_missing_and_wrong_secret(self):
        self.assertFalse(server.auth_ok(""))
        self.assertFalse(server.auth_ok("Y"*40))
        self.assertTrue(server.auth_ok("X"*40))
    def test_unsafe_job_url_refused(self):
        job="msaj_1234-1234"
        valid=server.job_endpoint(job)
        self.assertTrue(server.valid_url(valid,job))
        self.assertFalse(server.valid_url("https://other.example"+urllib.request.urlparse(valid).path,job)
                         if hasattr(urllib.request,"urlparse") else
                         server.valid_url(valid.replace("transovo.ai","other.example"),job))
        self.assertFalse(server.valid_url(valid+"?token=secret",job))
        self.assertFalse(server.valid_url(valid.replace("https:","http:"),job))
    def test_restart_restores_queue(self):
        entry={"id":"msaj_1111","token":"x"*64,"url":server.job_endpoint("msaj_1111"),
               "bundle":"render_bundle_v1.zip","segmentFrames":150,"benchmark":False}
        server.QUEUE.append(entry)
        server.atomic_state()
        self.assertEqual(os.stat(server.STATE).st_mode&0o777,0o600)
        server.QUEUE.clear()
        server.load()
        self.assertEqual(len(server.QUEUE),1)
        self.assertEqual(server.QUEUE[0]["id"],entry["id"])
    def test_assignment_polling_is_completion_or_minute_based(self):
        self.assertFalse(server.should_check_assignment(159,100))
        self.assertTrue(server.should_check_assignment(160,100))
        self.assertTrue(server.should_check_assignment(101,100,completed=True))
    def test_technical_failure_retries_then_asks_for_owner_attention(self):
        entry={"id":"msaj_1357","token":"x"*64,
               "url":server.job_endpoint("msaj_1357"),
               "bundle":"render_bundle_v1.zip","segmentFrames":150,
               "benchmark":False}
        with mock.patch.object(server.pipeline,"api") as api:
            self.assertTrue(server.technical_failure(entry,"Frame count mismatch"))
            self.assertEqual(server.STAGES[entry["id"]],"retrying")
            self.assertEqual(len(server.QUEUE),1)
            self.assertFalse(server.technical_failure(entry,"Frame count mismatch"))
            self.assertEqual(server.STAGES[entry["id"]],"attention_required")
            self.assertEqual(len(server.QUEUE),1)
            self.assertFalse(any("/complete" in str(call) for call in api.call_args_list))
            self.assertTrue(any("attention_required" in str(call)
                                for call in api.call_args_list))
    def test_attention_required_job_preserves_recovery_after_restart(self):
        root=server.WORK/"job_msaj_1357"
        (root/"recovery").mkdir(parents=True)
        (root/"recovery"/"master.mp4").write_bytes(b"finished video")
        server.STAGES["msaj_1357"]="attention_required"
        server.atomic_state()
        server.load()
        self.assertEqual((root/"recovery"/"master.mp4").read_bytes(),b"finished video")
    def test_disk_guard(self):
        with mock.patch.object(server,"disk_metrics",return_value=(91,1000000)):
            self.assertEqual(server.disk_ready()[0],False)
        with mock.patch.object(server,"disk_metrics",return_value=(50,1000000)):
            self.assertEqual(server.disk_ready(2000000)[0],False)
    def test_private_duplicate_enqueue(self):
        with mock.patch.object(server,"verify_job",return_value=True):
            http=server.ThreadingHTTPServer(("127.0.0.1",0),server.Handler)
            self.addCleanup(http.server_close)
            thread=threading.Thread(target=http.serve_forever,daemon=True)
            thread.start()
            self.addCleanup(http.shutdown)
            url=f"http://127.0.0.1:{http.server_address[1]}/enqueue"
            data={"jobId":"msaj_5555-aaaa","token":"z"*64,
                  "jobUrl":server.job_endpoint("msaj_5555-aaaa"),
                  "segmentFrames":150,"bundle":"render_bundle_v1.zip"}
            headers={"X-Render-Host-Secret":"X"*40,"Content-Type":"application/json"}
            def post(key="X"*40):
                req=urllib.request.Request(url,method="POST",
                     headers={**headers,"X-Render-Host-Secret":key},
                     data=json.dumps(data).encode())
                try:
                    with urllib.request.urlopen(req,timeout=10) as response:
                        return response.status,json.loads(response.read())
                except urllib.error.HTTPError as exc:
                    return exc.code,json.loads(exc.read())
            status,one=post()
            again,duplicate=post()
            self.assertEqual((status,again),(202,200))
            self.assertFalse(one["alreadyExists"])
            self.assertTrue(duplicate["alreadyExists"])
            self.assertEqual(len(server.QUEUE),1)
            wrong,_=post("invalid")
            self.assertEqual(wrong,401)
    def test_cancelled_queued_heartbeat_does_not_log_secret(self):
        entry={"id":"msaj_9999","token":"private-long-token",
               "url":server.job_endpoint("msaj_9999")}
        with mock.patch.object(server.SESSION,"get") as get:
            get.return_value.status_code=409
            self.assertFalse(server.isolated_ping(entry))
    def test_one_current_job_and_fifo_queue_only(self):
        first={"id":"msaj_first","token":"x"*64,"url":server.job_endpoint("msaj_first")}
        second={"id":"msaj_second","token":"x"*64,"url":server.job_endpoint("msaj_second")}
        server.CURRENT=first
        server.QUEUE.append(second)
        server.atomic_state()
        stored=json.loads(server.STATE.read_text())
        self.assertEqual(stored["running"]["id"],first["id"])
        self.assertEqual([i["id"] for i in stored["queue"]],[second["id"]])
    def test_failed_and_cancelled_scratch_deleted(self):
        for stage in ("failed","cancelled"):
            root=server.WORK/("job_msaj_"+stage)
            root.mkdir()
            (root/"unused.mp4").write_bytes(b"unsafe")
            # On startup, orphan temporary files must be removed regardless of state.
            server.STAGES["msaj_"+stage]=stage
            server.atomic_state()
            server.load()
            self.assertFalse(root.exists())
    def test_no_token_or_signed_url_in_public_liveness_or_queue_response(self):
        with mock.patch.object(server,"verify_job",return_value=True):
            http=server.ThreadingHTTPServer(("127.0.0.1",0),server.Handler)
            self.addCleanup(http.server_close)
            thread=threading.Thread(target=http.serve_forever,daemon=True)
            thread.start()
            self.addCleanup(http.shutdown)
            origin=f"http://127.0.0.1:{http.server_address[1]}"
            entry={"jobId":"msaj_secret-test","token":"super_private_test_token_987654",
                "jobUrl":server.job_endpoint("msaj_secret-test"),
                "segmentFrames":150,"bundle":"render_bundle_v1.zip"}
            body=json.dumps(entry).encode()
            req=urllib.request.Request(origin+"/enqueue",data=body,method="POST",
                headers={"X-Render-Host-Secret":"X"*40,"Content-Type":"application/json"})
            with urllib.request.urlopen(req,timeout=5) as r:
                submitted=r.read().decode()
            with urllib.request.urlopen(origin+"/livez",timeout=5) as r:
                live=r.read().decode()
            status_req=urllib.request.Request(origin+"/jobs/msaj_secret-test",
                headers={"X-Render-Host-Secret":"X"*40})
            with urllib.request.urlopen(status_req,timeout=5) as r:
                status=r.read().decode()
            for answer in (submitted,live,status):
                self.assertNotIn("super_private_test_token",answer)
                self.assertNotIn("https://",answer)
            self.assertEqual(json.loads(live),{"ok":True})
    def test_finished_job_temp_cleanup(self):
        root=server.WORK/"job_msaj_7777"
        root.mkdir()
        (root/"partial.tmp").write_text("temporary")
        server.load()
        self.assertFalse(root.exists())

if __name__=="__main__":
    unittest.main()
