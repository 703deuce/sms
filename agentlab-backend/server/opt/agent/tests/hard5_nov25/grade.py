#!/usr/bin/env python3
"""Grade hard5 jobs. Usage: grade.py [id ...]. Reads batch.json; writes grades.json. PASS / PARTIAL / FAIL with evidence."""
import os, sys, json, re, csv, shutil, subprocess, tempfile, sqlite3, glob, statistics
W="/opt/agent/workspace"; H="/opt/agent/tests/hard5_nov25"
def host(p): return p.replace("/workspace/",W+"/",1) if p and p.startswith("/workspace/") else p
def cont(p): return p.replace(W+"/","/workspace/",1)
def sh(cmd,timeout=120,cwd=None,inp=None):
    p=subprocess.run(cmd,shell=isinstance(cmd,str),capture_output=True,text=True,timeout=timeout,cwd=cwd,input=inp); return p.returncode,p.stdout+p.stderr
def dpy(script,*args,timeout=180):
    return sh(["docker","exec","-i","agent-lab","python3","-","--"]+list(args),inp=script,timeout=timeout)
def find(root,name):
    c=[os.path.join(root,"out",name)]+sorted(glob.glob(os.path.join(root,"helpers","*","out",name)))+sorted(glob.glob(os.path.join(root,"**",name),recursive=True))
    for p in c:
        if os.path.exists(p): return p
def verdict(score,total,hard_fail=False):
    if hard_fail or score==0: return "FAIL"
    return "PASS" if score==total else ("PARTIAL" if score/total>=0.4 else "FAIL")
def close(a,b,tol=0.011):
    try: return abs(float(a)-float(b))<=tol
    except Exception: return False

def g_h1(root):
    ev=[]; pts=0; tot=6
    repo=find(root,"more_itertools_repo")
    if not repo or not os.path.isdir(os.path.join(repo,"more_itertools")):
        cands=[os.path.dirname(os.path.dirname(p)) for p in glob.glob(root+"/**/more_itertools/recipes.py",recursive=True)]
        repo=cands[0] if cands else None
    if not repo: return "FAIL",["no repo copy"]
    ev.append("repo="+repo.replace(root,"<job>"))
    tmp=os.path.join(W,"tmp_grade_h1"); shutil.rmtree(tmp,ignore_errors=True)
    shutil.copytree(repo,tmp,ignore=shutil.ignore_patterns("__pycache__",".git")); sh(f"chown -R agentlab:agentlab {tmp}; chmod -R u+rwX {tmp}")
    # their suite as-is
    rc,o=sh(f"docker exec -w {cont(tmp)} agent-lab python3 -m unittest discover -s tests -t . 2>&1 | tail -3")
    their_ok=o.strip().endswith("OK") or "OK (skipped" in o
    ev.append("their suite (incl. their new test): "+o.strip().replace("\n"," | ")[-160:])
    # pristine tests over their library
    shutil.rmtree(tmp+"/tests"); shutil.copytree(H+"/mi_pristine/tests",tmp+"/tests",ignore=shutil.ignore_patterns("__pycache__")); sh(f"chown -R agentlab:agentlab {tmp}")
    rc,o=sh(f"docker exec -w {cont(tmp)} agent-lab python3 -m unittest discover -s tests -t . 2>&1")
    fails=re.findall(r"^(FAIL|ERROR): (.*)$",o,re.M); last=[l for l in o.strip().splitlines()[-3:]]
    suite_ok = o.strip().endswith("OK") or re.search(r"\nOK( \(skipped=\d+\))?\s*$",o) is not None
    ev.append(f"pristine tests on their lib: {' | '.join(last)}; fails={[f[1] for f in fails][:8]}")
    if suite_ok: pts+=2
    # hidden reported-issue check
    rc,o=sh(f"docker exec -w {cont(tmp)} agent-lab python3 -c \"import more_itertools as m\nfrom itertools import combinations\nok=all(m.nth_combination(range(n),r,i)==list(combinations(range(n),r))[i] for n in range(1,8) for r in range(0,n+1) for i in range(-len(list(combinations(range(n),r))),0))\ntry:\n  m.nth_combination(range(5),3,-11); ok=False\nexcept IndexError: pass\nprint('NEG_OK' if ok else 'NEG_BAD', m.nth_combination(range(5),3,-1), m.nth_combination(range(5),3,-10))\"")
    ev.append("negative-index check: "+o.strip()[-120:]); 
    if "NEG_OK" in o: pts+=1
    if their_ok: pts+=1
    reg=os.path.join(repo,"tests","test_regressions.py")
    regok=os.path.isfile(reg) and "nth_combination" in open(reg).read()
    ev.append(f"tests/test_regressions.py with nth_combination: {regok}")
    if regok: pts+=1
    # tests untouched + minimal library diff
    rc,o=sh(f"diff -r -x __pycache__ -x test_regressions.py {H}/mi_pristine/tests {repo}/tests | head -20")
    tests_same = o.strip()==""
    rc,d=sh(f"diff -r -x __pycache__ {H}/mi_pristine/more_itertools {repo}/more_itertools")
    changed=len([l for l in d.splitlines() if l.startswith(("<",">"))])
    ev.append(f"existing tests untouched={tests_same}; library diff lines={changed}")
    if tests_same and changed<=40: pts+=1
    shutil.rmtree(tmp,ignore_errors=True)
    return verdict(pts,tot,hard_fail=not tests_same),ev+[f"score {pts}/{tot}"]

