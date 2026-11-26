import json
import pathlib
import subprocess
import sys
import tempfile
import unittest
from scripts.gen_music import load_cues, make_music, id_for

BASE=pathlib.Path(__file__).resolve().parent

def plan(length,sections):
    return {"film_duration_seconds":length,"has_narration":True,"cues":[
      {"id":f"c{i}","start":i*length/sections,"end":(i+1)*length/sections,
       "prompt":"Instrumental documentary underscore with delicate harmonic motion.",
       "bpm":100,"drums":False,"vocals":False} for i in range(sections)]}

class MusicTests(unittest.TestCase):
    def test_short_60s_two_cues(self):
        with tempfile.TemporaryDirectory() as tmp:
            file=pathlib.Path(tmp)/"cues.json";file.write_text(json.dumps(plan(60,2)))
            length,cues=load_cues(file)
            self.assertEqual(length,60)
            self.assertEqual(sum(c["generated_ms"] for c in cues),60000)
            self.assertTrue(all(not c["vocals"] for c in cues))
    def test_twenty_minute_four_cues(self):
        with tempfile.TemporaryDirectory() as tmp:
            file=pathlib.Path(tmp)/"cues.json";file.write_text(json.dumps(plan(1200,4)))
            length,cues=load_cues(file)
            self.assertEqual(length,1200)
            self.assertTrue(all(c["looped"] for c in cues))
            self.assertLessEqual(sum(c["generated_ms"] for c in cues),12*60000)
    def test_join_short_cues_without_paid_calls(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp)
            file=root/"cues.json";file.write_text(json.dumps(plan(10,2)))
            total,cues=load_cues(file)
            tracks=[]
            for index in range(2):
                src=root/f"tone_{index}.mp3"
                subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-f","lavfi",
                    "-i",f"sine=frequency={330+index*110}:duration=5","-y",str(src)],check=True)
                tracks.append(src)
            result=root/"music.wav"
            make_music(result,total,cues,tracks)
            self.assertTrue(result.is_file())
            probe=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                "-of","default=nw=1:nk=1",str(result)],capture_output=True,text=True,check=True)
            self.assertLess(abs(float(probe.stdout)-10),0.05)
    def test_missing_key_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp);file=root/"cues.json";file.write_text(json.dumps(plan(60,2)))
            command=[sys.executable,str(BASE/"scripts/gen_music.py"),"--cues",str(file),
                     "--out",str(root/"music.wav")]
            result=subprocess.run(command,env={"PATH":__import__("os").environ.get("PATH","")},
                                  capture_output=True,text=True)
            self.assertEqual(result.returncode,2)
            self.assertIn("ELEVENLABS_API_KEY is not set",result.stderr)
if __name__=="__main__":unittest.main()
