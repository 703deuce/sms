"""No paid Modal calls, B2 access or production job needed."""
import hashlib, io, json, tempfile, unittest, zipfile, threading
from pathlib import Path
from unittest.mock import patch
from pipeline import extract_bundle,segment_name,capture_segment,qa_video,join_and_qa

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
        (self.root/"work").mkdir()
        with patch("pipeline.fetch_file",self.fake_fetch(source)):
            path,doc,entry,audio=extract_bundle("fake_job","bundle.zip",str(self.root/"work"))
        self.assertEqual((doc["width"],doc["height"],doc["frameCount"]),(854,480,150))
        self.assertEqual(entry,"composition/index.html")
        self.assertTrue(audio.is_file())
    def test_host_reuses_ready_segment_without_capture_or_download(self):
        with patch("pipeline.ready_url",return_value="present"):
            with patch("pipeline.extract_bundle",side_effect=AssertionError("should skip bundle")):
                result=capture_segment("fake_job","bundle.zip","cpu",0,150,
                                       bundle_root=self.root)
        self.assertTrue(result["skipped"])
        self.assertEqual(result["name"],"modal_seg_v1_cpu_00000000_00000150.mp4")
    def test_dark_films_pass_technical_qa(self):
        # A near-black film is an approved creative choice, not corruption.
        probe={"streams":[{"codec_type":"video","nb_read_packets":"150",
                "width":854,"height":480,"avg_frame_rate":"30/1"},
                {"codec_type":"audio","duration":"5.0"}],
                "format":{"duration":"5.0"}}
        commands=[]
        def ffmpeg(cmd,timeout=1800,cancel_event=None):
            commands.append(cmd)
            if "ebur128=peak=true,volumedetect" in cmd:
                return "", "I: -14.3 LUFS\\nmax_volume: -2.1 dB"
            return "",""
        with patch("pipeline.ffprobe",return_value=probe),patch("pipeline.checked",side_effect=ffmpeg):
            result=qa_video("dark_with_one_line.mp4",150,30,854,480)
        self.assertEqual(result["frames"],150)
        self.assertFalse(any("blackdetect" in " ".join(c) for c in commands))
        self.assertTrue(any("-xerror" in c for c in commands))
    def test_failed_technical_qa_keeps_uploaded_master_share_and_frame(self):
        root=self.root/"bundle"
        root.mkdir()
        (root/"audio.wav").write_bytes(b"FAKE_AUDIO")
        (root/"project.json").write_text(json.dumps({
            "width":854,"height":480,"fps":30,"frameCount":150,"durationMs":5000,
            "composition":{"entryFile":"index.html"},"mixedAudioFile":"audio.wav"}))
        recovery=self.root/"recovery"
        uploaded=[]
        def fake_upload(job,source,filename,kind,mime):
            uploaded.append(filename)
            self.assertTrue(Path(source).is_file())
            return "upload_"+filename
        def fake_checked(cmd,timeout=1800,cancel_event=None):
            target=Path(cmd[-1])
            if target.name in ("joined.mp4","master.mp4","share.mp4","qa_frame.png"):
                target.write_bytes(b"FAKE_OUTPUT")
            return "",""
        segments=[{"name":"modal_seg_v1_cpu_00000000_00000150.mp4",
                   "start":0,"end":150}]
        def fake_fetch(job,filename,target,required=True,attempts=8):
            Path(target).write_bytes(b"FAKE_SEGMENT")
            return True
        with patch("pipeline.heartbeat_scope",return_value=threading.Event()),\
             patch("pipeline.fetch_file",side_effect=fake_fetch),\
             patch("pipeline.checked",side_effect=fake_checked),\
             patch("pipeline.prepare_upload",side_effect=fake_upload),\
             patch("pipeline.qa_video",side_effect=ValueError("Frame count mismatch")):
            with self.assertRaisesRegex(ValueError,"Frame count mismatch"):
                join_and_qa("msaj_test","render_bundle_v1.zip","cpu",segments,
                            bundle_root=root,recovery_dir=recovery)
        self.assertTrue((recovery/"master.mp4").is_file())
        self.assertTrue((recovery/"share.mp4").is_file())
        self.assertTrue((recovery/"qa_frame.png").is_file())
        self.assertIn("master_cpu.mp4",uploaded)
        self.assertIn("share_cpu.mp4",uploaded)
        self.assertIn("qa_frame_cpu.png",uploaded)
    def test_wrong_resolution_is_rejected(self):
        probe={"streams":[{"codec_type":"video","nb_read_packets":"150",
                "width":640,"height":480,"avg_frame_rate":"30/1"},
                {"codec_type":"audio","duration":"5.0"}],
                "format":{"duration":"5.0"}}
        with patch("pipeline.ffprobe",return_value=probe):
            with self.assertRaisesRegex(ValueError,"resolution"):
                qa_video("film.mp4",150,30,854,480)
    def test_silent_track_is_rejected(self):
        probe={"streams":[{"codec_type":"video","nb_read_packets":"150",
                "width":854,"height":480,"avg_frame_rate":"30/1"},
                {"codec_type":"audio","duration":"5.0"}],
                "format":{"duration":"5.0"}}
        def ffmpeg(cmd,timeout=1800,cancel_event=None):
            return "", ("I: -70.0 LUFS\\nmax_volume: -90.0 dB"
                        if "ebur128=peak=true,volumedetect" in cmd else "")
        with patch("pipeline.ffprobe",return_value=probe),patch("pipeline.checked",side_effect=ffmpeg):
            with self.assertRaisesRegex(ValueError,"silent"):
                qa_video("film.mp4",150,30,854,480)
    def test_segment_upload_retry_does_not_relaunch_chromium(self):
        root=self.root/"ready_bundle"
        root.mkdir()
        (root/"project.json").write_text(json.dumps({"width":854,"height":480,
            "fps":30,"frameCount":150,"composition":{"entryFile":"index.html"}}))
        (root/"index.html").write_text("window.__scene={seek:()=>{}}")
        rendered=[]
        saved=[]
        def render(cmd,timeout=1800,cancel_event=None):
            rendered.append(cmd)
            Path(cmd[4]).write_bytes(b"already rendered")
            return "",""
        def save(job,source,name,kind,mime):
            saved.append(name)
            if len(saved)==1:raise RuntimeError("Uploaded size does not match the prepared object")
            return "existing_upload_id"
        with patch("pipeline.ready_url",return_value=None),\
             patch("pipeline.heartbeat_scope",return_value=threading.Event()),\
             patch("pipeline.checked",side_effect=render),\
             patch("pipeline.prepare_upload",side_effect=save),\
             patch("pipeline.time.sleep",return_value=None):
            result=capture_segment("msaj_fake","render_bundle_v1.zip","cpu",0,150,
                                   bundle_root=root)
        self.assertEqual(len(rendered),1)
        self.assertEqual(len(saved),2)
        self.assertFalse(result["skipped"])
    def test_reject_missing_composition(self):
        source=self.build(entry="missing.html")
        (self.root/"work").mkdir()
        with patch("pipeline.fetch_file",self.fake_fetch(source)):
            with self.assertRaisesRegex(ValueError,"Full-composition"):
                extract_bundle("fake_job","bundle.zip",str(self.root/"work"))
    def test_reject_zip_traversal(self):
        source=self.build(extra={"../outside.txt":b"BAD"})
        (self.root/"work").mkdir()
        with patch("pipeline.fetch_file",self.fake_fetch(source)):
            with self.assertRaisesRegex(ValueError,"Unsafe bundle"):
                extract_bundle("fake_job","bundle.zip",str(self.root/"work"))

if __name__=="__main__":
    unittest.main()