H2_TRUTH={"New York":(8175133,8804190,300.5),"Los Angeles":(3792621,3898747,469.5),"Chicago":(2695598,2746388,227.7),"Houston":(2099451,2304580,640.4),"Phoenix":(1445632,1608139,518.0)}
def g_h2(root):
    ev=[]; pts=0; tot=6
    x=find(root,"cities_model.xlsx"); md=find(root,"cities_report.md"); ht=find(root,"dashboard.html")
    ev.append(f"files xlsx={bool(x)} md={bool(md)} html={bool(ht)}")
    if x:
        script=r'''
import sys,json
from openpyxl import load_workbook
p=sys.argv[-1]; wb=load_workbook(p); wv=load_workbook(p,data_only=True)
r={"sheets":wb.sheetnames}
ws=wb["Data"] if "Data" in wb.sheetnames else wb.worksheets[0]
r["header"]=[c.value for c in ws[1]]
rows=[]
for row in ws.iter_rows(min_row=2):
    vals=[c.value for c in row]
    if vals and vals[0]: rows.append([str(v) if v is not None else None for v in vals])
r["rows"]=rows
if "Summary" in wb.sheetnames:
    r["summary"]=[[str(c.value) for c in row if c.value is not None] for row in wb["Summary"].iter_rows()]
    r["summary_vals"]=[[str(c.value) for c in row if c.value is not None] for row in wv["Summary"].iter_rows()]
print(json.dumps(r))
'''
        rc,o=dpy(script,cont(x))
        try: r=json.loads(o.strip().splitlines()[-1])
        except Exception: r={}; ev.append("xlsx parse err "+o[-200:])
        rows=r.get("rows",[]); hdr=[str(h).strip().lower() if h else "" for h in r.get("header",[])]
        ev.append(f"sheets={r.get('sheets')} header={r.get('header')}")
        good=0; formulas=0; srcs=0
        for row in rows:
            name=row[0]; key=next((k for k in H2_TRUTH if k.split()[0].lower() in name.lower() or (k=="New York" and "nyc" in name.lower())),None)
            if not key: continue
            t=H2_TRUTH[key]
            try:
                p10=float(row[1]); p20=float(row[2]); la=float(row[3])
                ok=abs(p10-t[0])/t[0]<0.005 and abs(p20-t[1])/t[1]<0.005 and abs(la-t[2])/t[2]<0.03
            except Exception: ok=False
            if ok: good+=1
            else: ev.append(f"  {key} row mismatch {row[1:4]} vs {t}")
            if len(row)>5 and str(row[4]).startswith("=") and str(row[5]).startswith("="): formulas+=1
            if len(row)>6 and row[6] and "census.gov" in str(row[6]): srcs+=1
        ev.append(f"rows matching census truth={good}/5; rows with Growth+Density formulas={formulas}/5; rows with census.gov source={srcs}/5")
        if good==5: pts+=2
        elif good>=3: pts+=1
        if formulas==5: pts+=1
        summ=json.dumps(r.get("summary",[])); sv=json.dumps(r.get("summary_vals",[]))
        sum_ok = "=" in summ and ("SUM" in summ.upper()) and ("MAX" in summ.upper() or "INDEX" in summ.upper())
        ev.append(f"Summary formulas ok={sum_ok} summary={summ[:200]}")
        if sum_ok: pts+=1
    if md:
        t=open(md,errors="replace").read(); low=t.lower()
        us=re.findall(r"https?://[^\s)\]>\"']+",t)
        census=[u for u in us if "census.gov" in u]
        live=0
        for u in census[:6]:
            rc,o=sh(f"curl -s -o /dev/null -w '%{{http_code}}' -L -m 15 -A 'Mozilla/5.0' '{u.rstrip('.,;')}'"); 
            if o.strip()[:1] in "23": live+=1
        fastest = re.search(r"phoenix[^.\n]{0,120}(fastest|highest growth|grew (the )?most)|(fastest|highest growth|grew (the )?most)[^.\n]{0,120}phoenix",low) is not None
        densest = re.search(r"new york[^.\n]{0,120}dens|dens[^.\n]{0,120}new york",low) is not None
        words=len(t.split())
        ev.append(f"report words={words} census urls={len(census)} live={live} fastest=Phoenix:{fastest} densest=NYC:{densest}")
        if census and live>=1 and fastest and densest: pts+=1
    if ht:
        t=open(ht,errors="replace").read()
        nums=sum(1 for v in H2_TRUTH.values() if str(v[1]) in t.replace(",","") )
        chart=("<svg" in t.lower() or "<canvas" in t.lower())
        ext=re.findall(r"<script[^>]+src=[\"'](https?:[^\"']+)",t,re.I)
        ev.append(f"dashboard pop2020 numbers present={nums}/5 chart={chart} external_scripts={ext[:3]}")
        if nums==5 and chart and not ext: pts+=1
    return verdict(pts,tot),ev+[f"score {pts}/{tot}"]

