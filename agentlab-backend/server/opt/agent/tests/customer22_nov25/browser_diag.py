#!/usr/bin/env python3
"""Real-browser block diagnosis. Runs in the agent-lab container. Launches chrome-keeper (AgentLab's own
browser path) on a private Xvfb display, then drives it either with raw CDP (Page.navigate only) or with
Playwright connect_over_cdp (what browser-mcp does). No secrets printed."""
import asyncio, json, os, subprocess, sys, time, shutil, urllib.request, base64
import websockets
OUT=sys.argv[1]; LABEL=sys.argv[2]; DRIVER=sys.argv[3]; SEQ=sys.argv[4].split(",")
PROFILE=sys.argv[5] if len(sys.argv)>5 else f"/tmp/bd-prof-{LABEL}"
DISP=":190"; PORT=9390
URLS={
 "walmart_home":"https://www.walmart.com/",
 "walmart_search":"https://www.walmart.com/search?q=robot+vacuum",
 "walmart_product":"https://www.walmart.com/ip/AIRROBO-G60-3-in-1-Robot-Vacuum-and-Mop-Combo-with-Smart-App-Voice-Control-2-in-1-Tank-for-pet-hair/14835814051",
 "bestbuy_home":"https://www.bestbuy.com/",
 "bestbuy_search":"https://www.bestbuy.com/site/searchpage.jsp?st=robot+vacuum",
 "bestbuy_product":"BB_PRODUCT",
 "glassdoor_home":"https://www.glassdoor.com/",
 "glassdoor_company":"https://www.glassdoor.com/Overview/Working-at-Google-EI_IE9079.11,17.htm",
 "glassdoor_jobs":"https://www.glassdoor.com/Job/remote-data-engineer-jobs-SRCH_IL.0,6_IS11047_KO7,20.htm",
 "g2_home":"https://www.g2.com/",
 "g2_product":"https://www.g2.com/products/slack/reviews",
}
FP="""(()=>{let gl=null;try{const c=document.createElement('canvas').getContext('webgl');const e=c.getExtension('WEBGL_debug_renderer_info');gl=[c.getParameter(e.UNMASKED_VENDOR_WEBGL),c.getParameter(e.UNMASKED_RENDERER_WEBGL)]}catch(x){gl=String(x)}
return JSON.stringify({ua:navigator.userAgent,webdriver:navigator.webdriver,plugins:navigator.plugins.length,langs:navigator.languages,tz:Intl.DateTimeFormat().resolvedOptions().timeZone,
platform:navigator.platform,hc:navigator.hardwareConcurrency,mem:navigator.deviceMemory,chrome:typeof window.chrome,screen:[screen.width,screen.height,devicePixelRatio],webgl:gl,
uad:navigator.userAgentData?navigator.userAgentData.brands.map(b=>b.brand+' '+b.version):null})})()"""
PROBE="""(()=>{const t=document.title;const b=(document.body?document.body.innerText:'').slice(0,4000);
const pick=(re)=>re.test(t+' '+b);
const prices=(b.match(/\\$\\d{2,4}(\\.\\d{2})?/g)||[]).slice(0,5);
let bb=[...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>/bestbuy\\.com\\/(site\\/.+\\.p\\?skuId=|product\\/)/.test(h)).slice(0,2);
return JSON.stringify({title:t,url:location.href,prices,bb,
 px:pick(/Robot or human|Press & Hold|press and hold/i), cf:pick(/Just a moment|Verify you are human|Performing security verification|humans only/i),
 dd:!!document.querySelector('iframe[src*="captcha-delivery"]')||pick(/temporarily restricted|automated \\(bot\\) activity/i),
 akintl:pick(/Select your Country/i), pwglobals:Object.keys(window).filter(k=>/playwright|__pw|cdc_/i.test(k)), text:b.slice(0,300)})})()"""
