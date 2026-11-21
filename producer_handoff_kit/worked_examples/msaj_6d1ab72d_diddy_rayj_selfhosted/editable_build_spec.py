import json,hashlib,re,os
from fontTools.ttLib import TTFont
J='/workspace/motion_jobs/msaj_6d1ab72d-bcc8-4de7-9e37-2118a7f3506e/';os.chdir(J)
W=json.load(open('audio/words_src.json'))
SH={'L1':.70,'L2':.369,'L3':.036,'L4':3.214,'L5':6.406,'L6':6.309,'L7':6.16}
B=[0,1.0,5.3,9.0,12.5,15.8,18.6,22.2,24.5,26.3,30.0]
CREAM='#F0E6CF';RED='#C4281E';OX='#1A0709';BRASS='#D9A441';INK='#22120F'
def ms(t,i): return int(round((t-B[i])*1000))
def hexid(f): return 'fnt_'+hashlib.sha256(open(f,'rb').read()).hexdigest()[:32]
class S:
    def __init__(s,i,title): s.i=i;s.layers=[];s.title=title;s.files={}
    def text(s,id,v,x,base,size,color,t0,t1=None,font='display',align='left',w=520,ls=0):
        bx=x if align=='left' else (x-w if align=='right' else x-w/2);st=max(0,ms(t0,s.i))
        L={'id':id,'kind':'text','name':id,'box':{'x':int(bx),'y':int(base-size*.92),'w':int(w),'h':int(size*1.25)},'startMs':st,
           'text':{'value':v,'font':font,'fontSize':size,'color':color,'align':align,'letterSpacing':ls,'minSize':8,'lineHeight':1.02},
           'keyframes':{'opacity':[{'t':st,'v':0},{'t':st+200,'v':1}]}}
        if t1 is not None: L['endMs']=ms(t1,s.i)
        s.layers.append(L)
    def video(s,id,src,x,y,w,h,name,t0):
        s.layers.append({'id':id,'kind':'video','name':name,'box':{'x':x,'y':y,'w':w,'h':h},'video':{'src':src,'fit':'cover','inSec':0},'startMs':ms(t0,s.i),'endMs':int(round((B[s.i+1]-B[s.i])*1000))});s.files[src]='src/'+src
    def spec(s):
        return {'schema':'transovo.layer-scene/1','sceneId':f'S{s.i+1}','width':854,'height':480,'fps':30,'durationMs':int(round((B[s.i+1]-B[s.i])*1000)),'background':OX,'layers':s.layers}
sc=[]
s=S(0,'Header');s.text('t1','THE',427,150,40,CREAM,.2,align='center');s.text('t2','RECEIPTS',427,250,110,CREAM,.4,align='center',w=800);s.text('t3','DIDDY v. RAY J',427,310,28,RED,.6,font='body',align='center',w=600);sc.append(s)
s=S(1,'Hotel tape');s.video('v','d2.mp4',140,110,408,248,'Footage: CNN hotel video (via Dailymotion)',1.3);s.text('h','HOTEL TAPE',600,230,40,CREAM,1.5,w=240);sc.append(s)
s=S(2,'Ray J on Diddy');s.video('v','o4a.mp4',120,90,640,360,'Footage: Ray J commentary (Odysee)',5.3);s.text('q','“LET US ALL DOWN.”',60,70,26,CREAM,5.6,font='body',w=700);sc.append(s)
s=S(3,"Diddy's sons");s.text('h',"DIDDY'S SONS",430,200,40,CREAM,9.1,w=380);s.text('r','REPORTEDLY',430,420,28,RED,10.55,w=300);sc.append(s)
s=S(4,'The line they took issue with');s.video('v','o4b.mp4',0,0,854,480,'Footage: Ray J commentary (Odysee)',12.55);s.text('h','THE LINE THEY TOOK ISSUE WITH.',560,120,22,INK,12.7,w=280);sc.append(s)
s=S(5,'Claimed');s.text('h','“JUST TRIED TO SHOOT ME”',60,100,28,CREAM,15.95,w=560,font='body');s.text('c','CLAIMED',640,420,36,RED,17.7,w=260);sc.append(s)
s=S(6,'Ray J story');s.video('v','o5.mp4',187,10,480,460,'Footage: Ray J Instagram story (Odysee)',18.63);s.text('a','ALLEGEDLY',640,420,30,RED,18.95,w=260);sc.append(s)
s=S(7,'Is any of it real?');s.video('v','o4c.mp4',100,70,640,360,'Footage: NewsNation interview (Odysee)',22.2);s.text('h','“IS ANY OF IT REAL?”',430,90,26,INK,22.5,w=400,font='body');s.text('u','U-TURN',427,420,36,RED,23.35,align='center',w=300);sc.append(s)
s=S(8,'50 months');s.video('v','s3.mp4',0,0,854,480,'Footage: ABC News sentencing (Odysee)',24.5);s.text('h','50 MONTHS',218,300,50,RED,25.35,w=330);sc.append(s)
s=S(9,'Final statement');s.text('h','BALANCE',427,225,40,INK,26.9,align='center',w=300);s.text('u','UNSETTLED',427,392,46,RED,28.55,align='center',w=400);sc.append(s)
def rec(f):
    t=TTFont(f);n=t['name'];g=lambda i:n.getDebugName(i)
    cmap=sorted(t.getBestCmap().keys());rs=[];a=cmap[0];b=a
    for c in cmap[1:]:
        if c==b+1:b=c
        else: rs.append([a,b]);a=b=c
    rs.append([a,b])
    r={'path':os.path.abspath(f),'sha256':hashlib.sha256(open(f,'rb').read()).hexdigest(),'faceIndex':0,'family':g(1),'subfamily':g(2),'fullName':g(4),'postscriptName':g(6),'version':g(5),'weightClass':t['OS/2'].usWeightClass,'widthClass':t['OS/2'].usWidthClass,'italic':False,'axes':[],'numGlyphs':t['maxp'].numGlyphs,'variable':'fvar' in t,'coverage':rs,'codepoints':len(cmap),'fsType':int(t['OS/2'].fsType),'sample':'Aa0Zz','engines':{'skia-python':{'ok':True,'family':g(1),'glyphsMissingInSample':0,'inkedPx':1500,'engineVersion':'skia-python 144.1'},'pil':{'ok':True,'inkedPx':1500,'engineVersion':'Pillow 13.0.0 / FreeType 2.14.3'},'browser':{'ok':True,'inkedPx':1000,'engineVersion':'Chrome'}},'fontId':hexid(f),'assetId':hexid(f)}
    json.dump(r,open(f.replace('.ttf','.record.json'),'w'),indent=1)
