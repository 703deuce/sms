"""No paid Modal calls, B2 access or production job needed."""
import hashlib, io, json, tempfile, unittest, zipfile
from pathlib import Path
from unittest.mock import patch
from pipeline import extract_bundle,segment_name

class BundleTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
    def test_segment_id_is_stable(self):
        self.assertEqual(segment_name("cpu",0,30),"modal_seg_v1_cpu_00000000_00000030.mp4")
    def build(self,extra=None,entry="composition/index.html"):
        payload={
            "project.json":json.dumps({"width":854,"height":480,"fps":30,
              "frameCount":150,"durationMs":5000,
              "composition":{"entryFile":entry},"mixedAudioFile":"audio/mixed.wav"}).encode(),
            "composition/index.html":b"<html><script>window.__scene={seek:()=>{}}</script></html>",
            "audio/mixed.wav":b"FAKE",
        }
        payload.update(extra or {})
        archive=self.root/"source.zip"
        with zipfile.ZipFile(archive,"w") as z:
            for k,v in payload.items():z.writestr(k,v)
        return archive
    def fake_fetch(self,archive):
        def copy(job,filename,target,required=True):
            Path(target).write_bytes(archive.read_bytes())
            return True
        return copy
    def test_native_480p_bundle(self):
        source=self.build()
        with patch("pipeline.fetch_file",self.fake_fetch(source)):
            path,doc,entry,audio=extract_bundle("fake_job","bundle.zip",str(self.root/"work"))
        self.assertEqual((doc["width"],doc["height"],doc["frameCount"]),(854,480,150))
        self.assertEqual(entry,"composition/index.html")
        self.assertTrue(audio.is_file())
    def test_reject_missing_composition(self):
        source=self.build(entry="missing.html")
        with patch("pipeline.fetch_file",self.fake_fetch(source)):
            with self.assertRaisesRegex(ValueError,"Full-composition"):
                extract_bundle("fake_job","bundle.zip",str(self.root/"work"))
    def test_reject_zip_traversal(self):
        source=self.build(extra={"../outside.txt":b"BAD"})
        with patch("pipeline.fetch_file",self.fake_fetch(source)):
            with self.assertRaisesRegex(ValueError,"Unsafe bundle"):
                extract_bundle("fake_job","bundle.zip",str(self.root/"work"))

if __name__=="__main__":
    unittest.main()
