#!/usr/bin/env python3
"""vaultd: host service (127.0.0.1:6072) that types website logins into the browser WITHOUT the model seeing them.
Credentials live in the OpenHands vault as secrets named
    LOGIN_<HOST>_USER, LOGIN_<HOST>_PASS, LOGIN_<HOST>_TOTP      (HOST = site host, non-alphanumerics -> _, e.g. LOGIN_GITHUB_COM_PASS)
The values are read here (host), piped to a worker that fills the page, and never returned to the caller.
A site's credentials are only typed into a tab whose hostname matches the site (anti-phishing)."""
import base64, hashlib, hmac, json, os, re, struct, subprocess, sys, time, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

API = "http://127.0.0.1:8000"
def token():
    for l in open("/opt/agent/.env"):
        if l.startswith(("AGENT_LAB_TOKEN=", "OH_SESSION_API_KEYS_0=")): return l.split("=", 1)[1].strip().strip('"\'')
    sys.exit("vaultd: no agent-server token in /opt/agent/.env")
_T = []
def TOKEN():
    if not _T: _T.append(token())
    return _T[0]

def oh(path):
    r = urllib.request.Request(API + path, headers={"X-Session-API-Key": TOKEN()})
    with urllib.request.urlopen(r, timeout=10) as f: return f.read().decode()

def names():
    try:
        d = json.loads(oh("/api/settings/secrets"))
        items = d.get("secrets", d) if isinstance(d, dict) else d
        return sorted((i["name"] if isinstance(i, dict) else i) for i in items)
    except Exception: return []

def secret(name):
    v = oh("/api/settings/secrets/" + urllib.parse.quote(name))
    try:
        j = json.loads(v)
        if isinstance(j, dict): v = j.get("value", v)
    except Exception: pass
    return v.strip("\n")

def norm(h): return re.sub(r"[^A-Z0-9]+", "_", h.upper()).strip("_")

def sites():
    out = {}
    for n in names():
        m = re.fullmatch(r"LOGIN_(.+)_(USER|PASS|TOTP)", n)
        if m: out.setdefault(m.group(1), []).append(m.group(2))
    return out

def totp(seed, t=None, digits=6, step=30):
    if seed.startswith("otpauth://"):
        seed = urllib.parse.parse_qs(urllib.parse.urlparse(seed).query).get("secret", [""])[0]
    seed = re.sub(r"\s+", "", seed).upper(); seed += "=" * (-len(seed) % 8)
    c = struct.pack(">Q", int((t if t is not None else time.time()) // step))
    h = hmac.new(base64.b32decode(seed), c, hashlib.sha1).digest()
    o = h[-1] & 15
    return str((struct.unpack(">I", h[o:o+4])[0] & 0x7fffffff) % 10 ** digits).zfill(digits)

def worker(payload):
    p = subprocess.run(["docker", "exec", "-i", "agent-lab", "python3", "/opt/tools/fill-worker"],
                       input=json.dumps(payload), capture_output=True, text=True, timeout=60)
    try: return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception: return {"ok": False, "error": "worker failed: " + (p.stderr or "")[-200:].replace(payload.get("password", "\0"), "***")}

def resolve(host):
    key = norm(host); s = sites()
    for k in sorted(s, key=len, reverse=True):
        if key == k or key.endswith("_" + k) or k.endswith("_" + key): return k, s[k]
    return None, []

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code)
        self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path.startswith("/logins"):
            return self.send(200, {"sites": [{"site_key": k, "has": v} for k, v in sorted(sites().items())],
                                   "naming": "LOGIN_<HOST>_USER / _PASS / _TOTP in the Agent Lab secrets page"})
        self.send(404, {"error": "unknown"})
    def do_POST(self):
        try: req = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        except Exception: return self.send(400, {"error": "bad json"})
        host = str(req.get("site") or ""); key, have = resolve(host)
        if not key: return self.send(404, {"ok": False, "error": f"no stored login for {host!r}; known: {sorted(sites())}"})
        try:
            if self.path == "/fill":
                mode = req.get("part") or "login"
                pl = {"mode": mode, "site_key": key, "submit": bool(req.get("submit"))}
                if "USER" in have: pl["user"] = secret(f"LOGIN_{key}_USER")
                if "PASS" in have: pl["password"] = secret(f"LOGIN_{key}_PASS")
                if mode in ("login", "pass") and "password" not in pl: return self.send(404, {"ok": False, "error": "no password stored for this site"})
                r = worker(pl)
            elif self.path == "/totp":
                if "TOTP" not in have: return self.send(404, {"ok": False, "error": "no TOTP seed stored for this site"})
                r = worker({"mode": "totp", "site_key": key, "code": totp(secret(f"LOGIN_{key}_TOTP")), "submit": bool(req.get("submit"))})
            else: return self.send(404, {"error": "unknown"})
        except Exception as e:
            r = {"ok": False, "error": type(e).__name__}
        self.send(200, r)

if __name__ == "__main__":
    if "--selftest" in sys.argv:   # RFC 6238 vector (SHA1, secret "12345678901234567890")
        s = base64.b32encode(b"12345678901234567890").decode()
        assert totp(s, 59, 8) == "94287082", totp(s, 59, 8); print("totp ok"); sys.exit()
    ThreadingHTTPServer(("127.0.0.1", 6072), H).serve_forever()
