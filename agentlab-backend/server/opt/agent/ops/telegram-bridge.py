#!/usr/bin/env python3
"""Telegram adapter (idle until a token exists). Long-polls a Telegram bot, turns allowed chats' messages into agent runs,
and sends each run's result back. Config: /opt/agent/secrets/telegram.env with
    TELEGRAM_BOT_TOKEN=...   TELEGRAM_ALLOWED_CHATS=123456789,987654321   (numeric chat ids; others are ignored)
Run as agent-lab-telegram.service (installed disabled). No app review needed: create the bot with @BotFather."""
import json, os, sys, time, urllib.parse, urllib.request
sys.path.insert(0, "/opt/agent/tools")
ENV = "/opt/agent/secrets/telegram.env"
STATE = "/opt/agent/workspace/runs/telegram-state.json"

def cfg():
    d = {}
    try:
        for l in open(ENV):
            if "=" in l and not l.startswith("#"): k, v = l.strip().split("=", 1); d[k] = v.strip().strip('"\'')
    except FileNotFoundError: pass
    return d

def api(tok, method, **kw):
    data = urllib.parse.urlencode(kw).encode()
    with urllib.request.urlopen(urllib.request.Request(f"https://api.telegram.org/bot{tok}/{method}", data), timeout=70) as r:
        return json.load(r)

def send(tok, chat, text):
    for i in range(0, max(1, len(text)), 3900):
        api(tok, "sendMessage", chat_id=chat, text=text[i:i+3900])

def main():
    c = cfg(); tok = c.get("TELEGRAM_BOT_TOKEN")
    if not tok:
        print("telegram-bridge: idle (no TELEGRAM_BOT_TOKEN in " + ENV + ")"); sys.exit(0)
    allowed = {x.strip() for x in c.get("TELEGRAM_ALLOWED_CHATS", "").split(",") if x.strip()}
    if not allowed: print("telegram-bridge: idle (set TELEGRAM_ALLOWED_CHATS)"); sys.exit(0)
    import runlib as R
    try: st = json.load(open(STATE))
    except Exception: st = {"offset": 0, "pending": {}}
    while True:
        try:
            for u in api(tok, "getUpdates", offset=st["offset"], timeout=25).get("result", []):
                st["offset"] = u["update_id"] + 1
                m = u.get("message") or {}; chat = str((m.get("chat") or {}).get("id", "")); text = m.get("text")
                if not text or chat not in allowed: continue
                db = R.connect()
                rid, cid = R.enqueue(db, f"[Telegram message from the user]\n{text}", "webhook", title="telegram", created_by=f"telegram:{chat}")
                st["pending"][rid] = chat
                send(tok, chat, "Working on it.")
            db = R.connect()
            for rid, chat in list(st["pending"].items()):
                r = db.execute("SELECT status, result, error, finished_at FROM runs WHERE id=?", (rid,)).fetchone()
                if r and r["finished_at"]:
                    send(tok, chat, (r["result"] or r["error"] or f"Run ended: {r['status']}")[:12000]); del st["pending"][rid]
            json.dump(st, open(STATE, "w"))
        except Exception as e:
            print("telegram-bridge error:", type(e).__name__, flush=True); time.sleep(10)
        time.sleep(1)

main()