def g_h3(root):
    ev=[]; T=json.load(open(H+"/sales_truth.json"))
    p=find(root,"answers.json")
    if not p: return "FAIL",["no answers.json"]
    try: a=json.load(open(p))
    except Exception as e: return "FAIL",[f"bad json {e}"]
    res={}
    def chk(k,ok): res[k]=ok
    for k in ("unique_customers_total","valid_orders","test_orders_excluded","duplicate_order_lines_removed","buying_customers","repeat_customers"):
        chk(k,str(a.get(k))==str(T[k]))
    chk("cents_error_orders",sorted(a.get("cents_error_orders") or [])==T["cents_error_orders"])
    for k in ("net_revenue_usd","median_order_net_usd","top_customer_net_usd","best_mom_growth_pct","repeat_rate_pct"):
        chk(k,close(a.get(k),T[k],0.02))
    for k in ("top_region","best_mom_growth_month","top_customer_id"): chk(k,str(a.get(k)).strip()==T[k])
    for k in ("revenue_by_region_usd","revenue_by_month_usd"):
        got=a.get(k) or {}
        chk(k,isinstance(got,dict) and all(close(got.get(kk),vv,0.02) for kk,vv in T[k].items()))
    bad={k:(a.get(k),T[k]) for k,v in res.items() if not v}
    n=sum(res.values()); ev.append(f"answers correct {n}/{len(res)}")
    for k,(g,t) in bad.items(): ev.append(f"  WRONG {k}: got {json.dumps(g)[:120]} want {json.dumps(t)[:120]}")
    # rerun their script
    s=find(root,"analysis.py")
    if s:
        tmp=os.path.join(W,"tmp_grade_h3"); shutil.rmtree(tmp,ignore_errors=True); os.makedirs(tmp+"/out")
        shutil.copy(s,tmp+"/out/analysis.py"); sh(f"chown -R agentlab:agentlab {tmp}; chmod -R u+rwX {tmp}")
        rc,o=sh(f"docker exec -w {cont(tmp)} agent-lab timeout 60 python3 out/analysis.py",timeout=90)
        rp=tmp+"/out/answers.json"
        rerun = rc==0 and os.path.isfile(rp) and json.load(open(rp))==a
        ev.append(f"analysis.py rerun rc={rc} reproduced={rerun}")
        shutil.rmtree(tmp,ignore_errors=True)
    else: rerun=False; ev.append("no analysis.py")
    md=find(root,"analysis.md"); ev.append(f"analysis.md={bool(md)}")
    tot=len(res)
    v="PASS" if n==tot and rerun and md else ("PARTIAL" if n>=tot*0.5 else "FAIL")
    return v,ev

def read_csv(p):
    try: return list(csv.DictReader(open(p,encoding="utf-8")))
    except Exception as e: return None
def g_h4(root):
    ev=[]; pts=0; tot=5; T=json.load(open(H+"/vendor_truth.json"))
    for tag,cs,sj in (("drop1","stock.csv","summary.json"),("drop2","stock2.csv","summary2.json")):
        t=T[tag]; c=find(root,cs); s=find(root,sj)
        if s:
            try: sm=json.load(open(s))
            except Exception: sm={}
            keys=("records_in_file","deleted","active_kept","total_qty")
            sok=all(str(sm.get(k))==str(t[k]) for k in keys) and close(sm.get("inventory_value"),t["inventory_value"],0.02)
            ev.append(f"{tag} summary ok={sok} got={ {k:sm.get(k) for k in keys+('inventory_value',)} } want={ {k:t[k] for k in keys+('inventory_value',)} }")
            if sok: pts+=1
        else: ev.append(f"{tag} no {sj}")
        rows=read_csv(c) if c else None
        if rows is not None:
            skus=sorted((r.get("sku") or "").strip() for r in rows)
            desc_ok=all(any((r.get("sku") or "").strip()==k and (r.get("description") or "").strip()==v for r in rows) for k,v in t["sample"].items())
            cok= skus==t["skus"] and desc_ok and list(rows[0].keys())[:5]==["sku","description","qty","price","updated"] and re.match(r"\d{4}-\d{2}-\d{2}$",rows[0].get("updated","") or "")
            ev.append(f"{tag} csv rows={len(rows)} skus_match={skus==t['skus']} utf8_descriptions_ok={desc_ok} header={list(rows[0].keys()) if rows else None}")
            if cok: pts+=1
        else: ev.append(f"{tag} no/unreadable {cs}")
    sk=None
    for base in (W+"/skills", W+"/bots"):
        hits=glob.glob(base+"/**/vendor-legacy-drop/SKILL.md",recursive=True)
        if hits: sk=hits[0]; break
    if sk:
        t=open(sk).read(); lines=t.count("\n")
        wtu=re.search(r"when_to_use:\s*(.+)",t)
        d=os.path.dirname(sk); extra=[f for f in os.listdir(d) if not f.startswith(".") and f!="SKILL.md"]
        script = bool(re.search(r"```(bash|sh|python)",t)) or bool(extra) or ".py" in t
        ev.append(f"skill {sk} lines={lines} when_to_use={'yes' if wtu else 'no'} script_or_ref={script} extra_files={extra}")
        if wtu and lines<=500 and script: pts+=1
        ev.append("skill head: "+t[:300].replace("\n"," / "))
    else: ev.append("no vendor-legacy-drop skill saved")
    return verdict(pts,tot),ev+[f"score {pts}/{tot}"]

def norm_repo(u): 
    u=(u or "").lower().strip().replace("git+","").replace("git://","https://").replace(".git","").rstrip("/")
    return re.sub(r"^https?://(www\.)?","",u)
