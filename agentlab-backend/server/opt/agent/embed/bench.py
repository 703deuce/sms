import time,sys,glob
from fastembed import TextEmbedding
txt=open("/opt/agent/workspace/skills/lab-video-producer/ref/engine-library.md").read()
chunks=[txt[i:i+1200] for i in range(0,len(txt),1200)][:40]
for m in sys.argv[1:]:
    t=time.time(); e=TextEmbedding(m, threads=3); t1=time.time()
    v=list(e.embed(chunks)); t2=time.time()
    print(m,"load %.1fs"%(t1-t),"%d chunks %.1fs => %.1f chunks/s"%(len(chunks),t2-t1,len(chunks)/(t2-t1)),len(v[0]),flush=True)
