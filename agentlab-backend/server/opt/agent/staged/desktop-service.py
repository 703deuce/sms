#!/usr/bin/env python3
"""Agent Lab desktop control plane and PIN-gated live view.

- Control API on 127.0.0.1:6070 (click/type/key/shot/handoff) — localhost only.
- Live view on 0.0.0.0:6080 — requires a short-lived PIN or DESKTOP_VIEW_TOKEN.
  Raw VNC (5900) and X11 (6099) stay on localhost.
Never logs env values, cookies, PINs, or tokens.
"""
from __future__ import annotations

import base64, hashlib, hmac, http.cookies, http.server, json, os, secrets, socket, sys
import socketserver, struct, subprocess, threading, time, urllib.parse
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
DISPLAY = os.environ.get("DISPLAY", ":99")
AUTH = os.environ.get("XAUTHORITY", "/opt/agent/desktop/Xauthority")
HOST_ROOT = Path("/opt/agent/desktop")
WS_ROOT = Path("/opt/agent/workspace/desktop")
if Path("/workspace/desktop").is_dir() or Path("/workspace").is_dir():
    # Prefer the in-container mount when present; on the host this is usually absent
    # and we use /opt/agent/workspace/desktop instead.
    if os.path.ismount("/workspace") or Path("/workspace/tools").exists():
        WS_ROOT = Path("/workspace/desktop")
CONTROL_HOST, CONTROL_PORT = "127.0.0.1", 6070
VIEW_HOST, VIEW_PORT = "0.0.0.0", 6080
VNC_ADDR = ("127.0.0.1", 5900)
NOVNC = Path("/usr/share/novnc")
ENV_PATH = Path(os.environ.get("AGENT_LAB_ENV", "/opt/agent/.env"))
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

state_lock = threading.Lock()
handoff = {
    "status": "idle",  # idle | waiting | done
    "message": "",
    "pin": None,
    "pin_hash": None,
    "created_at": None,
    "expires_at": None,
    "kind": None,  # handoff | view
}
fail_counts = {}  # ip -> (count, first_ts)
view_sessions = {}  # session token -> expiry ts


def now():
    return datetime.now(ET)


def iso(dt):
    return dt.isoformat(timespec="seconds") if dt else None


def log(msg):
    # Never include pins, tokens, or query strings.
    print(f"desktop-service: {msg}", flush=True)


def load_env_named(names):
    found = {}
    try:
        text = ENV_PATH.read_text()
    except FileNotFoundError:
        return found
    wanted = set(names)
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k in wanted:
            found[k] = v.strip().strip("'").strip('"')
    return found


def public_url():
    ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("1.1.1.1", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass
    return f"http://{ip}:{VIEW_PORT}"


def xenv():
    env = os.environ.copy()
    env["DISPLAY"] = DISPLAY
    env["XAUTHORITY"] = AUTH
    return env


def xrun(args, timeout=30, input=None):
    return subprocess.run(args, env=xenv(), timeout=timeout, input=input,
                          capture_output=True, text=False)


def workspace_ready():
    WS_ROOT.mkdir(parents=True, exist_ok=True)
    try:
        os.chown(WS_ROOT, 10001, 10001)
        os.chmod(WS_ROOT, 0o775)
    except OSError:
        pass
    return WS_ROOT


def write_json(path: Path, obj):
    workspace_ready()
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2) + "\n")
    tmp.replace(path)
    try:
        os.chown(path, 10001, 10001)
        os.chmod(path, 0o664)
    except OSError:
        pass


def publish_handoff():
    with state_lock:
        rec = {
            "status": handoff["status"],
            "message": handoff["message"],
            "pin": handoff["pin"] if handoff["status"] == "waiting" else None,
            "created_at": handoff["created_at"],
            "expires_at": handoff["expires_at"],
            "kind": handoff["kind"],
            "view_url": public_url(),
        }
    write_json(workspace_ready() / "handoff.json", rec)
    return rec


def pin_valid(pin):
    if not pin:
        return False
    standing = load_env_named(["DESKTOP_VIEW_TOKEN"]).get("DESKTOP_VIEW_TOKEN")
    if standing and hmac.compare_digest(str(pin), standing):
        return True
    with state_lock:
        expected = handoff.get("pin")
        expires = handoff.get("expires_at")
        status = handoff.get("status")
    if not expected:
        return False
    if expires:
        try:
            if now() > datetime.fromisoformat(expires):
                return False
        except Exception:
            return False
    # A standing view PIN remains valid until expiry even after handoff is done.
    return hmac.compare_digest(str(pin), str(expected))


