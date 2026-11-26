import json,glob,sys,sqlite3
W="/opt/agent/workspace"
db=sqlite3.connect(W+"/runs/runs.db"); db.row_factory=sqlite3.Row
out={}
for b in json.load(open("/opt/agent/tests/customer22_nov25/batch.json")):
    if len(sys.argv)>1 and b["id"] not in sys.argv[1:]: continue
    msgs=[]; CID=b["cid"].replace("-","")
    for f in sorted(glob.glob(f"{W}/conversations/{CID}/events/*.json")):
        e=json.load(open(f))
        if e.get("kind")=="MessageEvent" and e.get("source")=="agent":
            txt="".join(c.get("text","") for c in (e.get("llm_message") or {}).get("content",[]) if isinstance(c,dict))
            msgs.append(txt)
        if e.get("kind")=="ActionEvent" and e.get("tool_name")=="finish":
            a=(e.get("tool_call") or {}).get("arguments") or ""
            try: a=json.loads(a)
            except Exception: a={}
            msgs.append("[finish] "+str(a.get("message",""))[:6000])
    kids=db.execute("select id,title,status,result,working_dir from runs where parent_conversation_id=?",(b["cid"],)).fetchall()
    out[b["id"]]=dict(messages=msgs,helpers=[dict(k) for k in kids])
json.dump(out,open("/opt/agent/tests/customer22_nov25/msgs.json","w"),indent=1)
print({k:len(v["messages"]) for k,v in out.items()})