def norm_lic(l): return re.sub(r"[^a-z0-9]","",(l or "").lower().replace("license","").replace("software",""))
def g_h5(root):
    ev=[]; pts=0; tot=4
    T=json.loads(sh(f"python3 {H}/h5truth.py")[1])
    p=find(root,"packages.csv"); rows=read_csv(p) if p else None
    if not rows: return "FAIL",["no packages.csv"]
    hdr=list(rows[0].keys()); want=["ecosystem","package","latest_version","license","repository","latest_release_date","page_url"]
    ev.append(f"header ok={hdr==want} rows={len(rows)}")
    fieldok=0; fields=0; detail=[]
    for name,t in T.items():
        r=next((x for x in rows if (x.get("package") or "").strip().lower()==name),None)
        if not r: detail.append(f"{name}: missing"); fields+=4; continue
        chk={"version":(r.get("latest_version") or "").strip().lstrip("v")==t["version"],
             "license":norm_lic(r.get("license"))==norm_lic(t["license"]) or norm_lic(r.get("license")) in [norm_lic(x) for x in [t.get("license_expression")] + [c.split("::")[-1] for c in t.get("classifiers",[])] if x] or (name=="requests" and "apache" in (r.get("license") or "").lower()),
             "repository":norm_repo(r.get("repository"))==norm_repo(t["repository"]),
             "date":(r.get("latest_release_date") or "").strip()[:10]==t["date"]}
        fields+=4; fieldok+=sum(chk.values())
        bad=[k for k,v in chk.items() if not v]
        if bad: detail.append(f"{name}: wrong {bad} got={[r.get('latest_version'),r.get('license'),r.get('repository'),r.get('latest_release_date')]} want={[t['version'],t['license'],t['repository'],t['date']]}")
    ev.append(f"fields correct {fieldok}/{fields}"); ev+=["  "+d for d in detail]
    if fieldok==fields: pts+=2
    elif fieldok>=fields*0.75: pts+=1
    shots=glob.glob(os.path.join(os.path.dirname(p),"shots","*.png")) or glob.glob(root+"/**/shots/*.png",recursive=True)
    sizes={os.path.basename(s):os.path.getsize(s) for s in shots}
    ok_shots=[k for k,v in sizes.items() if v>15000]
    ev.append(f"screenshots={len(shots)} >15KB={len(ok_shots)} {sizes}")
    if len(ok_shots)>=6: pts+=1
    md=find(root,"compare.md")
    if md:
        t=open(md,errors="replace").read(); links=sum(1 for d in ("crates.io","npmjs.com","pypi.org") if d in t)
        ev.append(f"compare.md registries linked={links}/3")
        if links==3: pts+=1
    else: ev.append("no compare.md")
    return verdict(pts,tot),ev+[f"score {pts}/{tot}"]

G={"h1":g_h1,"h2":g_h2,"h3":g_h3,"h4":g_h4,"h5":g_h5}
R2=H+"/r2"
def g_r1(root):
    ev=[]
    app=find(root,"tracker")
    if app and not os.path.isfile(os.path.join(app,"server.py")):
        hits=glob.glob(root+"/**/tracker/server.py",recursive=True); app=os.path.dirname(hits[0]) if hits else None
    if not app: return "FAIL",["no out/tracker/server.py"]
    ev.append("app="+app.replace(root,"<job>"))
    tmp=os.path.join(W,"tmp_grade_r1"); shutil.rmtree(tmp,ignore_errors=True)
    shutil.copytree(app,tmp,ignore=shutil.ignore_patterns("__pycache__","*.db")); sh(f"chown -R agentlab:agentlab {tmp}; chmod -R u+rwX {tmp}")
    rc,o=sh(["docker","exec","-i","-w",cont(tmp),"agent-lab","python3","-",cont(tmp)],inp=open(R2+"/hidden_tracker_test.py").read(),timeout=240)
    try: r=json.loads(o.strip().splitlines()[-1])
    except Exception: return "FAIL",ev+["hidden suite crashed: "+o[-400:]]
    ev.append(f"hidden API suite {r['passed']}/{r['total']}; failed={r['failed']}")
    rc,o=sh(f"docker exec -w {cont(tmp)} agent-lab timeout 120 python3 -m unittest discover -s tests 2>&1 | tail -3",timeout=150)
    own_ok=("OK" in o.splitlines()[-1]) if o.strip() else False
    ev.append("own tests: "+o.strip().replace("\n"," | ")[-150:])
    shutil.rmtree(tmp,ignore_errors=True)
    frac=r["passed"]/r["total"]
    v="PASS" if frac>=0.95 and own_ok else ("PARTIAL" if frac>=0.6 else "FAIL")
    return v,ev
def g_r2(root):
    ev=[]
    p=find(root,"reconcile_fast.py")
    if not p: return "FAIL",["no reconcile_fast.py"]
    tmp=os.path.join(W,"tmp_grade_r2"); shutil.rmtree(tmp,ignore_errors=True); os.makedirs(tmp)
    shutil.copy(p,tmp+"/rf.py")
    for d in ("hidden_small","hidden_big"): shutil.copytree(R2+"/"+d,tmp+"/"+d)
    sh(f"chown -R agentlab:agentlab {tmp}; chmod -R u+rwX {tmp}")
    res={}
    for d,exp,limit in (("hidden_small",None,30),("hidden_big",R2+"/hidden_big_expected.csv",8.0)):
        script=f"import time,subprocess;t=time.time();r=subprocess.run(['python3','rf.py','{d}/bank.csv','{d}/ledger.csv','{d}_out.csv'],capture_output=True,text=True,timeout=300);print('RC',r.returncode,'SECS',round(time.time()-t,2),r.stderr[-200:])"
        rc,o=sh(["docker","exec","-i","-w",cont(tmp),"agent-lab","python3","-"],inp=script,timeout=320)
        m=re.search(r"RC (\S+) SECS (\S+)",o); secs=float(m.group(2)) if m else 999
        if exp is None:
            # reference = original slow script on small set
            sh(f"docker exec -w {cont(tmp)} agent-lab python3 /workspace/testdata/hard5_nov25/r2/recon/reconcile.py {d}/bank.csv {d}/ledger.csv ref_small.csv",timeout=300)
            exp=tmp+"/ref_small.csv"
        same=os.path.isfile(f"{tmp}/{d}_out.csv") and open(f"{tmp}/{d}_out.csv","rb").read()==open(exp,"rb").read()
        res[d]=(same,secs,limit); ev.append(f"{d}: identical={same} secs={secs} (limit {limit}) {o.strip()[-120:] if not same else ''}")
    fo=find(root,"full_out.csv")
    full_same=bool(fo) and open(fo,"rb").read()==open(R2+"/full_expected.csv","rb").read()
    ev.append(f"out/full_out.csv identical to reference={full_same}")
    shutil.rmtree(tmp,ignore_errors=True)
    exact=res["hidden_small"][0] and res["hidden_big"][0]
    fast=res["hidden_big"][1]<=res["hidden_big"][2]
    v="PASS" if exact and fast and full_same else ("PARTIAL" if exact or full_same else "FAIL")
    return v,ev
