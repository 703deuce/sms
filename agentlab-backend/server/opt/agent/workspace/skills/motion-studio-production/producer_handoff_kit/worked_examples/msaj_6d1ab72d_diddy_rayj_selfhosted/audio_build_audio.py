import json,numpy as np,subprocess,wave,os
from scipy import signal
SR=48000;DUR=30.0;N=int(DUR*SR)
J='/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/'
os.chdir(J)
def load(path,ss=None,t=None):
    cmd=['ffmpeg','-v','error','-y']
    if ss is not None: cmd+=['-ss',str(ss)]
    if t is not None: cmd+=['-t',str(t)]
    cmd+=['-i',path,'-ac','2','-ar',str(SR),'-f','f32le','/tmp/_ld.raw']
    subprocess.run(cmd,check=True)
    return np.fromfile('/tmp/_ld.raw',dtype=np.float32).reshape(-1,2)
def place(buf,x,t0,g=1.0):
    i=int(round(t0*SR));n=min(len(x),N-i)
    if n>0: buf[i:i+n]+=x[:n]*g
def fade(x,a=.01,b=.02):
    x=x.copy();fa=int(a*SR);fb=int(b*SR)
    if fa:x[:fa]*=np.linspace(0,1,fa)[:,None]
    if fb:x[-fb:]*=np.linspace(1,0,fb)[:,None]
    return x
W=json.load(open('audio/words_src.json'))
# line blocks: (line, src0, src1, film t0)
shift={'L1':.70,'L2':.369,'L3':.036,'L4':3.214,'L5':6.406,'L6':6.309,'L7':6.16}
nar=np.zeros((N,2),np.float32);fa=np.zeros((N,2),np.float32);sfx=np.zeros((N,2),np.float32)
full=load('audio/narration.mp3')
SRC={'L1':(0,4.26),'L2':(4.771,8.464),'L3':(8.974,12.411),'L4':(12.736,15.685),'L5':(15.894,18.193),'L6':(18.471,19.865),'L7':(20.19,21.873)}
for k in W:
    o0,o1=SRC[k];a0=max(0,o0-.04)
    seg=full[int(a0*SR):int((o1+.10)*SR)]
    place(nar,fade(seg,.006,.05),a0+shift[k])
# real clip audio (talking clips)
ca=load('assets/footage/o4.mp4',33.05,3.2);place(fa,fade(ca,.03,.12),12.60)
cb=load('assets/footage/o5.mp4',6.82,3.0);place(fa,fade(cb,.02,.10),19.00)
rng=np.random.default_rng(7)
def bn(f0,f1,n):
    r=rng.standard_normal(n).astype(np.float32);b,a=signal.butter(2,[f0/(SR/2),f1/(SR/2)],'band');return signal.lfilter(b,a,r)
st=lambda x:np.stack([x,x],1)
def chk(g=1):  # printer tick
    n=int(.045*SR);t=np.arange(n)/SR;return (bn(1800,6500,n)*np.exp(-t*70)*1.6+np.sin(2*np.pi*2400*t)*np.exp(-t*160)*.5).astype(np.float32)
def thud():
    n=int(.7*SR);t=np.arange(n)/SR;return (np.sin(2*np.pi*(52+60*np.exp(-t*30))*t)*np.exp(-t*7)*1.1+bn(200,1800,n)*np.exp(-t*38)*.8).astype(np.float32)
def tear(d=.42):
    n=int(d*SR);t=np.arange(n)/SR;w=bn(1500,9000,n)*np.sin(np.pi*np.linspace(0,1,n))**.8
    w2=bn(300,1200,n)*np.exp(-t*8)*.5;return (w*.9+w2).astype(np.float32)
def boom(d=1.6):
    n=int(d*SR);t=np.arange(n)/SR;return (np.sin(2*np.pi*(38+40*np.exp(-t*9))*t)*np.exp(-t*2.2)*1.0+bn(80,500,n)*np.exp(-t*6)*.4).astype(np.float32)
prints=[(.10,8,.11),(1.08,11,.2),(5.55,10,.2),(9.1,11,.19),(12.45,11,.18),(15.95,11,.2),(18.65,9,.2),(22.25,9,.19),(24.95,5,.18),(26.5,10,.2)]
for t0,n,dt in prints:
    for i in range(n):
        tt=t0+i*dt
        for j in range(3): place(sfx,st(chk()),tt+j*.028,.16*(1 if j==0 else .6))
for tb in [1.0,5.3,9.0,12.5,15.8,18.6,22.2,24.5,26.3]:
    place(sfx,st(tear()),tb-.14,.5)
for th in [3.28,7.05,10.55,17.7,18.95,23.35,25.35]: place(sfx,st(thud()),th,.62)
place(sfx,st(boom()),24.78,.55);place(sfx,st(boom(1.4)),28.55,.7)
# keep sfx out of the real clip audio windows (12.6-15.8, 19.0-22.0): gentle dip
mask=np.ones(N)
for a,b in [(12.55,15.85),(19.0,22.05)]:
    i0,i1=int(a*SR),int(b*SR);mask[i0:i1]=.12
sfx=sfx*mask[:,None]
mu=load('audio/music.wav')[:N]
if len(mu)<N: mu=np.pad(mu,((0,N-len(mu)),(0,0)))
voice=nar+fa
env_v=np.abs(voice).mean(axis=1);k=int(.10*SR);env_v=np.convolve(env_v,np.ones(k)/k,'same');env_v=np.clip(env_v/0.02,0,1)
env_v=signal.filtfilt([0.003],[1,-0.997],env_v);env_v=np.clip(env_v*1.25,0,1)
def rms_db(x):return 20*np.log10(np.sqrt((x**2).mean())+1e-9)
speech=np.abs(voice).mean(axis=1)>0.02
vr=rms_db(voice[speech]);open_g=0.55
for dg in np.linspace(0.30,0.005,80):
    g=open_g*(1-env_v)+dg*env_v;m=mu*g[:,None]
    if rms_db(m[speech])<=vr-21: break
music=mu*g[:,None]
music[:int(.05*SR)]*=np.linspace(0,1,int(.05*SR))[:,None];music[-int(.08*SR):]*=np.linspace(1,0,int(.08*SR))[:,None]
sfx=(np.tanh(sfx*1.2)/1.2).astype(np.float32)
mix=nar*1.0+fa*0.85+music+sfx*0.8
def wr(path,x,g=1.0):
    pcm=(np.clip(x*g,-1,1)*32767).astype('<i2')
    with wave.open(path,'wb') as wf:wf.setnchannels(2);wf.setsampwidth(2);wf.setframerate(SR);wf.writeframes(pcm.tobytes())
wr('/tmp/pm.wav',mix)
o=subprocess.run(['ffmpeg','-hide_banner','-i','/tmp/pm.wav','-af','loudnorm=I=-14.5:TP=-1.5:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True).stderr
j=json.loads(o[o.rindex('{'):o.rindex('}')+1]);lufs=float(j['input_i']);gn=10**((-14.5-lufs)/20)
print('in lufs',lufs,'gain',gn,'peak',np.abs(mix).max()*gn)
final=np.tanh(mix*gn*0.9)/0.9
wr('film/audio.wav',final)
wr('stems/narration.wav',nar,gn);wr('stems/music.wav',music,gn);wr('stems/sfx.wav',sfx*0.8,gn);wr('stems/footage_audio.wav',fa*0.85,gn)
sp=speech
print('duck: voice rms',round(vr,1),'music during speech',round(rms_db((music*gn)[sp]/gn),1),'delta',round(vr-rms_db(music[sp]),1))