def start():
    subprocess.run(["pkill","-f","Xvfb :190 "]); time.sleep(0.5)
    for f in ("/tmp/.X190-lock","/tmp/.X11-unix/X190"):
        try: os.remove(f)
        except OSError: pass
    os.makedirs(PROFILE,exist_ok=True); os.makedirs(OUT,exist_ok=True)
    x=subprocess.Popen(["Xvfb",DISP,"-screen","0","1920x1080x24","-nolisten","tcp","-dpi","96"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
    time.sleep(1.5)
    env=dict(os.environ,DESKTOP_CHROME_PROFILE=PROFILE,CHROME_DOWNLOADS="/tmp/bd-dl",DESKTOP_DISPLAY=DISP,DESKTOP_XAUTHORITY="",CHROME_CDP_PORT=str(PORT),
             CHROME_KEEPER_LOG=f"/tmp/bd-keeper-{LABEL}.log",CHROME_KEEPER_LOCK=f"/tmp/bd-{LABEL}.lock",CHROME_LOG=f"/tmp/bd-chrome-{LABEL}.log",CHROME_KIOSK="1")
    k=subprocess.Popen([sys.executable,os.environ.get("KEEPER","/opt/tools/chrome-keeper")],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
    for _ in range(120):
        try: urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version",timeout=1); break
        except Exception: time.sleep(0.25)
    time.sleep(3)
    return x,k
def stop(x,k):
    for p in (k,):
        try: os.killpg(p.pid,15)
        except Exception: pass
    subprocess.run(["pkill","-f",f"user-data-dir={PROFILE}"]); time.sleep(1); x.terminate()
async def raw_run():
    tabs=json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list"))
    ws=[t for t in tabs if t["type"]=="page"][0]["webSocketDebuggerUrl"]
    res=[]
    async with websockets.connect(ws,max_size=50_000_000) as s:
        n=[0]; docs={}
        async def call(m,p=None,timeout=40):
            n[0]+=1; mid=n[0]; await s.send(json.dumps({"id":mid,"method":m,"params":p or {}}))
            end=time.time()+timeout
            while time.time()<end:
                msg=json.loads(await asyncio.wait_for(s.recv(),timeout=end-time.time()))
                if msg.get("method")=="Network.responseReceived" and msg["params"].get("type")=="Document":
                    r=msg["params"]["response"]; docs[r["url"]]=(r["status"],{k.lower():v for k,v in r["headers"].items() if k.lower() in("server","cf-mitigated","x-datadome","x-px","set-cookie","location")})
                if msg.get("id")==mid: return msg.get("result",{})
            return {}
        await call("Page.enable"); await call("Network.enable")
        for i,step in enumerate(SEQ):
            url=URLS[step]; docs.clear()
            if url=="BB_PRODUCT":
                bbs=[r.get("bb") for r in res if r.get("bb")]
                if not bbs: res.append({"step":step,"skip":"no sku link"}); continue
                url=bbs[-1][0]
            await call("Page.navigate",{"url":url})
            t0=time.time()
            while time.time()-t0<12:
                try:
                    msg=json.loads(await asyncio.wait_for(s.recv(),timeout=1))
                    if msg.get("method")=="Network.responseReceived" and msg["params"].get("type")=="Document":
                        r=msg["params"]["response"]; docs[r["url"]]=(r["status"],{k.lower():str(v)[:60] for k,v in r["headers"].items() if k.lower() in("server","cf-mitigated","x-datadome","x-px","location")})
                except asyncio.TimeoutError: pass
            pr=json.loads((await call("Runtime.evaluate",{"expression":PROBE,"returnByValue":True}))["result"]["value"])
            if i==0: pr["fp"]=json.loads((await call("Runtime.evaluate",{"expression":FP,"returnByValue":True}))["result"]["value"])
            shot=await call("Page.captureScreenshot",{"format":"png"})
            fn=f"{OUT}/{LABEL}_{i}_{step}.png"; open(fn,"wb").write(base64.b64decode(shot.get("data","")))
            pr.update(step=step,docs={u[:70]:v for u,v in docs.items()},shot=os.path.basename(fn)); res.append(pr)
            await asyncio.sleep(3)
    return res
def pw_run():
    if DRIVER=='patchright':
        from patchright.sync_api import sync_playwright
    else:
        from playwright.sync_api import sync_playwright
    res=[]
    with sync_playwright() as p:
        b=p.chromium.connect_over_cdp(f"http://127.0.0.1:{PORT}")
        ctx=b.contexts[0]; pg=ctx.pages[0] if ctx.pages else ctx.new_page()
        for i,step in enumerate(SEQ):
            url=URLS[step]
            if url=="BB_PRODUCT":
                bbs=[r.get("bb") for r in res if r.get("bb")]
                if not bbs: res.append({"step":step,"skip":"no sku link"}); continue
                url=bbs[-1][0]
            st=None; hd={}
            try:
                r=pg.goto(url,wait_until="domcontentloaded",timeout=40000); st=r.status if r else None
                hd={k:v[:60] for k,v in (r.headers.items() if r else []) if k in("server","cf-mitigated","x-datadome","location")}
            except Exception as e: st=str(e)[:80]
            pg.wait_for_timeout(9000)
            pr=json.loads(pg.evaluate(PROBE))
            if i==0: pr["fp"]=json.loads(pg.evaluate(FP))
            fn=f"{OUT}/{LABEL}_{i}_{step}.png"; pg.screenshot(path=fn)
            pr.update(step=step,docs={"main":(st,hd)},shot=os.path.basename(fn)); res.append(pr)
            pg.wait_for_timeout(3000)
        b.close()
    return res
x,k=start()
try:
    res=asyncio.run(raw_run()) if DRIVER=="raw" else pw_run()
finally:
    stop(x,k)
for r in res: r["label"]=LABEL; r["driver"]=DRIVER; print(json.dumps(r),flush=True)