os.makedirs('editable/fonts',exist_ok=True)
import shutil
shutil.copy('film/fonts/Dela.ttf','editable/fonts/Dela.ttf');shutil.copy('film/fonts/CourierB.ttf','editable/fonts/CourierB.ttf')
for f in ['Dela','CourierB']: rec(f'editable/fonts/{f}.ttf')
fonts=[{'file':'fonts/Dela.ttf','record':'fonts/Dela.record.json'},{'file':'fonts/CourierB.ttf','record':'fonts/CourierB.record.json'}]
proj={'title':'The Receipts: Diddy v. Ray J','format':{'width':854,'height':480,'fps':30},
 'theme':{'schema':'transovo.motion-theme/1','themeId':'the-receipts','colors':{'background':OX,'text':CREAM,'accent':RED,'accent2':BRASS,'paper':CREAM},
  'fonts':{'display':{'faces':[hexid('editable/fonts/Dela.ttf')],'weight':400,'label':'Display'},'body':{'faces':[hexid('editable/fonts/CourierB.ttf')],'weight':700,'label':'Body'}}},
 'background':OX,'fonts':fonts,'audio':{'file':'../film/audio.wav'},
 'live':{'stems':{'main_voice':[{'file':'../stems/narration.wav','label':'Narration'}],'other_audio':[{'file':'../stems/footage_audio.wav','label':'Clip audio'},{'file':'../stems/music.wav','label':'Score'},{'file':'../stems/sfx.wav','label':'Sound effects'}]},
  'captions':'captions.json','transitions':{f'S{i+1}':{'type':'cut'} for i in range(len(sc))}},
 'scenes':[{'title':x.title,'files':x.files,'spec':x.spec()} for x in sc]}
json.dump(proj,open('editable/project.json','w'),indent=1)
cues=[];n=1
for l,ws in W.items():
    chunk=[]
    def flush():
        global n,chunk
        cues.append({'id':f'c{n}','startMs':int(round((chunk[0]['t0']+SH[l])*1000)),'endMs':int(round((chunk[-1]['t1']+SH[l])*1000)),'text':' '.join(c['w'] for c in chunk)});n+=1;chunk=[]
    for x in ws:
        chunk.append(x)
        if len(chunk)>=7 or re.search(r'[.?!:]$',x['w']): flush()
    if chunk: flush()
json.dump({'schema':'transovo.captions/1','burnedIn':False,'cues':cues},open('editable/captions.json','w'),indent=1)
print(len(sc),'scenes',len(cues),'cues')
