import re,json
D='/workspace/transovo_team/drafts/transovo-studio-issues.md'
t=open(D).read()
OWNERLBL={'Render engine':'owner:backend','Backend (New)':'owner:backend','Frontend':'owner:frontend','DevOps':'owner:devops','QA':'owner:qa','Video Quality':'owner:video-quality','Security':'owner:security'}
FORCEBLOCK={'BE-22':['D37 (open: ElevenLabs music tier spend, not authorized)','D2 (credit price for the tier, set by John)'],'QA-3':['D17 (open action: benchmark footage + reviewer from John)']}
DEVOPS_READY={'DO-1':'required for the build to deploy: render pool + sandbox runtime that Motion Studio render jobs run on'}
AFTER_BUILD=('QA','Video Quality','Security')
BLOCK={}
A12='approved per the PM recommendation (John via CoS relay, 15 Nov 2026, 12:16 AM ET: "Most of that is right")'
D3S='D3: superseded by John (15 Nov 2026, 12:53 AM ET, via the CoS): the product is Motion Studio at `/app/motion-studio`, API `/api/motion-studio/*`'
RESOLVED={'BE-3':['D5: resolved by John (12:42 AM ET, via the CoS): Gemini grounded search'],'BE-15':['D26: dropped by John (12:42 AM ET, via the CoS)'],'RE-10':['D27: resolved by John (12:44 AM ET, via the CoS)'],'BE-8':['D28: resolved by John (12:44 AM ET, via the CoS): ElevenLabs only','D6: ElevenLabs narration spend approved by John (12:57 AM ET)'],'BE-20':['D35: Luna is the default for both parts; the bake-off is cancelled (John, 12:58 AM ET)'],'BE-2':[D3S],'BE-5':[f'D7, D8, D9, D11: {A12}'],'BE-11':[f'D1: {A12}'],'FE-1':[D3S],'FE-2':[f'D13: {A12}'],'FE-10':[f'D1: {A12}'],'FE-12':[D3S],'SEC-1':['D23: approved in principle; this issue is the required review']}
SECBODY={
'SEC-1':('Purpose: independent security review of the sandbox that runs AI-written animation code for documentary motion graphics, before that capability is used in production.','Review the sandbox design and implementation against the requirements in the build spec, record sign-off, and track any required changes as follow-up issues.','Motion Studio build spec (`transovo-studio-build.md`) §2.7 (ST-SBX-001…007)'),
'SEC-2':('Purpose: licence review for the assets Transovo itself ships with the documentary engine (bundled fonts and voices).','Confirm what each shipped asset permits and record a sign-off per asset. User uploads are covered by the standard Terms of Service and are out of scope. Found-media licensing is a later issue.','Build spec §2.7 (ST-ENG-002), §2.10 (ST-AUD-004)'),
'SEC-5':('Purpose: licensing and terms review for automatically found media and the tools used to obtain it (later feature).','Confirm what each provider and tool permits, and record a sign-off. Automatic import stays off until it is signed off.','Build spec §2.4 (ST-MR-004…007, ST-MR-014); decision D4'),
'SEC-3':('Purpose: privacy review of face detection/grouping in Motion Studio (consent, notice, retention, deletion, regional rules such as BIPA/GDPR). Flagged by John as a parallel review — it does not block the first release.','Review the feature and its interim defaults, record findings, and file follow-ups for any required changes.','Build spec §2.6 (ST-FACE-004…006); decision D22'),
'SEC-4':('Purpose: authorization and data-hygiene review for the new Motion Studio routes, jobs and logs.','Review access control on the new documentary routes and confirm sensitive data is kept out of responses and logs; record sign-off.','Build spec §2.12 (ST-RULE-005, ST-API-001)'),
}
WORKFLOW="\n### Build workflow (John, 15 Nov 2026, 12:53 AM + 12:54 AM ET; reconciled with TEAM.md)\n- Build fast, push early. Use build/deploy plus worker logs as the test loop; don't spend 20–40 minutes self-testing locally.\n- During the build phase, testing is from the **live front end plus build/deploy and worker logs**. There are **no QA / Video Quality / Security handoffs in this phase**.\n- Still binding (TEAM.md): branch → PR → CI → normal merge; **no force-push**; additive migrations only; don't break working modes (upload clipping, stream clipping, the editor, Story, multi-source Story, Clean Take, live B0.5 motion graphics); never deploy or modify the SMS worker or Coolify app3; never show `$` in the UI; no automatic paid retries; no secrets, tokens or signed URLs in logs or responses.\n- Report **code written / tests passed / deployed / verified** separately.\n"
issues=[]
for m in re.finditer(r'^### ((RE|BE|FE|DO|QA|VQ|SEC)-\d+): (.+?)\n(.*?)(?=^### |^## |^---|\Z)',t,re.S|re.M):
    did,_,title,body=m.group(1),m.group(2),m.group(3).strip(),m.group(4).strip()
    f=lambda k: (re.search(r'^- \*\*'+k+r':\*\* (.+)$',body,re.M) or [None,''])[1].strip()
    owner=f('Owner'); phase=f('Phase')
    okey=next(k for k in OWNERLBL if owner.startswith(k) or (k=='Security' and owner.startswith('Security')))
    ph='L' if phase.lstrip('*').startswith('Later') else re.search(r'P(\d)',phase).group(1)
    labels=['type:task',OWNERLBL[okey],'P3' if ph=='L' else f'P{ph}']  # P-label = earliest build phase (see report)
    blk=FORCEBLOCK.get(did,[])
    if blk: status='blocked:john-decision'
    elif ph=='L': status='status:backlog'
    elif okey in AFTER_BUILD: status='status:backlog'
    elif okey=='DevOps': status='status:ready' if did in DEVOPS_READY else 'status:backlog'
    else: status='status:ready'
    labels.append(status)
    head=f"[Agent: Product Manager]\n\n**Motion Studio (v1: documentaries) — draft {did}.** Spec: Motion Studio build spec (`transovo-studio-build.md`, PM, 15 Nov 2026) + draft list `transovo-studio-issues.md`. Repo baseline `05ac1600`. Prepared by the PM.\n"
    if status=='status:backlog' and ph!='L' and okey in AFTER_BUILD: head+="\n**Status: backlog, after the build** (John, 15 Nov 2026, 12:54 AM ET: only Backend and Frontend build in this phase, with no QA/VQ/Security handoffs during the build).\n"
    if status=='status:backlog' and okey=='DevOps': head+="\n**Status: backlog.** Not required for the build to deploy; the build uses the existing storage paths until then (John, 12:54 AM ET).\n"
    if did in DEVOPS_READY: head+=f"\n**Status: ready.** {DEVOPS_READY[did][0].upper()+DEVOPS_READY[did][1:]}.\n"
    if ph=='L': head+="\n**Phase: later** (John, 15 Nov 2026, 12:33 AM ET: v1 media = user uploads only). Fully specced; not in the v1 build. Labelled `status:backlog`.\n"
    if blk: head+=f"\n**Blocked on: {'; '.join(blk)}** (see build spec §0.1). Work that doesn't depend on these may be prepared; do not ship the dependent behavior until resolved.\n"
    if did in RESOLVED: head+=f"\n**Decision(s) resolved:** {'; '.join(RESOLVED[did])}. See build spec §0.1.\n"
    if did.startswith('SEC'):
        p,sc,ref=SECBODY[did]
        b=head+f"\n### Owner (one accountable)\nsecurity\n\n### Purpose\n{p.removeprefix("Purpose: ")}\n\n### Scope (summary)\n{sc}\n\n### Spec reference\n{ref}\n\n### Phase\n{phase}\n\n### Acceptance criteria\nReview completed and sign-off recorded; required changes filed as follow-up issues.\n\n_Details are kept in internal docs; this public issue is intentionally high-level._\n"+WORKFLOW
    else:
        b=head+f"\n### Owner (one accountable)\n{owner}\n\n### Phase\n{phase}\n\n"+body+"\n"+WORKFLOW
    otag={'Render engine':'Render engine','Backend (New)':'Backend','Frontend':'Frontend','DevOps':'DevOps','QA':'QA','Video Quality':'Video Quality','Security':'Security'}[okey]
    issues.append({'draft':did,'title':f"[Motion Studio {did}] {title} ({otag})",'phase':('Later' if ph=='L' else f'P{ph}'),'owner':otag,'labels':labels,'blocked':blk,'body':b})
assert len(issues)==62,len(issues)
assert not any(i['draft']=='BE-21' or re.search(r'(?<![\w-])BE-21(?![\w-])',i['body']) for i in issues)
# safety scan
bad=re.compile(r'(ghp_|github_pat_|sk-|AKIA|X-Amz-Signature|token=|/home/box|/workspace|secrets\.env)',re.I)
for i in issues: assert not bad.search(i['body']), i['draft']
assert not any(l.startswith('needs:') for i in issues for l in i['labels'])
assert all(any(l.startswith('owner:') for l in i['labels']) for i in issues)
assert all(sum(l in('status:ready','status:backlog','blocked:john-decision') for l in i['labels'])==1 for i in issues)
assert all('Build workflow' in i['body'] for i in issues)
assert not any(re.search(r'Transovo Studio|/api/documentary|(?<!supersedes D3 `)/app/documentary',i['body']+i['title']) for i in issues)
json.dump(issues,open('/workspace/transovo_team/drafts/filing/issues.json','w'),indent=1)
from collections import Counter
print(Counter(i['phase'] for i in issues)); print(Counter(i['owner'] for i in issues))
for i in issues: print(i['phase'],i['draft'],i['labels'])
