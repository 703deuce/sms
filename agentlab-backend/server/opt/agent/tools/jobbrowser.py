"""jobbrowser: find (and lazily start) the browser that belongs to THIS job.

Every run and helper started by the run daemon gets its own Chromium (own profile copied from the shared
profile, own CDP port, own 1920x1080 display, own tabs), started on first use by the job-browser daemon
(127.0.0.1:6073, see /opt/tools/job-browser). Conversations that are not runs keep the shared desktop
browser on 127.0.0.1:9222. Every tool that drives "the browser" (browser-shot, browser-upload,
fill-login, captcha-solve, desktop-open, click/type/key/..., vision-act, handoff) asks here which one.

Also a tiny synchronous CDP client and the input backend the desktop commands use for a job browser.
"""
import base64, json, os, re, socket, time, urllib.parse, urllib.request

DAEMON = os.environ.get("JOB_BROWSER_URL", "http://127.0.0.1:6073")
SHARED_PORT = 9222
SHARED = {"mode": "shared", "port": SHARED_PORT, "cdp": f"http://127.0.0.1:{SHARED_PORT}", "display": "127.0.0.1:99"}
UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"


def job_id(path=None):
    """Conversation id of the innermost job folder (helpers nest: jobs/<a>/helpers/<b>)."""
    for cand in (path, os.environ.get("AGENT_JOB_DIR"), os.environ.get("AGENT_SANDBOX"), os.getcwd()):
        if not cand:
            continue
        try:
            p = os.path.realpath(cand)
        except Exception:
            continue
        if "/jobs/" not in p:
            continue
        ids = re.findall(UUID, p.split("/jobs/", 1)[1])
        if ids:
            return ids[-1]
    return None


def _call(path, body=None, timeout=10):
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(DAEMON + path, data=data, method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or "{}")


def ensure(start=True, job=None, timeout=150):
    """{'mode': 'job'|'shared', 'cdp': url, 'port': n, 'display': ':10N', ...}. Never raises."""
    jid = job or job_id()
    if not jid:
        return dict(SHARED, reason="not inside a job folder")
    try:
        return _call("/ensure", {"job": jid, "start": bool(start)}, timeout=timeout)
    except Exception as e:
        return dict(SHARED, reason=f"job-browser daemon not reachable ({str(e)[:80]})")


def cdp_url(start=True, job=None):
    return ensure(start, job).get("cdp") or SHARED["cdp"]


def is_own(job=None):
    """True when this job uses its own browser (so Rick using the shared Live screen does not block it)."""
    return ensure(False, job).get("mode") == "job"