def too_many_failures(ip):
    t = time.time()
    count, first = fail_counts.get(ip, (0, t))
    if t - first > 600:
        fail_counts[ip] = (0, t)
        count = 0
    return count >= 8


def record_failure(ip):
    t = time.time()
    count, first = fail_counts.get(ip, (0, t))
    if t - first > 600:
        count, first = 0, t
    fail_counts[ip] = (count + 1, first)


def new_session():
    tok = secrets.token_urlsafe(24)
    view_sessions[tok] = time.time() + 3600 * 12
    return tok


def session_ok(tok):
    exp = view_sessions.get(tok)
    if not exp:
        return False
    if time.time() > exp:
        view_sessions.pop(tok, None)
        return False
    return True


def start_handoff(message, timeout_sec, kind="handoff"):
    pin = f"{secrets.randbelow(1_000_000):06d}"
    created = now()
    expires = created + timedelta(seconds=max(60, int(timeout_sec)))
    with state_lock:
        handoff.update({
            "status": "waiting",
            "message": message or "Rick, please use the live desktop and click I'm done when finished.",
            "pin": pin,
            "created_at": iso(created),
            "expires_at": iso(expires),
            "kind": kind,
        })
    rec = publish_handoff()
    rec["pin"] = pin
    rec["view_url"] = public_url()
    return rec


def finish_handoff():
    with state_lock:
        handoff["status"] = "done"
        # Keep the pin valid until expiry so a standing view doesn't drop.
        if handoff.get("kind") == "handoff":
            pass
    return publish_handoff()


def capture_jpeg(dest: Path, quality=70, width=1280):
    workspace_ready()
    tmp = dest.with_suffix(".tmp.jpg")
    # scrot writes png; convert via PIL if present, else scrot jpeg.
    raw = dest.with_suffix(".tmp.png")
    r = xrun(["scrot", "-z", "-o", str(raw)], timeout=15)
    if r.returncode != 0 or not raw.exists():
        r = xrun(["import", "-window", "root", str(raw)], timeout=15)
    if not raw.exists():
        return False
    try:
        from PIL import Image
        im = Image.open(raw)
        if width and im.width > width:
            h = int(im.height * (width / im.width))
            im = im.resize((width, h))
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        im.save(dest, "JPEG", quality=quality, optimize=True)
    except Exception:
        raw.replace(dest)
    try:
        raw.unlink(missing_ok=True)
        tmp.unlink(missing_ok=True)
    except OSError:
        pass
    try:
        os.chown(dest, 10001, 10001)
        os.chmod(dest, 0o664)
    except OSError:
        pass
    return dest.exists()


def capture_png_bytes():
    workspace_ready()
    path = workspace_ready() / "shot-tmp.png"
    r = xrun(["scrot", "-z", "-o", str(path)], timeout=15)
    if r.returncode != 0 or not path.exists():
        r = xrun(["import", "-window", "root", str(path)], timeout=15)
    if not path.exists():
        return None
    data = path.read_bytes()
    try:
        path.unlink()
    except OSError:
        pass
    return data


def live_loop():
    dest = workspace_ready() / "live.jpg"
    while True:
        try:
            capture_jpeg(dest)
        except Exception as e:
            log(f"live capture failed: {type(e).__name__}")
        time.sleep(1.0)


# ---- input helpers ---------------------------------------------------------

def do_move(x, y):
    return xrun(["xdotool", "mousemove", "--", str(int(x)), str(int(y))])


def do_click(x, y, button=1, double=False):
    if x is not None and y is not None:
        do_move(x, y)
    clicks = "2" if double else "1"
    return xrun(["xdotool", "click", "--repeat", clicks, "--", str(int(button))])


def do_type(text, enter=False):
    # Keep the text off our logs.
    r = xrun(["xdotool", "type", "--clearmodifiers", "--delay", "8", "--", text])
    if enter:
        xrun(["xdotool", "key", "--clearmodifiers", "Return"])
    return r


def do_key(combo):
    return xrun(["xdotool", "key", "--clearmodifiers", "--", combo])


# ---- HTTP helpers ----------------------------------------------------------

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def send_json(handler, code, obj):
    body = json.dumps(obj).encode()
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def read_json(handler):
    n = int(handler.headers.get("Content-Length") or 0)
    if n <= 0:
        return {}
    raw = handler.rfile.read(n)
    try:
        return json.loads(raw.decode() or "{}")
    except Exception:
        return {}


# ---- control API (localhost) ----------------------------------------------

class ControlHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Path only, no query, no bodies.
        log(f"control {self.command} {self.path.split('?', 1)[0]} {fmt[0] if False else ''}".strip())

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/status" or path == "/handoff":
            rec = publish_handoff()
            rec["display"] = DISPLAY
            rec["x_up"] = xrun(["xset", "q"], timeout=5).returncode == 0
            rec["vnc_up"] = _port_open(*VNC_ADDR)
            send_json(self, 200, rec)
            return
        if path == "/shot":
            data = capture_png_bytes()
            if not data:
                send_json(self, 503, {"error": "screenshot failed"})
                return
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
            return
        self.send_error(404)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        body = read_json(self)
        if path == "/click":
            r = do_click(body.get("x"), body.get("y"), body.get("button") or 1, bool(body.get("double")))
            send_json(self, 200 if r.returncode == 0 else 500, {"ok": r.returncode == 0})
            return
        if path == "/move":
            r = do_move(body.get("x"), body.get("y"))
            send_json(self, 200 if r.returncode == 0 else 500, {"ok": r.returncode == 0})
            return
        if path == "/type":
            r = do_type(str(body.get("text") or ""), enter=bool(body.get("enter")))
            send_json(self, 200 if r.returncode == 0 else 500, {"ok": r.returncode == 0})
            return
        if path == "/key":
            r = do_key(str(body.get("key") or ""))
            send_json(self, 200 if r.returncode == 0 else 500, {"ok": r.returncode == 0})
            return
        if path == "/handoff":
            rec = start_handoff(body.get("message") or "", body.get("timeout") or 1800,
                                kind=body.get("kind") or "handoff")
            send_json(self, 200, rec)
            return
        if path == "/handoff/done":
            send_json(self, 200, finish_handoff())
            return
        if path == "/browser/reset":
            send_json(self, 200, reset_browser())
            return
        self.send_error(404)


CHROME_PROFILE_DIRS = ("/workspace/desktop/chrome-profile", "/opt/agent/workspace/desktop/chrome-profile")


def reset_browser():
    """Close the desktop Chromium (whatever job sandbox started it) and clean its profile; cookies stay."""
    import signal
    sys.path.insert(0, "/opt/agent/tools")
    pids = []
    for pid in os.listdir("/proc"):
        if not pid.isdigit():
            continue
        try:
            cmd = open(f"/proc/{pid}/cmdline", "rb").read().replace(b"\0", b" ").decode(errors="replace")
        except OSError:
            continue
        if "chrom" in cmd and any(f"--user-data-dir={d}" in cmd for d in CHROME_PROFILE_DIRS):
            pids.append(int(pid))
    for sig in (signal.SIGTERM, signal.SIGKILL):
        for p in pids:
            try:
                os.kill(p, sig)
            except ProcessLookupError:
                pass
        deadline = time.time() + 5
        while time.time() < deadline and any(os.path.exists(f"/proc/{p}") for p in pids):
            time.sleep(0.2)
    try:
        import chromeclean
        prof = "/opt/agent/workspace/desktop/chrome-profile"
        chromeclean.clean_profile(prof)
        for root, dirs, files in os.walk(prof):
            for n in dirs + files:
                try:
                    os.lchown(os.path.join(root, n), 10001, 10001)
                except OSError:
                    pass
        os.lchown(prof, 10001, 10001)
    except Exception as e:
        log(f"browser reset: profile clean failed: {e}")
    log(f"browser reset: closed {len(pids)} processes")
    return {"ok": True, "closed": len(pids)}


def _port_open(host, port):
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


# ---- viewer (PIN gated) ---------------------------------------------------

