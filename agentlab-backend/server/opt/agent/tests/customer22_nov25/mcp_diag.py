#!/usr/bin/env python3
"""Drive Playwright MCP (the agent's real browser tool) over stdio against a chrome-keeper browser. Usage:
mcp_diag.py OUT LABEL PWDIR URL1,URL2,...   (prints page title + bot markers per URL; saves tools list)"""
import json, os, subprocess, sys, time, urllib.request
OUT, LABEL, PW, URLS = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(",")
DISP, PORT = ":190", 9390; PROFILE = f"/tmp/bd-prof-{LABEL}"
subprocess.run(["pkill", "-f", "Xvfb :190 "]); time.sleep(0.5)
for f in ("/tmp/.X190-lock", "/tmp/.X11-unix/X190"):
    try: os.remove(f)
    except OSError: pass
os.makedirs(PROFILE, exist_ok=True); os.makedirs(OUT, exist_ok=True)
x = subprocess.Popen(["Xvfb", DISP, "-screen", "0", "1920x1080x24", "-nolisten", "tcp", "-dpi", "96"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
time.sleep(1.5)
env = dict(os.environ, DESKTOP_CHROME_PROFILE=PROFILE, CHROME_DOWNLOADS="/tmp/bd-dl", DESKTOP_DISPLAY=DISP, DESKTOP_XAUTHORITY="", CHROME_CDP_PORT=str(PORT),
           CHROME_KEEPER_LOG=f"/tmp/bd-keeper-{LABEL}.log", CHROME_KEEPER_LOCK=f"/tmp/bd-{LABEL}.lock", CHROME_LOG=f"/tmp/bd-chrome-{LABEL}.log", CHROME_KIOSK="1")
k = subprocess.Popen([sys.executable, os.environ.get("KEEPER", "/opt/tools/chrome-keeper")], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
for _ in range(120):
    try: urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=1); break
    except Exception: time.sleep(0.25)
time.sleep(3)
cli = f"{PW}/node_modules/@playwright/mcp/cli.js"
p = subprocess.Popen(["node", cli, "--cdp-endpoint", f"http://127.0.0.1:{PORT}", "--image-responses", "omit", "--output-dir", OUT],
                     stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1)
n = [0]
def rpc(method, params=None, timeout=90):
    n[0] += 1; mid = n[0]
    p.stdin.write(json.dumps({"jsonrpc": "2.0", "id": mid, "method": method, "params": params or {}}) + "\n"); p.stdin.flush()
    end = time.time() + timeout
    while time.time() < end:
        line = p.stdout.readline()
        if not line: break
        try: m = json.loads(line)
        except Exception: continue
        if m.get("id") == mid: return m
    return {"error": "timeout"}
rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "diag", "version": "1"}})
p.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n"); p.stdin.flush()
tools = rpc("tools/list").get("result", {}).get("tools", [])
json.dump(tools, open(f"{OUT}/{LABEL}_tools.json", "w"))
res = []
for i, u in enumerate(URLS):
    r = rpc("tools/call", {"name": "browser_navigate", "arguments": {"url": u}})
    time.sleep(8)
    ev = rpc("tools/call", {"name": "browser_evaluate", "arguments": {"function": "() => JSON.stringify({t: document.title, px: /Robot or human|Press & Hold/i.test(document.body.innerText), intl: /Select your Country/i.test(document.title), prices: (document.body.innerText.match(/\\$\\d{2,4}(\\.\\d{2})?/g)||[]).slice(0,4)})"}})
    txt = "".join(c.get("text", "") for c in ((ev.get("result") or {}).get("content") or []))
    rpc("tools/call", {"name": "browser_take_screenshot", "arguments": {"filename": f"{LABEL}_{i}.png"}})
    res.append({"label": LABEL, "url": u[:80], "eval": txt[-400:]})
for r in res: print(json.dumps(r))
print(json.dumps({"label": LABEL, "ntools": len(tools), "tools": sorted(t["name"] for t in tools)}))
p.terminate(); os.killpg(k.pid, 15) if k else None
subprocess.run(["pkill", "-f", f"user-data-dir={PROFILE}"]); time.sleep(1); x.terminate()