# ---------------- minimal CDP over websocket ----------------
class CDP:
    def __init__(self, ws_url, timeout=10):
        u = urllib.parse.urlparse(ws_url)
        self.sock = socket.create_connection((u.hostname, u.port or 80), timeout=timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        path = u.path + (("?" + u.query) if u.query else "")
        self.sock.sendall((f"GET {path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\n"
                           f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            c = self.sock.recv(4096)
            if not c:
                raise ConnectionError("cdp handshake closed")
            buf += c
        if b" 101 " not in buf.split(b"\r\n", 1)[0]:
            raise ConnectionError("cdp handshake failed")
        self.n = 0

    def _send(self, payload):
        mask = os.urandom(4)
        n = len(payload)
        hdr = bytearray([0x81])
        if n < 126:
            hdr.append(0x80 | n)
        elif n < 65536:
            hdr.append(0x80 | 126); hdr += n.to_bytes(2, "big")
        else:
            hdr.append(0x80 | 127); hdr += n.to_bytes(8, "big")
        hdr += mask
        self.sock.sendall(bytes(hdr) + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

    def _exact(self, n):
        buf = b""
        while len(buf) < n:
            c = self.sock.recv(n - len(buf))
            if not c:
                raise ConnectionError("cdp closed")
            buf += c
        return buf

    def _recv(self):
        data = b""
        while True:
            b1, b2 = self._exact(2)
            op, n = b1 & 0x0F, b2 & 0x7F
            if n == 126:
                n = int.from_bytes(self._exact(2), "big")
            elif n == 127:
                n = int.from_bytes(self._exact(8), "big")
            mask = self._exact(4) if b2 & 0x80 else b""
            chunk = self._exact(n)
            if mask:
                chunk = bytes(b ^ mask[i % 4] for i, b in enumerate(chunk))
            if op == 0x8:
                raise ConnectionError("cdp closed")
            if op == 0x9:
                continue
            data += chunk
            if b1 & 0x80:
                return data

    def call(self, method, params=None, timeout=30):
        self.n += 1
        mid = self.n
        self._send(json.dumps({"id": mid, "method": method, "params": params or {}}).encode())
        deadline = time.time() + timeout
        while time.time() < deadline:
            self.sock.settimeout(max(0.2, deadline - time.time()))
            ev = json.loads(self._recv())
            if ev.get("id") == mid:
                if "error" in ev:
                    raise RuntimeError(f"{method}: {ev['error'].get('message')}")
                return ev.get("result") or {}
        raise TimeoutError(method)

    def close(self):
        try:
            self.sock.close()
        except Exception:
            pass


def http_json(port, path, method="GET", timeout=5):
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    try:
        return json.loads(raw or b"null")
    except ValueError:
        return raw


def browser_cdp(port):
    return CDP(http_json(port, "/json/version")["webSocketDebuggerUrl"])


def pages(port):
    return [t for t in (http_json(port, "/json/list") or []) if t.get("type") == "page"
            and not str(t.get("url", "")).startswith("devtools://")]


def active_page(port):
    """The tab on screen (kiosk: exactly one is visible); else the most recently used one."""
    ps = pages(port)
    if not ps:
        t = http_json(port, "/json/new?about:blank", method="PUT")
        ps = [t]
    for t in ps:
        try:
            c = CDP(t["webSocketDebuggerUrl"], timeout=5)
            try:
                v = c.call("Runtime.evaluate", {"expression": "document.visibilityState", "returnByValue": True}, 5)
            finally:
                c.close()
            if (v.get("result") or {}).get("value") == "visible":
                return t
        except Exception:
            continue
    return ps[0]


def cookies(port):
    c = browser_cdp(port)
    try:
        return c.call("Storage.getCookies", {}, 30).get("cookies") or []
    finally:
        c.close()


COOKIE_KEYS = ("name", "value", "domain", "path", "secure", "httpOnly", "sameSite", "priority",
               "sourceScheme", "sourcePort", "partitionKey")


def set_cookies(port, cks):
    out = []
    for k in cks:
        p = {key: k[key] for key in COOKIE_KEYS if key in k and k[key] is not None}
        if not k.get("session") and (k.get("expires") or -1) > 0:
            p["expires"] = k["expires"]
        if isinstance(p.get("partitionKey"), str):  # older shape; drop rather than fail the whole batch
            p.pop("partitionKey")
        out.append(p)
    c = browser_cdp(port)
    try:
        for i in range(0, len(out), 200):
            try:
                c.call("Storage.setCookies", {"cookies": out[i:i + 200]}, 30)
            except RuntimeError:
                for p in out[i:i + 200]:  # one bad cookie must not drop the rest
                    try:
                        c.call("Storage.setCookies", {"cookies": [p]}, 10)
                    except RuntimeError:
                        pass
    finally:
        c.close()
    return len(out)


# ---------------- desktop input backend for a job browser (same API shape as the host desktop service) ----------------
MOD_BITS = {"alt": 1, "ctrl": 2, "control": 2, "meta": 4, "super": 4, "cmd": 4, "win": 4, "shift": 8}
SPECIAL = {  # xdotool keysym -> (key, code, keyCode)
    "return": ("Enter", "Enter", 13), "enter": ("Enter", "Enter", 13), "kp_enter": ("Enter", "NumpadEnter", 13),
    "tab": ("Tab", "Tab", 9), "escape": ("Escape", "Escape", 27), "esc": ("Escape", "Escape", 27),
    "backspace": ("Backspace", "Backspace", 8), "delete": ("Delete", "Delete", 46), "insert": ("Insert", "Insert", 45),
    "space": (" ", "Space", 32), "up": ("ArrowUp", "ArrowUp", 38), "down": ("ArrowDown", "ArrowDown", 40),
    "left": ("ArrowLeft", "ArrowLeft", 37), "right": ("ArrowRight", "ArrowRight", 39), "home": ("Home", "Home", 36),
    "end": ("End", "End", 35), "page_up": ("PageUp", "PageUp", 33), "prior": ("PageUp", "PageUp", 33),
    "page_down": ("PageDown", "PageDown", 34), "next": ("PageDown", "PageDown", 34),
    "plus": ("+", "Equal", 187), "minus": ("-", "Minus", 189), "equal": ("=", "Equal", 187),
}
for _i in range(1, 13):
    SPECIAL[f"f{_i}"] = (f"F{_i}", f"F{_i}", 111 + _i)
EDIT_COMMANDS = {"a": "selectAll", "c": "copy", "x": "cut", "v": "paste", "z": "undo", "y": "redo"}


def _keydef(name):
    low = name.lower()
    if low in SPECIAL:
        return SPECIAL[low]
    if len(name) == 1:
        ch = name
        if ch.isalpha():
            return (ch, f"Key{ch.upper()}", ord(ch.upper()))
        if ch.isdigit():
            return (ch, f"Digit{ch}", ord(ch))
        return (ch, "", ord(ch))
    raise ValueError(f"unknown key {name!r}")


class Desk:
    """Pixel-level input on this job's own browser through CDP (viewport == 1920x1080 screen in kiosk mode)."""

    def __init__(self, info):
        self.info = info
        self.port = info["port"]

    def _page(self):
        t = active_page(self.port)
        return t, CDP(t["webSocketDebuggerUrl"])

    def _mouse(self, c, typ, x, y, button="none", buttons=0, clicks=0, mods=0, **kw):
        p = {"type": typ, "x": x, "y": y, "modifiers": mods, "button": button, "buttons": buttons, "clickCount": clicks}
        p.update(kw)
        c.call("Input.dispatchMouseEvent", p)

    def handle(self, method, path, body):
        body = body or {}
        if path in ("/status", "/handoff") and method == "GET":
            return {"status": "idle", "rick_busy": False, "job_browser": True, "display": self.info.get("display"),
                    "cdp": self.info.get("cdp")}
        if path == "/shot":
            return self.shot()
        t, c = self._page()
        try:
            c.call("Page.bringToFront", {})
            mods = 0
            for m in body.get("mods") or []:
                mods |= MOD_BITS.get(str(m).lower(), 0)
            if path in ("/click", "/move"):
                x, y = int(body["x"]), int(body["y"])
                self._mouse(c, "mouseMoved", x, y, mods=mods)
                if path == "/move":
                    return {"ok": True}
                btn = {1: "left", 2: "middle", 3: "right"}.get(int(body.get("button") or 1), "left")
                bits = {"left": 1, "right": 2, "middle": 4}[btn]
                n = int(body.get("repeat") or (2 if body.get("double") else 1))  # same as xdotool click --repeat
                for k in range(1, n + 1):
                    self._mouse(c, "mousePressed", x, y, btn, bits, min(k, 3), mods)
                    self._mouse(c, "mouseReleased", x, y, btn, 0, min(k, 3), mods)
                return {"ok": True}
            if path == "/type":
                text = str(body.get("text") or "")
                if text:
                    c.call("Input.insertText", {"text": text})
                if body.get("enter"):
                    self._key(c, "Return", 0)
                return {"ok": True}
            if path == "/key":
                return self._combo(c, t, str(body.get("key") or body.get("combo") or ""), int(body.get("hold_ms") or 0))
            if path == "/drag":
                x1, y1, x2, y2 = (int(body[k]) for k in ("x1", "y1", "x2", "y2"))
                steps = max(1, int(body.get("steps") or 20))
                self._mouse(c, "mouseMoved", x1, y1, mods=mods)
                self._mouse(c, "mousePressed", x1, y1, "left", 1, 1, mods)
                time.sleep(int(body.get("hold_ms") or 150) / 1000)
                for i in range(1, steps + 1):
                    self._mouse(c, "mouseMoved", round(x1 + (x2 - x1) * i / steps), round(y1 + (y2 - y1) * i / steps),
                                "left", 1, 0, mods)
                    time.sleep(0.01)
                self._mouse(c, "mouseReleased", x2, y2, "left", 0, 1, mods)
                return {"ok": True}
            if path == "/scroll":
                x = int(body.get("x") if body.get("x") is not None else 960)
                y = int(body.get("y") if body.get("y") is not None else 540)
                self._mouse(c, "mouseWheel", x, y, mods=mods, deltaX=int(body.get("dx") or 0) * 120,
                            deltaY=int(body.get("dy") or 0) * 120)
                return {"ok": True}
            if path == "/zoom":
                mode, times = body.get("mode"), int(body.get("times") or 1)
                if body.get("wheel"):
                    x = int(body.get("x") or 960); y = int(body.get("y") or 540)
                    for _ in range(times):
                        self._mouse(c, "mouseWheel", x, y, mods=2, deltaX=0, deltaY=-120 if mode == "in" else 120)
                    return {"ok": True}
                js = ("(function(m,n){var d=document.documentElement;var z=parseFloat(d.style.zoom||'1');"
                      "if(m==='reset')z=1;else for(var i=0;i<n;i++)z=m==='in'?z*1.1:z/1.1;d.style.zoom=z;return z})")
                c.call("Runtime.evaluate", {"expression": f"{js}({json.dumps(mode)},{times})", "returnByValue": True})
                return {"ok": True}
            return {"ok": False, "error": f"{path} is not available on a job browser"}
        finally:
            c.close()

    def _key(self, c, name, mods, hold_ms=0, commands=None):
        key, code, kc = _keydef(name)
        printable = len(key) == 1 and not (mods & (1 | 2 | 4))
        down = {"type": "keyDown" if printable else "rawKeyDown", "key": key, "code": code,
                "windowsVirtualKeyCode": kc, "nativeVirtualKeyCode": kc, "modifiers": mods}
        if key == "Enter":
            down.update(type="keyDown", text="\r")
        elif printable:
            down["text"] = key.upper() if (mods & 8 and key.isalpha()) else key
        if commands:
            down["commands"] = commands
        c.call("Input.dispatchKeyEvent", down)
        if hold_ms:
            time.sleep(hold_ms / 1000)
        c.call("Input.dispatchKeyEvent", {"type": "keyUp", "key": key, "code": code, "windowsVirtualKeyCode": kc,
                                          "nativeVirtualKeyCode": kc, "modifiers": mods})

    def _combo(self, c, t, combo, hold_ms):
        parts = [p for p in combo.replace(" ", "").split("+") if p] or [combo]
        mods, key = 0, parts[-1]
        for p in parts[:-1]:
            mods |= MOD_BITS.get(p.lower(), 0)
        low = key.lower()
        # Browser-window shortcuts have no window chrome to act on in kiosk mode; do the same thing via CDP.
        if mods & 2 and low in ("r",) or (not mods and low == "f5"):
            c.call("Page.reload", {}); return {"ok": True}
        if mods & 1 and low in ("left", "right"):
            c.call("Runtime.evaluate", {"expression": "history.back()" if low == "left" else "history.forward()"})
            return {"ok": True}
        if mods & 2 and low == "t":
            http_json(self.port, "/json/new?about:blank", method="PUT"); return {"ok": True}
        if mods & 2 and low == "w":
            http_json(self.port, f"/json/close/{t['id']}"); return {"ok": True}
        if mods & 2 and low in ("l", "k"):
            return {"ok": False, "error": "a job browser has no address bar (kiosk); use desktop-open URL or browser_navigate"}
        if mods & 2 and low in ("plus", "equal", "minus", "0"):
            return self.handle("POST", "/zoom", {"mode": "reset" if low == "0" else "out" if low == "minus" else "in"})
        commands = None
        if mods & 2 and low in EDIT_COMMANDS and not mods & 1:
            commands = ["redo" if (low == "z" and mods & 8) else EDIT_COMMANDS[low]]
        self._key(c, key, mods, hold_ms, commands)
        return {"ok": True}

    def shot(self):
        t = active_page(self.port)
        c = CDP(t["webSocketDebuggerUrl"])
        try:
            r = c.call("Page.captureScreenshot", {"format": "png"}, 30)
        finally:
            c.close()
        return base64.b64decode(r["data"])