def g_r3(root):
    ev=[]; T=json.load(open(R2+"/notes_truth.json"))
    p=find(root,"projects.json")
    if not p: return "FAIL",["no projects.json"]
    a=json.load(open(p)); P=a.get("projects",{})
    fields=0; good=0; wrong=[]
    for name,t in T["projects"].items():
        g=P.get(name) or {}
        for k in ("owner","budget","deadline","status","deadline_slips"):
            fields+=1
            gv=g.get(k); ok=(str(gv).strip().lower()==str(t[k]).lower()) or (k=="budget" and close(gv,t[k],0.5))
            good+=ok
            if not ok: wrong.append(f"{name}.{k}: got {gv} want {t[k]}")
    agg={k:str(a.get(k)).strip()==str(T[k]) for k in ("total_budget_active_usd","n_cancelled","most_deadline_slips","top_owner","top_owner_count","latest_deadline_project")}
    ev.append(f"project fields correct {good}/{fields}; aggregates {sum(agg.values())}/{len(agg)} {[(k,a.get(k),T[k]) for k,v in agg.items() if not v]}")
    ev+=["  "+w for w in wrong[:25]]
    tl=find(root,"projects_timeline.md"); ev.append(f"timeline={bool(tl)}")
    tot=fields+len(agg); n=good+sum(agg.values())
    v="PASS" if n==tot and tl else ("PARTIAL" if n>=tot*0.7 else "FAIL")
    return v,ev+[f"score {n}/{tot}"]
def g_r4(root):
    ev=[]; pts=0; tot=0; T=json.load(open(R2+"/vendor2_truth.json"))
    for n in ("3","4","5"):
        t=T["drop"+n]; s=find(root,f"summary{n}.json"); c=find(root,f"stock{n}.csv")
        tot+=2
        if s:
            try: sm=json.load(open(s))
            except Exception: sm={}
            keys=("records_in_file","deleted","active_kept","total_qty")
            sok=all(str(sm.get(k))==str(t[k]) for k in keys) and close(sm.get("inventory_value"),t["inventory_value"],0.02)
            ev.append(f"drop{n} summary ok={sok} got={ {k:sm.get(k) for k in keys+('inventory_value',)} } want={ {k:t[k] for k in keys+('inventory_value',)} }")
            pts+=sok
        else: ev.append(f"drop{n} no summary")
        rows=read_csv(c) if c else None
        if rows:
            skus=sorted((r.get("sku") or "").strip() for r in rows)
            desc_ok=all(any((r.get("sku") or "").strip()==k and (r.get("description") or "").strip()==v for r in rows) for k,v in t["sample"].items())
            extra=True
            if n=="3":
                nm={(r.get("sku") or "").strip():(r.get("notes") or "").strip() for r in rows}
                extra=all(nm.get(k)==v for k,v in t["notes"].items()) and "notes" in rows[0]
                bad=[k for k,v in t["notes"].items() if nm.get(k)!=v][:3]
                ev.append(f"drop3 notes correct={extra} bad_sample={[(k,(nm.get(k) or '')[:40],t['notes'][k][:40]) for k in bad]}")
            ok=skus==t["skus"] and desc_ok and extra
            ev.append(f"drop{n} csv rows={len(rows)} skus_match={skus==t['skus']} descriptions_ok={desc_ok}")
            pts+=ok
        else: ev.append(f"drop{n} no/empty csv")
    sk=W+"/skills/vendor-legacy-drop/SKILL.md"; tot+=1
    old=open(R2+"/vendor-legacy-drop.SKILL.round1.md").read(); new=open(sk).read() if os.path.exists(sk) else ""
    baks=glob.glob(W+"/skills/vendor-legacy-drop/.SKILL.md.*.bak")
    covers=sum(1 for k in ("dbt","memo","850","record count") if k in new.lower())
    upd= new!=old and new.count("\n")<=500 and covers>=3
    ev.append(f"skill updated={new!=old} lines={new.count(chr(10))} backups={len(baks)} mentions(dbt/memo/850/record count)={covers}")
    pts+=upd
    return verdict(pts,tot),ev+[f"score {pts}/{tot}"]
G.update({"r1":g_r1,"r2":g_r2,"r3":g_r3,"r4":g_r4})

