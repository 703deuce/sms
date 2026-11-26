import asyncio, json, subprocess, sys, time, urllib.request, websockets
CDP="http://127.0.0.1:9222"; OUT="/workspace/tools/shots"; B="/workspace/tools/bin/"
import os; os.makedirs(OUT, exist_ok=True)
def sh(*a): r=subprocess.run(a,capture_output=True,text=True); return (r.stdout+r.stderr).strip()
async def ev(expr):
    t=[x for x in json.load(urllib.request.urlopen(CDP+"/json")) if "dragtest" in x.get("url","")][0]
    async with websockets.connect(t["webSocketDebuggerUrl"],max_size=None) as ws:
        await ws.send(json.dumps({"id":1,"method":"Runtime.evaluate","params":{"expression":expr,"returnByValue":True}}))
        while True:
            r=json.loads(await ws.recv())
            if r.get("id")==1: return r["result"]["result"].get("value")
E=lambda x: asyncio.run(ev(x))
print(sh(B+"desktop-open","file:///workspace/tools/dragtest.html")); time.sleep(3)
off=E("JSON.stringify([screenX, screenY+outerHeight-innerHeight, devicePixelRatio])"); ox,oy,dpr=json.loads(off)
def at(sel, fx):
    r=json.loads(E(f"JSON.stringify(document.querySelector('{sel}').getBoundingClientRect())"))
    return int(ox+r["left"]+r["width"]*fx), int(oy+r["top"]+r["height"]/2)
print(sh(B+"desktop-shot",f"{OUT}/1_before.png"))
x1,y=at("#s",0.01); x2,_=at("#s",0.99)
print(sh(B+"drag",str(x1),str(y),str(x2),str(y),"--steps","30","--shot",f"{OUT}/2_after_slider_drag.png"))
print("slider value after drag:", E("s.value"))
a,ty=at("#t",0.0); b,_=at("#t",1.0)
print(sh(B+"drag",str(a+2),str(ty),str(b-2),str(ty),"--shot",f"{OUT}/3_after_text_select.png"))
print("selected text:", repr(E("getSelection().toString()")))
print(sh(B+"click",str(a+40),str(ty),"--right","--shot",f"{OUT}/4_after_right_click.png")); sh(B+"key","Escape")
print("scrollY before:", E("scrollY"))
print(sh(B+"scroll","down","20","--at","960","700","--shot",f"{OUT}/5_after_scroll_down.png"))
print("scrollY after down 20:", E("scrollY"))
print(sh(B+"scroll","up","8","--at","960","700")); print("scrollY after up 8:", E("scrollY"))
print(sh(B+"zoom","in","2","--shot",f"{OUT}/6_after_zoom_in.png")); print("zoom ratio:", E("devicePixelRatio")); sh(B+"zoom","reset")
print(sh(B+"click",str(a+40),str(ty),"--double")); print("double-click selection:", repr(E("getSelection().toString()")))
print(sh(B+"click",str(a+40),str(ty),"--mods","shift")); print(sh(B+"key","shift","--hold-ms","300"))
