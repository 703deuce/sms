import sys,numpy as np,subprocess
from faster_whisper import WhisperModel
m=WhisperModel('small.en',device='cpu',compute_type='int8')
src,ss,t=sys.argv[1],float(sys.argv[2]),float(sys.argv[3])
subprocess.run(['ffmpeg','-v','error','-y','-ss',str(ss),'-t',str(t),'-i',src,'-ac','1','-ar','16000','-f','f32le','/tmp/trw.raw'],check=True)
a=np.fromfile('/tmp/trw.raw',dtype=np.float32)
segs,_=m.transcribe(a,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
for s in segs:
    for w in s.words: print(f"{ss+w.start:7.2f} {ss+w.end:7.2f} {w.word}")