R3=H+"/r3"
def g_x1(root):
    ev=[]
    p=find(root,"cmark.py")
    if not p: return "FAIL",["no cmark.py"]
    src=open(p,errors="replace").read()
    banned=[m for m in ("markdown_it","mistune","commonmark","import markdown","from markdown","marko","cmarkgfm") if m in src]
    others=[f for f in glob.glob(os.path.dirname(p)+"/**/*.py",recursive=True)]
    for f in others:
        t=open(f,errors="replace").read()
        banned+= [f"{os.path.basename(f)}:{m}" for m in ("markdown_it","mistune","import markdown","from markdown") if m in t]
    ev.append(f"cmark.py lines={src.count(chr(10))} banned_imports={banned}")
    tmp=os.path.join(W,"tmp_grade_x1"); shutil.rmtree(tmp,ignore_errors=True); shutil.copytree(os.path.dirname(p),tmp,ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copy(R3+"/spec.json",tmp+"/_spec.json"); sh(f"chown -R agentlab:agentlab {tmp}; chmod -R u+rwX {tmp}")
    script=r"""
import json,sys,os,signal,collections
sys.path.insert(0,os.getcwd())
import cmark
d=json.load(open('_spec.json'))
res=collections.defaultdict(lambda:[0,0]); vis=[0,0]; hid=[0,0]
def handler(s,f): raise TimeoutError()
signal.signal(signal.SIGALRM,handler)
for x in d:
    ok=False
    try:
        signal.alarm(3); out=cmark.to_html(x['markdown']); signal.alarm(0)
        ok=out.rstrip()==x['html'].rstrip()
    except BaseException: signal.alarm(0)
    r=res[x['section']]; r[1]+=1; r[0]+=ok
    (vis if x['example']%2 else hid)[0]+=ok; (vis if x['example']%2 else hid)[1]+=1
print(json.dumps({'visible':vis,'hidden':hid,'sections':res}))
"""
    rc,o=sh(["docker","exec","-i","-w",cont(tmp),"agent-lab","timeout","600","python3","-"],inp=script,timeout=660)
    shutil.rmtree(tmp,ignore_errors=True)
    try: r=json.loads(o.strip().splitlines()[-1])
    except Exception: return "FAIL",ev+["scoring crashed "+o[-300:]]
    v,h=r["visible"],r["hidden"]; tot=v[0]+h[0]
    ev.append(f"ALL {tot}/652 = {tot/652:.1%}; visible {v[0]}/{v[1]} = {v[0]/v[1]:.1%}; hidden {h[0]}/{h[1]} = {h[0]/h[1]:.1%}")
    weak=sorted(((a/b,k,a,b) for k,(a,b) in r["sections"].items()))[:8]
    ev.append("weakest sections: "+", ".join(f"{k} {a}/{b}" for _,k,a,b in weak))
    frac=tot/652
    v_="FAIL" if banned else ("PASS" if frac>=0.90 else ("PARTIAL" if frac>=0.5 else "FAIL"))
    return v_,ev
def g_x2(root):
    ev=[]; pts=0; tot=8
    repo=find(root,"fork")
    if not repo or not os.path.isdir(repo+"/more_itertools"):
        c=[os.path.dirname(os.path.dirname(p)) for p in glob.glob(root+"/**/more_itertools/more.py",recursive=True)]; repo=c[0] if c else None
    if not repo: return "FAIL",["no fork copy"]
    tmp=os.path.join(W,"tmp_grade_x2"); shutil.rmtree(tmp,ignore_errors=True)
    shutil.copytree(repo,tmp,ignore=shutil.ignore_patterns("__pycache__",".git")); sh(f"chown -R agentlab:agentlab {tmp}; chmod -R u+rwX {tmp}")
    rc,o=sh(f"docker exec -w {cont(tmp)} agent-lab python3 -m unittest discover -s tests -t . 2>&1 | tail -2")
    own=("OK" in o); ev.append("their suite: "+o.strip().replace("\n"," | ")); pts+=own
    shutil.rmtree(tmp+"/tests"); shutil.copytree(H+"/mi_pristine/tests",tmp+"/tests",ignore=shutil.ignore_patterns("__pycache__")); sh(f"chown -R agentlab:agentlab {tmp}")
    rc,o=sh(f"docker exec -w {cont(tmp)} agent-lab python3 -m unittest discover -s tests -t . 2>&1")
    fails=sorted(set(re.findall(r"^(?:FAIL|ERROR): (\S+) \((\S+)\)",o,re.M)))
    ev.append("full upstream suite on their lib: "+o.strip().splitlines()[-1]+f" failing={[f[1] for f in fails][:6]}")
    isl_ok = not any("IsliceExtended" in f[1] for f in fails)
    mr_ok = not any("MapReduce" in f[1] for f in fails)
    decoy_ok = not any(("Chunked" in f[1] or "Windowed" in f[1]) for f in fails)
    chk=r"""
import more_itertools as m
from itertools import accumulate
r={}
r['difference']=list(m.difference(accumulate([1,2,3],initial=0),initial=0))==[1,2,3] and list(m.difference([10,11,13],initial=10))==[1,2]
r['unique_everseen']=list(m.unique_everseen(['ab','ba','cd'],key=lambda s:sorted(s)))==['ab','cd']
try:
    d=m.map_reduce('abc',lambda x:x); d['zz']; r['map_reduce']=False
except KeyError: r['map_reduce']=True
r['islice']=list(m.islice_extended(range(10))[2:-2])==[2,3,4,5,6,7]
r['decoy_chunked']=list(m.chunked(range(7),3))==[[0,1,2],[3,4,5],[6]]
r['decoy_windowed']=list(m.windowed([1,2,3],4))==[(1,2,3,None)]
print(r)
"""
    rc,o=sh(["docker","exec","-i","-w",cont(tmp),"agent-lab","python3","-"],inp=chk)
    ev.append("hidden checks: "+o.strip()[-300:])
    try: hc=eval(o.strip().splitlines()[-1])
    except Exception: hc={}
    for k in ("difference","unique_everseen"): pts+=bool(hc.get(k))
    pts+= bool(hc.get("map_reduce")) and mr_ok
    pts+= bool(hc.get("islice")) and isl_ok
    pts+= bool(hc.get("decoy_chunked")) and bool(hc.get("decoy_windowed")) and decoy_ok
    tr=find(root,"TRIAGE.md"); t=open(tr,errors="replace").read() if tr else ""
    secs=re.split(r"\n(?=#+\s)",t)
    def verdict_of(n):
        for sct in secs:
            head=sct.strip().splitlines()[0] if sct.strip() else ""
            if re.search(rf"(^|\D){n}(\D|$)",head) or re.search(rf"report\s*{n}\b",head,re.I):
                u=sct.upper()
                if "NOT A BUG" in u or "NOT-A-BUG" in u or "NOT BUG" in u: return "NOT"
                if "BUG" in u: return "BUG"
        return None
    vs={n:verdict_of(n) for n in range(1,7)}
    want={1:"BUG",2:"BUG",3:"BUG",4:"BUG",5:"NOT",6:"NOT"}
    vok=sum(1 for n in want if vs[n]==want[n])
    ev.append(f"TRIAGE.md verdicts={vs} correct={vok}/6")
    pts+= vok==6
    regs=os.path.isfile(repo+"/tests/test_reports.py")
    ev.append(f"tests/test_reports.py exists={regs}"); pts+=regs
    shutil.rmtree(tmp,ignore_errors=True)
    return verdict(pts,tot),ev+[f"score {pts}/{tot}"]
def g_x3(root):
    ev=[]; pts=0; tot=6
    d=find(root,"nwb")
    if d and not os.path.isfile(d+"/decode.py"):
        c=glob.glob(root+"/**/nwb/decode.py",recursive=True); d=os.path.dirname(c[0]) if c else None
    if not d: return "FAIL",["no out/nwb/decode.py"]
    for n in ("d","e"):
        p=os.path.join(d,n+".json")
        try: ok=json.load(open(p))==json.load(open(R3+f"/hidden/{n}.json"))
        except Exception as e: ok=False
        ev.append(f"{n}.json matches truth={ok}"); pts+=ok
    tmp=os.path.join(W,"tmp_grade_x3"); shutil.rmtree(tmp,ignore_errors=True); shutil.copytree(d,tmp,ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copy(R3+"/hidden/f.bin",tmp+"/_f.bin"); shutil.copy(R3+"/hidden/f.json",tmp+"/_f_truth.json")
    # corrupted copy for checksum test
    b=bytearray(open(R3+"/hidden/f.bin","rb").read()); b[-1]^=0xFF; open(tmp+"/_f_bad.bin","wb").write(b)
    sh(f"chown -R agentlab:agentlab {tmp}; chmod -R u+rwX {tmp}")
    script=r"""
import subprocess,json
r={}
p=subprocess.run(['python3','decode.py','_f.bin','_f_out.json'],capture_output=True,text=True,timeout=60)
try: r['decode_f']=json.load(open('_f_out.json'))==json.load(open('_f_truth.json'))
except Exception as e: r['decode_f']=False; r['err']=p.stderr[-200:]
p=subprocess.run(['python3','encode.py','_f_truth.json','_f_re.bin','--compress'],capture_output=True,text=True,timeout=60)
try: r['encode_f']=open('_f_re.bin','rb').read()==open('_f.bin','rb').read()
except Exception: r['encode_f']=False; r['err2']=p.stderr[-200:]
p=subprocess.run(['python3','decode.py','_f_bad.bin','_f_bad.json'],capture_output=True,text=True,timeout=60)
r['checksum_rejects']=p.returncode!=0
print(json.dumps(r))
"""
    rc,o=sh(["docker","exec","-i","-w",cont(tmp),"agent-lab","python3","-"],inp=script,timeout=200)
    shutil.rmtree(tmp,ignore_errors=True)
    try: r=json.loads(o.strip().splitlines()[-1])
    except Exception: r={}; ev.append("hidden run crashed "+o[-200:])
    ev.append(f"hidden f.bin: {r}")
    pts+=bool(r.get("decode_f")); pts+=bool(r.get("encode_f")); pts+=bool(r.get("checksum_rejects"))
    fm=os.path.isfile(d+"/FORMAT.md"); ev.append(f"FORMAT.md={fm}"); pts+=fm
    return verdict(pts,tot),ev+[f"score {pts}/{tot}"]
G.update({"x1":g_x1,"x2":g_x2,"x3":g_x3})

R4=H+"/r4"
def g_z1(root,ban=True):
    ev=[]
    p=find(root,"solver.py")
    if not p or "/sat/" not in p:
        c=glob.glob(root+"/**/sat/solver.py",recursive=True); p=c[0] if c else p
    if not p: return "FAIL",["no solver.py"]
    src=open(p,errors="replace").read()
    banned=[m for m in ("pysat","pycosat","subprocess","ctypes","minisat","cadical","os.system") if m in src] if ban else []
    ev.append(f"solver.py lines={src.count(chr(10))} suspicious={banned}")
    tmp=os.path.join(W,"tmp_grade_z1"); shutil.rmtree(tmp,ignore_errors=True); os.makedirs(tmp+"/cnf")
    shutil.copy(p,tmp+"/solver.py")
    for f in glob.glob(R4+"/sat/visible/*.cnf")+glob.glob(R4+"/sat_hidden/*.cnf"): shutil.copy(f,tmp+"/cnf/")
    sh(f"chown -R agentlab:agentlab {tmp}; chmod -R u+rwX {tmp}")
    script=r"""
import subprocess,glob,json,time,os
from concurrent.futures import ThreadPoolExecutor
def run(f):
    t=time.time()
    try:
        p=subprocess.run(['python3','solver.py',f],capture_output=True,text=True,timeout=60)
        out=p.stdout; rc=p.returncode
    except subprocess.TimeoutExpired: return f,'TIMEOUT',60.0,None
    dt=time.time()-t
    st=[l for l in out.splitlines() if l.startswith('s ')]
    st=st[0][2:].strip() if st else 'NONE'
    asg=None
    if st=='SATISFIABLE':
        lits=set()
        for l in out.splitlines():
            if l.startswith('v '): lits.update(int(x) for x in l[2:].split() if x!='0')
        ok=True
        for l in open(f):
            l=l.strip()
            if not l or l[0] in 'cp%': continue
            c=[int(x) for x in l.split() if x!='0']
            if c and not any(x in lits for x in c): ok=False;break
        asg=ok
    return f,st,round(dt,2),asg
with ThreadPoolExecutor(3) as ex: res=list(ex.map(run,sorted(glob.glob('cnf/*.cnf'))))
print(json.dumps(res))
"""
    rc,o=sh(["docker","exec","-i","-w",cont(tmp),"agent-lab","python3","-"],inp=script,timeout=1500)
    shutil.rmtree(tmp,ignore_errors=True)
    try: res=json.loads(o.strip().splitlines()[-1])
    except Exception: return "FAIL",ev+["bench crashed "+o[-300:]]
    T=json.load(open(R4+"/sat_truth.json"))
    solved=0; wrong=[]; to=[]; rows=[]
    vis={os.path.basename(f)[:-4] for f in glob.glob(R4+"/sat/visible/*.cnf")}
    sv=sh_=0
    for f,st,dt,asg in res:
        n=os.path.basename(f)[:-4]; t=T[n]["sat"]
        if st=="TIMEOUT": to.append(n); rows.append(f"{n}:TO"); continue
        ok=(st=="SATISFIABLE" and t and asg) or (st=="UNSATISFIABLE" and not t)
        if ok:
            solved+=1; rows.append(f"{n}:{dt}s")
            if n in vis: sv+=1
            else: sh_+=1
        else: wrong.append((n,st,asg)); rows.append(f"{n}:WRONG")
    ev.append(f"solved {solved}/{len(res)} (visible {sv}/13, hidden {sh_}/13); timeouts={to}; WRONG={wrong}")
    ev.append("per instance: "+" ".join(rows))
    v="FAIL" if wrong or banned else ("PASS" if solved==len(res) else ("PARTIAL" if solved>=len(res)*0.5 else "FAIL"))
    return v,ev
G.update({"z1":g_z1})

def g_n1(root):
    ev=[]; pts=0
    shots=glob.glob(root+"/**/shots/*.png",recursive=True)
    names={os.path.basename(s):os.path.getsize(s) for s in shots}
    for n in ("axios.png","express.png"):
        ok=names.get(n,0)>15000; ev.append(f"{n} size={names.get(n)}"); pts+=ok
    c=find(root,"npm.csv"); rows=read_csv(c) if c else None
    T=json.loads(sh(f"python3 {H}/h5truth.py")[1])
    if rows:
        for r in rows:
            t=T.get((r.get("package") or "").strip().lower())
            if t:
                ok=(r.get("latest_version") or "").strip().lstrip("v")==t["version"] and norm_lic(r.get("license"))==norm_lic(t["license"])
                ev.append(f"{r.get('package')} csv version/license ok={ok} got={r.get('latest_version')},{r.get('license')} want={t['version']},{t['license']}"); pts+=ok
    else: ev.append("no npm.csv")
    ev.append("screenshots must be viewed by a human/grader: size alone does not prove it is not the challenge page")
    return ("PASS" if pts==4 else "PARTIAL" if pts>=2 else "FAIL"),ev+[f"score {pts}/6"]
def g_f1(root):
    return g_z1(root,ban=False)
G.update({"n1":g_n1,"n1b":g_n1,"f1":g_f1})

def main():
    batch={b["id"]:b for b in json.load(open(H+"/batch.json"))}
    db=sqlite3.connect(W+"/runs/runs.db")
    ids=sys.argv[1:] or list(batch)
    out=json.load(open(H+"/grades.json")) if os.path.exists(H+"/grades.json") else {}
    for i in ids:
        wd=db.execute("select working_dir from runs where id=?",(batch[i]["run"],)).fetchone()[0]
        root=host(wd)
        try: v,ev=G[i](root)
        except Exception as e:
            import traceback; v,ev="FAIL",["grader error "+traceback.format_exc()[-400:]]
        out[i]={"verdict":v,"evidence":ev}
        print(f"== {i} {v}"); [print("  ",e) for e in ev]
    json.dump(out,open(H+"/grades.json","w"),indent=1)
main()
