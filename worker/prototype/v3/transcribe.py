"""Local ASR with word timestamps (faster-whisper, CPU int8). usage: python transcribe.py input.mp4 words.json [model]"""
import sys, json, time, subprocess, numpy as np
from faster_whisper import WhisperModel
t0 = time.time()
model = WhisperModel(sys.argv[3] if len(sys.argv) > 3 else 'small', device='cpu', compute_type='int8')
# decode with ffmpeg ourselves (avoids PyAV version issues)
pcm = subprocess.run(['ffmpeg','-v','error','-i',sys.argv[1],'-ac','1','-ar','16000','-f','s16le','-'], capture_output=True).stdout
audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
segs, info = model.transcribe(audio, language='en', word_timestamps=True, vad_filter=True,
                              vad_parameters=dict(min_silence_duration_ms=300), beam_size=5, condition_on_previous_text=False)
words = [dict(w=w.word.strip(), s=round(w.start, 3), e=round(w.end, 3), p=round(w.probability, 3)) for s in segs for w in s.words]
json.dump(words, open(sys.argv[2], 'w'), indent=0)
print(f'{len(words)} words, {time.time()-t0:.1f}s')
