"""Files the 63 Motion Studio drafts (issues.json). DO NOT RUN without John's explicit approval.
Usage: GH_TOKEN must already be in env (never printed). python3 file_issues.py --i-have-approval"""
import json,re,subprocess,sys,time
if '--i-have-approval' not in sys.argv: sys.exit('Refusing: needs explicit approval flag')
REPO='703deuce/sms'; DIR='/workspace/transovo_team/drafts/filing/'
issues=json.load(open(DIR+'issues.json'))
def gh(*a,inp=None):
    r=subprocess.run(['gh',*a],input=inp,capture_output=True,text=True); return r.returncode,r.stdout,r.stderr
def find(title):
    rc,o,_=gh('issue','list','-R',REPO,'--state','all','--search',f'"{title}" in:title','--json','number,title,url','--limit','20')
    for x in json.loads(o or '[]'):
        if x['title']==title: return x
# additive label only
rc,o,_=gh('api',f'repos/{REPO}/labels/blocked:john-decision')
if rc!=0: gh('label','create','blocked:john-decision','-R',REPO,'--color','B60205','--description','Waiting on a decision from John (D-number in body)')
res={}
try: res=json.load(open(DIR+'filed.json'))
except Exception: pass
for i in issues:
    if i['draft'] in res: continue
    ex=find(i['title'])
    if ex: res[i['draft']]={**ex,'skipped':'already existed'}; continue
    args=['issue','create','-R',REPO,'--title',i['title'],'--body-file','-']
    for l in i['labels']: args+=['--label',l]
    rc,o,e=gh(*args,inp=i['body'])
    if rc!=0:
        time.sleep(5); ex=find(i['title'])
        if ex: res[i['draft']]={**ex,'note':'create errored but issue exists'}
        else: res[i['draft']]={'error':e.strip()[:300]}
    else:
        url=o.strip().splitlines()[-1]; res[i['draft']]={'number':int(url.rsplit('/',1)[1]),'url':url,'title':i['title']}
    json.dump(res,open(DIR+'filed.json','w'),indent=1); time.sleep(3)
# pass 2: draft ids -> #numbers
num={k:v['number'] for k,v in res.items() if 'number' in v}
pat=re.compile(r'(?<![\w-])((?:RE|BE|FE|DO|QA|VQ|SEC)-\d+)(?![\w-])')
for i in issues:
    if i['draft'] not in num or res[i['draft']].get('skipped'): continue
    body=pat.sub(lambda m: f"#{num[m.group(1)]} ({m.group(1)})" if m.group(1) in num and m.group(1)!=i['draft'] else m.group(1), i['body'])
    if body!=i['body']:
        gh('issue','edit',str(num[i['draft']]),'-R',REPO,'--body-file','-',inp=body); time.sleep(2)
# drafts file annotation
D='/workspace/transovo_team/drafts/transovo-studio-issues.md'; t=open(D).read()
for k,n in num.items():
    t=re.sub(rf'^(### {re.escape(k)}: [^\n]*?)(?: — filed #\d+)?$',rf'\1 — filed #{n}',t,flags=re.M)
open(D,'w').write(t)
print(json.dumps(res,indent=1))
