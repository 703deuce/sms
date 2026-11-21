import subprocess,os,json,glob
J='/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e'
SRC=J+'/assets/footage/'
GR='eq=contrast=1.08:saturation=0.82:brightness=-0.03,colorbalance=rs=.10:gs=-.02:bs=-.06:rm=.06:bm=-.05:rh=.03'
# id, file, start, len, crop, out w,h, film t0, cols, rows
CL=[('d2','d2',10.0,4.5,'crop=408:248:0:236',408,248,1.3,4,4),
 ('o4a','o4',19.0,4.0,'crop=1422:800:100:20',640,360,5.3,4,3),
 ('o4b','o4',33.0,3.6,'crop=1422:800:100:20',854,480,12.55,3,3),
 ('o5','o5',6.45,3.9,'crop=480:460:0:90',480,460,18.63,4,3),
 ('o4c','o4',27.3,2.9,'crop=1422:800:100:20',640,360,22.2,4,3),
 ('s3','s3',85.5,2.3,'null',854,480,24.5,3,3)]
meta={}
for f in glob.glob(J+'/film/fx/*'): os.remove(f)
for cid,fn,ss,ln,crop,cw,ch,t0,cols,rows in CL:
    n=int(round(ln*30))
    d='/tmp/fr_'+cid;os.makedirs(d,exist_ok=True)
    for x in glob.glob(d+'/*'):os.remove(x)
    vf=f'{crop},scale={cw}:{ch}:flags=lanczos,fps=30,{GR}'
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(ss),'-t',str(ln+0.1),'-i',SRC+fn+'.mp4','-vf',vf,'-frames:v',str(n),'-q:v','3',d+'/f%04d.jpg'],check=True)
    n=len(glob.glob(d+'/f*.jpg'))
    per=cols*rows;na=(n+per-1)//per
    for k in range(na):
        subprocess.run(['ffmpeg','-v','error','-y','-start_number',str(k*per+1),'-i',d+'/f%04d.jpg','-frames:v','1','-vf',f'tile={cols}x{rows}:padding=0:margin=0','-q:v','4',f'{J}/film/fx/{cid}_{k+1:03d}.jpg'],check=True)
    meta[cid]=[na,cols,rows,cw,ch,n,t0]
    print(cid,n,na)
    # editable source (mp4 w/o audio)
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(ss),'-t',str(ln),'-i',SRC+fn+'.mp4','-an','-vf',f'{crop},scale={cw}:{ch}:flags=lanczos,fps=30,{GR}','-c:v','libx264','-crf','20','-pix_fmt','yuv420p',f'{J}/editable/src/{cid}.mp4'],check=True)
json.dump(meta,open(J+'/film/clips.json','w'))
open(J+'/film/clips.js','w').write('window.CLIPS='+json.dumps(meta)+';')
