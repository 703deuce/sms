import sys,numpy as np,subprocess
from faster_whisper import WhisperModel
m=WhisperModel('small.en',device='cpu',compute_type='int8',cpu_threads=2)
src=sys.argv[1];tmp='/tmp/tr_'+src.split('/')[-1]+'.raw'
subprocess.run(['ffmpeg','-v','error','-y','-i',src,'-ac','1','-ar','16000','-f','f32le',tmp],check=True)
a=np.fromfile(tmp,dtype=np.float32)
segs,_=m.transcribe(a)
for s in segs: print(f"{s.start:6.1f}-{s.end:6.1f} {s.text}",flush=True)
