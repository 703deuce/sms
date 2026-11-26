import json, os, sys, time, socket, subprocess, tempfile, urllib.request, urllib.error
APP=sys.argv[1]
def free():
    s=socket.socket(); s.bind(("127.0.0.1",0)); p=s.getsockname()[1]; s.close(); return p
PORT=free(); DB=tempfile.mktemp(suffix=".db")
def start():
    p=subprocess.Popen([sys.executable,"server.py","--port",str(PORT),"--db",DB],cwd=APP,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for _ in range(60):
        try: urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/stats",timeout=1); return p
        except Exception: time.sleep(0.25)
    return p
def req(m,path,body=None,raw=None):
    data=raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    r=urllib.request.Request(f"http://127.0.0.1:{PORT}{path}",data=data,method=m,headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(r,timeout=5) as x:
            t=x.read(); return x.status,(json.loads(t) if t else None),x.headers.get("Content-Type","")
    except urllib.error.HTTPError as e:
        t=e.read()
        try: j=json.loads(t) if t else None
        except Exception: j="NONJSON"
        return e.code,j,e.headers.get("Content-Type","")
    except Exception as e: return 0,str(e),""
R=[]
def ck(name,cond): R.append((name,bool(cond)))
p=start()
try:
    s,j,ct=req("POST","/api/issues",{"title":"  Login fails  ","labels":["UI","bug","ui"],"priority":"high"})
    ck("create 201",s==201); ck("create trims title",j and j.get("title")=="Login fails"); ck("labels dedup sorted lowercase",j and j.get("labels")==["bug","ui"])
    ck("create defaults",j and j.get("status")=="open" and j.get("body")=="" and j.get("comment_count")==0 and str(j.get("created_at","")).endswith("Z"))
    ck("json content-type","application/json" in ct)
    id1=j.get("id") if isinstance(j,dict) else None; ck("first id is 1",id1==1)
    for bad in ({},{"title":""},{"title":"   "},{"title":"x"*201},{"title":5},{"title":"ok","priority":"urgent"},{"title":"ok","labels":"bug"},{"title":"ok","labels":[1]}):
        s,j,_=req("POST","/api/issues",bad); ck(f"create 400 {json.dumps(bad)[:30]}",s==400 and isinstance(j,dict) and "error" in j)
    s,j,_=req("POST","/api/issues",raw=b"{not json"); ck("invalid json 400",s==400)
    s,j,_=req("POST","/api/issues",{"title":"x"*200}); ck("200-char title ok",s==201)
    ids=[]
    for i in range(25):
        s,j,_=req("POST","/api/issues",{"title":f"Task {i}","body":"Needle here" if i%5==0 else "plain","priority":["low","medium","high"][i%3],"labels":["Backend"] if i%2 else []})
        ids.append(j["id"])
    s,j,_=req("GET","/api/issues"); ck("list default page",s==200 and j["total"]==27 and len(j["items"])==20 and j["page"]==1 and j["per_page"]==20)
    ck("list sorted by id",[x["id"] for x in j["items"]]==sorted(x["id"] for x in j["items"]))
    s,j,_=req("GET","/api/issues?page=2&per_page=10"); ck("pagination page2",s==200 and [x["id"] for x in j["items"]]==list(range(11,21)))
    s,j,_=req("GET","/api/issues?per_page=101"); ck("per_page>100 400",s==400)
    s,j,_=req("GET","/api/issues?page=0"); ck("page=0 400",s==400)
    s,j,_=req("GET","/api/issues?page=abc"); ck("page=abc 400",s==400)
    s,j,_=req("GET","/api/issues?status=done"); ck("bad status filter 400",s==400)
    s,j,_=req("GET","/api/issues?q=NEEDLE&per_page=100"); ck("q search body case-insens",s==200 and j["total"]==5)
    s,j,_=req("GET","/api/issues?label=backend&priority=high&per_page=100"); exp=sum(1 for i in range(25) if i%2 and i%3==2); ck("label+priority filter",s==200 and j["total"]==exp)
    s,j,_=req("GET","/api/issues?q=login"); ck("q search title",s==200 and j["total"]==1)
    s,j,_=req("GET","/api/issues/1"); ck("get one",s==200 and j["id"]==1)
    s,j,_=req("GET","/api/issues/9999"); ck("get 404",s==404 and isinstance(j,dict) and "error" in j)
    s,j,_=req("PATCH","/api/issues/1",{"status":"in_progress"}); ck("open->in_progress",s==200 and j["status"]=="in_progress")
    time.sleep(1.1)
    s,j,_=req("PATCH","/api/issues/1",{"status":"closed","priority":"low"}); ck("->closed + priority",s==200 and j["status"]=="closed" and j["priority"]=="low" and j["updated_at"]>=j["created_at"] and j["updated_at"]!=j["created_at"])
    s,j,_=req("PATCH","/api/issues/1",{"status":"in_progress"}); ck("closed->in_progress 409",s==409)
    s,j,_=req("PATCH","/api/issues/1",{"status":"closed"}); ck("same status no-op ok",s==200)
    s,j,_=req("PATCH","/api/issues/1",{"status":"open"}); ck("closed->open",s==200 and j["status"]=="open")
    s,j,_=req("PATCH","/api/issues/1",{"status":"weird"}); ck("bad status 400",s==400)
    s,j,_=req("PATCH","/api/issues/1",{"title":""}); ck("patch empty title 400",s==400)
    s,j,_=req("PATCH","/api/issues/9999",{"title":"x"}); ck("patch 404",s==404)
    s,j,_=req("POST","/api/issues/2/comments",{"author":"amy","text":"first"}); ck("comment 201",s==201 and j.get("issue_id")==2 and j.get("author")=="amy")
    req("POST","/api/issues/2/comments",{"author":"bob","text":"second"})
    s,j,_=req("POST","/api/issues/2/comments",{"author":"","text":"x"}); ck("comment 400",s==400)
    s,j,_=req("POST","/api/issues/9999/comments",{"author":"a","text":"x"}); ck("comment 404",s==404)
    s,j,_=req("GET","/api/issues/2/comments"); ck("list comments order",s==200 and isinstance(j,list) and [c["text"] for c in j]==["first","second"])
    s,j,_=req("GET","/api/issues/2"); ck("comment_count",j.get("comment_count")==2)
    s,j,_=req("GET","/api/stats"); 
    ck("stats keys",s==200 and set(j.get("by_status",{}))=={"open","in_progress","closed"} and set(j.get("by_priority",{}))=={"low","medium","high"} and j["total"]==27)
    s,j,ct=req("DELETE","/api/issues/3"); ck("delete 204",s==204)
    s,j,_=req("GET","/api/issues/3"); ck("deleted 404",s==404)
    s,j,_=req("DELETE","/api/issues/3"); ck("delete missing 404",s==404)
    s,j,_=req("POST","/api/issues",{"title":"after delete"}); ck("ids not reused",j.get("id")==28)
    s,j,_=req("GET","/api/nope"); ck("unknown route 404",s==404)
    try:
        h=urllib.request.urlopen(f"http://127.0.0.1:{PORT}/",timeout=5).read().decode("utf-8","replace").lower()
        ck("frontend html with fetch",("<html" in h or "<!doctype" in h) and "fetch(" in h or ("<script src" in h))
    except Exception: ck("frontend html with fetch",False)
finally:
    p.terminate(); p.wait(5)
p=start()
try:
    s,j,_=req("GET","/api/issues/2"); ck("persists across restart",s==200 and j.get("comment_count")==2)
    s,j,_=req("GET","/api/stats"); ck("stats after restart",s==200 and j.get("total")==27)
finally:
    p.terminate(); p.wait(5)
os.path.exists(DB) and os.remove(DB)
ok=sum(1 for _,c in R if c)
print(json.dumps({"passed":ok,"total":len(R),"failed":[n for n,c in R if not c]}))
