"""No-charge handoff tests: no job API, render worker or Modal access."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

SCRIPT=Path(__file__).with_name("submit.py")

class ProducerSubmissionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.job=Path(self.temp.name)
        folder=self.job/"deliver_modal"
        folder.mkdir()
        self.project={"width":854,"height":480,"fps":30,"frameCount":1800,"durationMs":60000}
        with zipfile.ZipFile(folder/"render_bundle_v1.zip","w") as archive:
            archive.writestr("project.json",json.dumps(self.project))
        self.env={**os.environ,
            "MOTION_JOB_ID":"msaj_12345678",
            "MOTION_JOB_URL":"https://transovo.ai/api/motion-studio/agent/jobs/msaj_12345678",
            "MOTION_JOB_TOKEN":"this-is-only-a-fake-test-token",
            "RENDER_BACKEND":"self_hosted","DRY_RUN":"1",
            "MOTION_MODAL_FALLBACK":"0"}
        self.env.pop("MOTION_SEGMENT_FRAMES",None)
    def invoke(self):
        return subprocess.run([sys.executable,str(SCRIPT),str(self.job)],env=self.env,
            capture_output=True,text=True,timeout=15)
    def test_dry_run_uses_self_hosted_and_twelve_ranges(self):
        result=self.invoke()
        self.assertEqual(result.returncode,0,result.stderr)
        value=json.loads(result.stdout)
        self.assertEqual(value["backend"],"self_hosted")
        self.assertEqual(value["segmentFrames"],150)
        self.assertEqual(value["segments"],12)
        self.assertFalse((self.job/"deliver_modal"/"submit.json").exists())
    def test_retry_keeps_source_interval(self):
        (self.job/"deliver_modal"/"reuse.json").write_text(
            json.dumps({"sourceJobId":"msaj_oldjob","segmentFrames":300}))
        result=self.invoke()
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(json.loads(result.stdout)["segments"],6)
        self.env["MOTION_SEGMENT_FRAMES"]="150"
        rejected=self.invoke()
        self.assertNotEqual(rejected.returncode,0)
    def test_missing_bundle_refuses_without_network(self):
        (self.job/"deliver_modal"/"render_bundle_v1.zip").unlink()
        result=self.invoke()
        self.assertNotEqual(result.returncode,0)
    def test_invalid_origin_fails_closed(self):
        self.env["MOTION_JOB_URL"]="https://untrusted.example/jobs/msaj_12345678"
        self.assertNotEqual(self.invoke().returncode,0)

if __name__=="__main__":unittest.main()
