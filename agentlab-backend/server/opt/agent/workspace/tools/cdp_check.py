#!/usr/bin/env python3
"""Tool-level check of the shared persistent browser over CDP (no LLM).
usage: cdp_check.py set NAME VALUE | get | text URL"""
import asyncio, json, sys, urllib.request
import websockets
CDP = "http://127.0.0.1:9222"

def j(path, method="GET"):
    with urllib.request.urlopen(urllib.request.Request(CDP + path, method=method), timeout=10) as r:
        raw = r.read()
        try: return json.loads(raw)
        except ValueError: return raw.decode()

async def page_text(url):
    t = j("/json/new?about:blank", "PUT")
    async with websockets.connect(t["webSocketDebuggerUrl"], max_size=None) as ws:
        n = 0
        async def call(m, p=None):
            nonlocal n; n += 1; i = n
            await ws.send(json.dumps({"id": i, "method": m, "params": p or {}}))
            while True:
                r = json.loads(await ws.recv())
                if r.get("id") == i: return r.get("result")
        await call("Page.enable"); await call("Page.navigate", {"url": url})
        await asyncio.sleep(4)
        r = await call("Runtime.evaluate", {"expression": "document.body.innerText", "returnByValue": True})
    j(f"/json/close/{t['id']}")
    return r["result"]["value"]

a = sys.argv[1:]
if a[0] == "set":
    print(asyncio.run(page_text(f"https://httpbin.org/cookies/set?{a[1]}={a[2]}")))
elif a[0] == "get":
    print(asyncio.run(page_text("https://httpbin.org/cookies")))
