import json,subprocess,time,uuid,urllib.request
tok=next(l.split("=",1)[1].strip() for l in open("/opt/agent/.env") if l.startswith("AGENT_LAB_TOKEN="))
def api(m,p,b=None):
    r=urllib.request.Request("http://127.0.0.1:8000"+p,data=json.dumps(b).encode() if b is not None else None,method=m,headers={"X-Session-API-Key":tok,"Content-Type":"application/json"})
    with urllib.request.urlopen(r,timeout=120) as x: return json.load(x)
cid=str(uuid.uuid4()); J=f"/workspace/jobs/{cid}"
sh=lambda c: subprocess.run(["docker","exec","-u","10001","agent-lab","bash","-c",c],check=True)
sh(f"mkdir -p {J} && ffmpeg -loglevel error -y -f lavfi -i color=c=0x228B22:s=640x360 -vf \"drawtext=text='Q3 ZEBRA':fontsize=90:fontcolor=white:x=60:y=120\" -frames:v 1 {J}/probe.png")


s=api("GET","/api/settings")["agent_settings"]; s["llm"]["model"]="deepseek/deepseek-flash"; s["llm"]["disable_vision"]=False
hooks=api("POST","/api/hooks",{"load_user_hooks":True,"load_project_hooks":False}).get("hook_config")
api("POST","/api/conversations",{"conversation_id":cid,"agent_settings":s,"hook_config":hooks,"workspace":{"working_dir":J},"max_iterations":8,
 "tags":{"source":"grok-bot-ask","purpose":"view-plumbing-probe"},
 "initial_message":{"role":"user","content":[{"type":"text","text":"Plumbing probe (tiny): in your terminal run exactly `view probe.png`. Do not open the image any other way and do not use look. On your next step, reply in one line with the background colour and the exact text you see in the image (say 'no image received' if none arrived), then finish."}],"run":True}})
print("conv",cid)
for i in range(80):
    time.sleep(3)
    st=api("GET",f"/api/conversations/{cid}").get("execution_status")
    if st not in ("running","queued","starting","idle") or (st=="idle" and i>8): break
ev=api("GET",f"/api/conversations/{cid}/events/search?limit=80")["items"]
for e in ev:
    k=e.get("kind")
    if k=="ActionEvent": print("ACTION",e.get("tool_name"),json.dumps(e.get("action"))[:160])
    elif k=="ObservationEvent": print("  OBS",json.dumps((e.get("observation") or {}).get("content"))[:300])
    elif k=="MessageEvent": print("MSG",e.get("source"),[ (c.get("text") or "")[:200] if c.get("type")=="text" else "<image>" for c in e["llm_message"]["content"]])
info=api("GET",f"/api/conversations/{cid}")
print("status",st,"cost",round(sum((m or {}).get("accumulated_cost",0) for m in info["stats"]["usage_to_metrics"].values()),4))
import sys
ok=any(e.get("kind")=="ActionEvent" and e.get("tool_name")=="finish" and "ZEBRA" in json.dumps(e.get("action")).upper() for e in ev)
sys.exit(0 if ok else 1)
