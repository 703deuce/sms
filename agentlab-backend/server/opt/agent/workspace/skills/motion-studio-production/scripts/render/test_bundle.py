"""Producer real-layout bundle build check, offline; no Modal or API access."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile
from build_from_job import build
from make_bundle import validate

HERE=Path(__file__).resolve().parent

class RealProducerBundleTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.job=Path(self.tmp.name)
        self.film=self.job/"film"
        self.film.mkdir()
        (self.film/"film.json").write_text(json.dumps({
            "title":"Test","width":854,"height":480,"fps":30,"frameCount":150
        }))
        (self.film/"index.html").write_text(
            "<script>window.__ready=true;window.__scene={seek:async(t)=>{}};</script>")
        (self.film/"audio.wav").write_bytes(b"FAKE_AUDIO_SOURCE")
        payload=self.job/"editable"/"live"/"payload"
        payload.mkdir(parents=True)
        (payload/"live.packed.json").write_text(json.dumps({
            "durationMs":5000,"document":{"projectId":"test_project"},
            "assets":[],"bundles":[],"liveProject":{"format":{"durationMs":5000}}
        }))
    def test_build_from_original_film_and_live_dirs(self):
        result=build(self.job,self.job/"deliver_modal"/"render_bundle_v1.zip")
        self.assertEqual(result["frameCount"],150)
        with zipfile.ZipFile(result["bundle"]) as archive:
            names=set(archive.namelist())
            self.assertTrue({"project.json","index.html","audio.wav","package.json",
                 "bundles.json","live-project.json","film.json"}.issubset(names))
            self.assertEqual(json.loads(archive.read("project.json"))["durationMs"],5000)
    def test_validate_only_uses_original_cli_option(self):
        result=build(self.job,self.job/"deliver_modal"/"render_bundle_v1.zip")
        process=subprocess.run([sys.executable,str(HERE/"make_bundle.py"),
            "--validate-only",str(result["bundle"])],
            capture_output=True,text=True,timeout=30)
        self.assertEqual(process.returncode,0,process.stderr)
        self.assertTrue(json.loads(process.stdout)["verified"])
    def test_bad_duration_refuses_before_upload(self):
        payload=self.job/"editable"/"live"/"payload"/"live.packed.json"
        data=json.loads(payload.read_text())
        data["durationMs"]=4900
        payload.write_text(json.dumps(data))
        with self.assertRaises(ValueError):
            build(self.job,self.job/"deliver_modal"/"render_bundle_v1.zip")
    def test_rejects_unsafe_film_symlinks(self):
        (self.film/"link").symlink_to("/etc/passwd")
        with self.assertRaises(ValueError):
            build(self.job,self.job/"deliver_modal"/"render_bundle_v1.zip")

if __name__=="__main__":unittest.main()