LOGIN_HTML = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Lab desktop</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#1b1e23;color:#eee;display:flex;min-height:100vh;align-items:center;justify-content:center}
  form{background:#252830;padding:24px 28px;border-radius:12px;width:min(360px,92vw);box-shadow:0 8px 32px #0008}
  h1{font-size:1.15rem;margin:0 0 8px}
  p{color:#b7bcc6;font-size:.9rem;margin:0 0 16px}
  input{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #444;background:#111;color:#fff;font-size:1.1rem;letter-spacing:.2em;text-align:center;box-sizing:border-box}
  button{margin-top:12px;width:100%;padding:10px;border:0;border-radius:8px;background:#4f8cff;color:#fff;font-weight:600;cursor:pointer}
  .err{color:#ff8a8a;min-height:1.2em;margin:8px 0 0;font-size:.85rem}
</style></head>
<body>
<form method="post" action="/login" autocomplete="off">
  <h1>Agent Lab desktop</h1>
  <p>Enter the PIN from the agent to watch the live screen or finish a sign-in.</p>
  <input name="pin" inputmode="numeric" pattern="[0-9A-Za-z._-]{4,}" placeholder="PIN" autofocus>
  <button type="submit">Open desktop</button>
  <div class="err">%ERR%</div>
</form>
</body></html>
"""

DESKTOP_HTML = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Lab desktop</title>
<style>
  html,body{margin:0;height:100%;background:#000;color:#eee;font-family:system-ui,sans-serif}
  #bar{display:none;background:#c9a227;color:#111;padding:10px 16px;font-weight:600;align-items:center;gap:12px;justify-content:space-between}
  #bar.active{display:flex}
  #bar button{border:0;background:#111;color:#fff;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:700}
  #wrap{height:100%;display:flex;flex-direction:column}
  iframe,img#stream{flex:1;width:100%;border:0;background:#000}
  #tools{position:absolute;right:12px;bottom:12px;display:flex;gap:8px}
  #tools a{color:#fff;background:#252830;padding:6px 10px;border-radius:8px;text-decoration:none;font-size:.8rem}
</style></head>
<body>
<div id="wrap">
  <div id="bar"><span id="msg">Waiting for you to finish</span><button id="done">I'm done</button></div>
  <iframe id="vnc" src="/novnc/vnc.html?autoconnect=1&resize=scale&path=websockify&reconnect=1" allow="clipboard-read; clipboard-write"></iframe>
</div>
<script>
async function refresh(){
  try{
    const r = await fetch('/api/handoff', {credentials:'same-origin'});
    const d = await r.json();
    const bar = document.getElementById('bar');
    const msg = document.getElementById('msg');
    if(d.status === 'waiting' && d.kind === 'handoff'){
      bar.classList.add('active');
      msg.textContent = d.message || "Please sign in on this desktop, then click I'm done.";
    }else{
      bar.classList.remove('active');
    }
  }catch(e){}
}
document.getElementById('done').onclick = async () => {
  await fetch('/api/handoff/done', {method:'POST', credentials:'same-origin'});
  refresh();
};
refresh();
setInterval(refresh, 2000);
</script>
</body></html>
"""


def cookie_value(handler, name):
    raw = handler.headers.get("Cookie") or ""
    try:
        c = http.cookies.SimpleCookie()
        c.load(raw)
        if name in c:
            return c[name].value
    except Exception:
        return None
    return None


def view_authorized(handler):
    tok = cookie_value(handler, "desktop_session")
    if tok and session_ok(tok):
        return True
    # One-shot pin in header only (never recommend putting it in a logged query).
    pin = handler.headers.get("X-Desktop-Pin")
    if pin and pin_valid(pin):
        return True
    return False


class ViewHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        path = self.path.split("?", 1)[0]
        log(f"view {self.command} {path}")

    def _session_cookie(self, tok):
        return f"desktop_session={tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200"

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/health":
            send_json(self, 200, {"ok": True})
            return
        if path == "/login":
            self._html(200, LOGIN_HTML.replace("%ERR%", ""))
            return
        if path in ("/websockify", "/websockify/"):
            if not view_authorized(self):
                self.send_error(401)
                return
            self._websockify()
            return
        if path.startswith("/novnc/"):
            if not view_authorized(self):
                self.send_error(401)
                return
            self._static_novnc(path[len("/novnc/"):])
            return
        if not view_authorized(self):
            self._html(200, LOGIN_HTML.replace("%ERR%", ""))
            return
        if path in ("/", "/desktop"):
            self._html(200, DESKTOP_HTML)
            return
        if path == "/api/handoff":
            rec = publish_handoff()
            rec.pop("pin", None)  # don't send the pin to an already-open viewer log
            send_json(self, 200, rec)
            return
        if path in ("/live.jpg", "/stream.jpg"):
            p = workspace_ready() / "live.jpg"
            if not p.exists():
                self.send_error(503)
                return
            data = p.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
            return
        self.send_error(404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/handoff/done":
            if not view_authorized(self):
                self.send_error(401)
                return
            send_json(self, 200, finish_handoff())
            return
        if path == "/login":
            ip = self.client_address[0]
            if too_many_failures(ip):
                self._html(429, LOGIN_HTML.replace("%ERR%", "Too many attempts. Try again later."))
                return
            body = self.rfile.read(int(self.headers.get("Content-Length") or 0)).decode("utf-8", "replace")
            pin = urllib.parse.parse_qs(body).get("pin", [""])[0].strip()
            if pin_valid(pin):
                tok = new_session()
                self.send_response(303)
                self.send_header("Set-Cookie", self._session_cookie(tok))
                self.send_header("Location", "/desktop")
                self.end_headers()
                return
            record_failure(ip)
            self._html(401, LOGIN_HTML.replace("%ERR%", "That PIN is not valid or has expired."))
            return
        self.send_error(404)

    def _html(self, code, html):
        body = html.encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _static_novnc(self, rel):
        rel = rel or "vnc.html"
        dest = (NOVNC / rel).resolve()
        if NOVNC not in dest.parents and dest != NOVNC:
            self.send_error(404)
            return
        if dest.is_dir():
            dest = dest / "vnc.html"
        if not dest.is_file():
            self.send_error(404)
            return
        data = dest.read_bytes()
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".svg": "image/svg+xml",
            ".woff": "font/woff",
            ".woff2": "font/woff2",
            ".map": "application/json",
        }.get(dest.suffix, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _websockify(self):
        if self.headers.get("Upgrade", "").lower() != "websocket":
            self.send_error(400)
            return
        key = self.headers.get("Sec-WebSocket-Key")
        if not key:
            self.send_error(400)
            return
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
        try:
            vnc = socket.create_connection(VNC_ADDR, timeout=5)
        except OSError:
            self.send_error(502)
            return
        self.send_response(101)
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        proto = self.headers.get("Sec-WebSocket-Protocol")
        if proto:
            self.send_header("Sec-WebSocket-Protocol", proto.split(",")[0].strip())
        self.end_headers()
        client = self.connection
        try:
            _ws_tunnel(client, vnc)
        finally:
            try:
                vnc.close()
            except OSError:
                pass


def _ws_tunnel(client, vnc):
    stop = threading.Event()

    def vnc_to_ws():
        try:
            while not stop.is_set():
                data = vnc.recv(8192)
                if not data:
                    break
                client.sendall(_ws_frame(data))
        except OSError:
            pass
        finally:
            stop.set()

    t = threading.Thread(target=vnc_to_ws, daemon=True)
    t.start()
    try:
        buf = b""
        while not stop.is_set():
            chunk = client.recv(8192)
            if not chunk:
                break
            buf += chunk
            while True:
                payload, buf, closed = _ws_unframe(buf)
                if closed:
                    stop.set()
                    return
                if payload is None:
                    break
                if payload:
                    vnc.sendall(payload)
    except OSError:
        pass
    finally:
        stop.set()


def _ws_frame(payload: bytes, opcode=0x2) -> bytes:
    header = bytearray()
    header.append(0x80 | opcode)
    n = len(payload)
    if n < 126:
        header.append(n)
    elif n < 65536:
        header.append(126)
        header += struct.pack("!H", n)
    else:
        header.append(127)
        header += struct.pack("!Q", n)
    return bytes(header) + payload


def _ws_unframe(buf: bytes):
    if len(buf) < 2:
        return None, buf, False
    b1, b2 = buf[0], buf[1]
    opcode = b1 & 0x0F
    masked = b2 & 0x80
    n = b2 & 0x7F
    i = 2
    if n == 126:
        if len(buf) < 4:
            return None, buf, False
        n = struct.unpack("!H", buf[2:4])[0]
        i = 4
    elif n == 127:
        if len(buf) < 10:
            return None, buf, False
        n = struct.unpack("!Q", buf[2:10])[0]
        i = 10
    if masked:
        if len(buf) < i + 4:
            return None, buf, False
        mask = buf[i:i + 4]
        i += 4
    else:
        mask = None
    if len(buf) < i + n:
        return None, buf, False
    payload = bytearray(buf[i:i + n])
    rest = buf[i + n:]
    if mask:
        for k in range(len(payload)):
            payload[k] ^= mask[k % 4]
    if opcode == 0x8:  # close
        return b"", rest, True
    if opcode == 0x9:  # ping — ignore here (payload already consumed)
        return b"", rest, False
    if opcode == 0xA:
        return b"", rest, False
    if opcode in (0x1, 0x2, 0x0):
        return bytes(payload), rest, False
    return b"", rest, False


def serve(server):
    server.serve_forever()


def main():
    workspace_ready()
    publish_handoff()
    threading.Thread(target=live_loop, name="live-jpg", daemon=True).start()
    control = ThreadingHTTPServer((CONTROL_HOST, CONTROL_PORT), ControlHandler)
    view = ThreadingHTTPServer((VIEW_HOST, VIEW_PORT), ViewHandler)
    threading.Thread(target=serve, args=(control,), name="control", daemon=True).start()
    log(f"control on {CONTROL_HOST}:{CONTROL_PORT}  view on {VIEW_HOST}:{VIEW_PORT}")
    try:
        view.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        control.shutdown()
        view.shutdown()


if __name__ == "__main__":
    main()
