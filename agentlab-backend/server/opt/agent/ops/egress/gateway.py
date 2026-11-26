#!/usr/bin/env python3
"""AgentLab egress gateway with direct-first, then DataImpulse residential, then mobile.

Listens on 127.0.0.1:18080 (HTTP CONNECT/proxy) and 127.0.0.1:18081 (PAC + usage).
By default the gateway opens a DIRECT tunnel (no paid bytes). Clients that detected
a blocked response retry with header X-Egress-Tier: residential|mobile. Credentials
are read from /opt/agent/secrets and never logged.
"""
from __future__ import annotations

import asyncio, base64, json, os, re, signal, sys, time, hashlib
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from allowlist import allowed, denied, load_config, pac_text

SECRET_FILE = os.environ.get("EGRESS_SECRET", "/opt/agent/secrets/dataimpulse_proxy.env")
LOG_DIR = Path(os.environ.get("EGRESS_LOG_DIR", "/opt/agent/logs/egress"))
USAGE_DIR = Path(os.environ.get("EGRESS_USAGE_DIR", "/opt/agent/workspace/usage/egress"))


def load_secret():
    env = {}
    with open(SECRET_FILE) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip("'\"")
    user, pw = env.get("DI_PROXY_USER"), env.get("DI_PROXY_PASS")
    if not user or not pw:
        raise SystemExit("egress-gateway: missing DI_PROXY_USER/DI_PROXY_PASS")
    host = env.get("DI_PROXY_HOST") or "gw.dataimpulse.com"
    port = int(env.get("DI_PROXY_PORT") or 823)
    m_user = env.get("DI_MOBILE_USER") or ""
    m_pw = env.get("DI_MOBILE_PASS") or ""
    m_host = env.get("DI_MOBILE_HOST") or host
    m_port = int(env.get("DI_MOBILE_PORT") or port)
    return host, port, user, pw, m_user, m_pw, m_host, m_port


def sessid_for(job_key: str) -> str:
    # DataImpulse sessid: any string; keep it short and stable for a job+retry key.
    raw = re.sub(r"[^A-Za-z0-9._-]", "", job_key or "default")[:40] or "default"
    digest = hashlib.sha1(raw.encode()).hexdigest()[:12]
    return f"{raw[:8]}{digest}"


def today():
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo("America/New_York")
    except Exception:
        tz = timezone.utc
    return datetime.now(tz).strftime("%Y-%m-%d")


class Meter:
    def __init__(self, cfg):
        self.cfg = cfg
        self.job_cap = int(cfg["job_cap_bytes"])
        self.daily_budget = int(cfg["daily_budget_bytes"])
        self.lock = asyncio.Lock()
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        USAGE_DIR.mkdir(parents=True, exist_ok=True)
        self.jobs: dict[str, int] = {}
        self.job_tier: dict[str, dict[str, int]] = {}  # job -> {residential, mobile}
        self.day = today()
        self.daily = 0
        self.daily_tier = {"residential": 0, "mobile": 0}
        self.alerted = False
        self._load_daily()

    def _daily_path(self, day=None):
        return USAGE_DIR / f"daily-{(day or self.day)}.json"

    def _load_daily(self):
        p = self._daily_path()
        if p.exists():
            try:
                d = json.loads(p.read_text())
                self.daily = int(d.get("bytes") or 0)
                self.daily_tier = {
                    "residential": int(d.get("residential_bytes") or 0),
                    "mobile": int(d.get("mobile_bytes") or 0),
                }
                # Pre-change logs had a single "bytes" counter (all residential).
                if self.daily_tier["residential"] == 0 and self.daily and not d.get("residential_bytes"):
                    self.daily_tier["residential"] = self.daily
                self.alerted = bool(d.get("alerted_80"))
            except Exception:
                pass

    def _write_daily(self):
        obj = {
            "date": self.day,
            "bytes": self.daily,
            "residential_bytes": self.daily_tier.get("residential", 0),
            "mobile_bytes": self.daily_tier.get("mobile", 0),
            "budget_bytes": self.daily_budget,
            "pct": round(100.0 * self.daily / self.daily_budget, 2) if self.daily_budget else 0,
            "alerted_80": self.alerted,
            "job_cap_bytes": self.job_cap,
        }
        text = json.dumps(obj, indent=2) + "\n"
        self._daily_path().write_text(text)
        # also keep a copy under /opt/agent/logs
        try:
            (LOG_DIR / self._daily_path().name).write_text(text)
        except OSError:
            pass
        (USAGE_DIR / "current.json").write_text(text)

    def _rollover(self):
        if today() != self.day:
            self._write_daily()
            self.day = today()
            self.daily = 0
            self.daily_tier = {"residential": 0, "mobile": 0}
            self.alerted = False
            self.jobs = {}
            self.job_tier = {}
            self._load_daily()

    def snapshot(self):
        self._rollover()
        return {
            "date": self.day,
            "bytes": self.daily,
            "budget_bytes": self.daily_budget,
            "pct": round(100.0 * self.daily / self.daily_budget, 2) if self.daily_budget else 0,
            "alerted_80": self.alerted,
            "job_cap_bytes": self.job_cap,
            "residential_bytes": self.daily_tier.get("residential", 0),
            "mobile_bytes": self.daily_tier.get("mobile", 0),
            "jobs": dict(sorted(self.jobs.items(), key=lambda kv: -kv[1])[:50]),
            "jobs_by_tier": {j: dict(t) for j, t in list(self.job_tier.items())[:50]},
        }

    async def check(self, job: str):
        async with self.lock:
            self._rollover()
            used = self.jobs.get(job, 0)
            if used >= self.job_cap:
                return "job_cap", used
            if self.daily >= self.daily_budget:
                return "daily_budget", self.daily
            return None, used

    async def add(self, job: str, host: str, up: int, down: int, status: str, tier: str = "direct"):
        total = int(up) + int(down)
        paid = tier in ("residential", "mobile")
        async with self.lock:
            self._rollover()
            if paid:
                self.jobs[job] = self.jobs.get(job, 0) + total
                self.daily += total
                jt = self.job_tier.setdefault(job, {"residential": 0, "mobile": 0})
                jt[tier] = jt.get(tier, 0) + total
                self.daily_tier[tier] = self.daily_tier.get(tier, 0) + total
            row = {
                "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "job": job,
                "host": host,
                "up": int(up),
                "down": int(down),
                "status": status,
                "tier": tier,
            }
            try:
                with open(USAGE_DIR / "bytes.jsonl", "a") as f:
                    f.write(json.dumps(row) + "\n")
                with open(LOG_DIR / "bytes.jsonl", "a") as f:
                    f.write(json.dumps(row) + "\n")
            except OSError:
                pass
            if (not self.alerted) and self.daily_budget and self.daily >= 0.8 * self.daily_budget:
                self.alerted = True
                msg = (
                    f"ALERT egress daily usage {self.daily} bytes "
                    f"({100.0 * self.daily / self.daily_budget:.1f}% of {self.daily_budget}) on {self.day}"
                )
                try:
                    (USAGE_DIR / "ALERT").write_text(msg + "\n")
                    (LOG_DIR / "ALERT").write_text(msg + "\n")
                    with open(USAGE_DIR / "daily-log.txt", "a") as f:
                        f.write(msg + "\n")
                except OSError:
                    pass
                print(msg, file=sys.stderr, flush=True)
            self._write_daily()


def clean_job_key(user: str) -> str:
    """Job id from a proxy-user or X-Agent-Job value; drop the __tier.* suffix."""
    user = unquote(user or "")
    user = re.sub(r"(?:__|,|;)tier\.(direct|residential|mobile)\b", "", user, flags=re.I)
    user = re.sub(r"[^A-Za-z0-9._:-]", "", user)[:40]
    return user or "chrome"


def parse_proxy_user(headers: bytes, first_line: str) -> str:
    """Job/sess key from the local client's proxy-authorization user, or X-Agent-Job."""
    text = headers.decode("latin1", "replace")
    m = re.search(r"(?i)\nX-Agent-Job:\s*([A-Za-z0-9._:-]+)", text)
    if m:
        return clean_job_key(m.group(1))
    m = re.search(r"(?i)\nProxy-Authorization:\s*Basic\s+(\S+)", text)
    if m:
        try:
            raw = base64.b64decode(m.group(1) + "===").decode("utf-8", "replace")
            user = raw.split(":", 1)[0]
            if user:
                return clean_job_key(user)
        except Exception:
            pass
    # Chrome and bare curl have no user: treat as the shared browser session.
    return "chrome"


def parse_tier(headers: bytes) -> str:
    text = headers.decode("latin1", "replace")
    m = re.search(r"(?i)\nX-Egress-Tier:\s*(direct|residential|mobile)\b", text)
    if m:
        return m.group(1).lower()
    m = re.search(r"(?i)\nProxy-Authorization:\s*Basic\s+(\S+)", text)
    if m:
        try:
            raw = base64.b64decode(m.group(1) + "===").decode("utf-8", "replace")
            user = unquote(raw.split(":", 1)[0])
            tm = re.search(r"(?:__|,|;)tier\.(direct|residential|mobile)\b", user)
            if tm:
                return tm.group(1).lower()
        except Exception:
            pass
    return ""


def dest_from_connect(target: str):
    if target.startswith("[") and "]:" in target:
        host, _, port = target[1:].partition("]:")
        return host, int(port or 443)
    host, _, port = target.rpartition(":")
    if not host:
        return target, 443
    try:
        return host, int(port)
    except ValueError:
        return target, 443


def dest_from_request_line(line: str):
    # GET http://host:port/path HTTP/1.1
    try:
        _, url, _ = line.split(" ", 2)
    except ValueError:
        return None, None
    if url.startswith("http://"):
        rest = url[7:]
        hostport, _, _ = rest.partition("/")
        return dest_from_connect(hostport)
    return None, None


def reject(reason: str) -> bytes:
    body = f"egress-gateway: {reason}\n".encode()
    return (
        b"HTTP/1.1 403 Forbidden\r\n"
        b"Content-Type: text/plain\r\n"
        b"Connection: close\r\n"
        b"Content-Length: " + str(len(body)).encode() + b"\r\n\r\n" + body
    )


async def pipe(r, w, counter, key):
    try:
        while True:
            data = await r.read(65536)
            if not data:
                break
            counter[key] += len(data)
            w.write(data)
            await w.drain()
    except Exception:
        pass
    finally:
        try:
            w.close()
        except Exception:
            pass


class Gateway:
    def __init__(self):
        self.cfg = load_config()
        up_host, up_port, user, pw, m_user, m_pw, m_host, m_port = load_secret()
        # Prefer the secret file's host/port, fall back to config.
        self.up_host = up_host or self.cfg.get("upstream_host") or "gw.dataimpulse.com"
        self.up_port = int(self.cfg.get("upstream_port") or up_port or 823)
        self.user = user
        self.pw = pw
        self.mobile_user = m_user
        self.mobile_pw = m_pw
        self.mobile_host = m_host or self.up_host
        self.mobile_port = int(m_port or self.up_port)
        self.country = (self.cfg.get("country") or "us").lower()
        self.meter = Meter(self.cfg)
        self.exit_cache = {}
        # host (lower) -> {tier, job, until}
        self.force_map = {}
        self.force_lock = asyncio.Lock()
        # open client tunnels: id -> {host, tier, cw, uw}; used to cut stale tunnels when a host is re-routed
        self.tunnels = {}
        self._tid = 0

    def mobile_enabled(self) -> bool:
        if self.cfg.get("mobile_enabled") is False:
            return False
        return bool(self.mobile_user and self.mobile_pw)

    def upstream_user(self, job_key: str, tier: str = "residential") -> str:
        base = self.mobile_user if tier == "mobile" and self.mobile_user else self.user
        return f"{base}__cr.{self.country};sessid.{sessid_for(job_key)}"

    def upstream_auth(self, job_key: str, tier: str = "residential") -> str:
        pw = self.mobile_pw if tier == "mobile" and self.mobile_pw else self.pw
        pair = f"{self.upstream_user(job_key, tier)}:{pw}"
        return base64.b64encode(pair.encode()).decode()

    def upstream_endpoint(self, tier: str):
        if tier == "mobile" and self.mobile_host:
            return self.mobile_host, self.mobile_port
        return self.up_host, self.up_port

    def geo_default(self, host: str) -> str:
        # Sites that send this (non-US) server a different country site with HTTP 200 and no block signal
        # (Best Buy -> "Select your Country"): start them on the US residential tier. Config: geo_residential_suffixes.
        h = (host or "").lower().strip(".")
        for suf in self.cfg.get("geo_residential_suffixes") or ():
            if h == suf or h.endswith("." + suf):
                return "residential"
        return ""

    async def forced_tier(self, host: str, job: str) -> str:
        host = (host or "").lower().strip(".")
        async with self.force_lock:
            labels = host.split(".")
            for i in range(len(labels)):
                key = ".".join(labels[i:])
                rec = self.force_map.get(key)
                if not rec:
                    continue
                if rec.get("until") and rec["until"] < time.time():
                    self.force_map.pop(key, None)
                    continue
                return rec.get("tier") or ""
            return ""

    async def set_force(self, host: str, tier: str, job: str, ttl: int = 900):
        host = (host or "").lower().strip(".")
        if not host or tier not in ("direct", "residential", "mobile"):
            return {"ok": False, "error": "bad host or tier"}
        if tier == "mobile" and not self.mobile_enabled():
            return {"ok": False, "error": "mobile_disabled", "host": host, "tier": tier}
        async with self.force_lock:
            self.force_map[host] = {"tier": tier, "job": job or "chrome", "until": time.time() + int(ttl or 900)}
            rec = {"ok": True, "host": host, **self.force_map[host]}
        # Connection recovery: a browser keeps HTTP/2 tunnels open. Cut the ones to this domain that run on another
        # tier so the browser's retry/reload opens a fresh tunnel through the forced tier (cookies stay in the browser).
        rec["closed_tunnels"] = self.drop_tunnels(host, keep_tier=tier)
        return rec

    def drop_tunnels(self, domain: str, keep_tier: str) -> int:
        n = 0
        for tid, t in list(self.tunnels.items()):
            h = t["host"]
            if (h == domain or h.endswith("." + domain)) and t["tier"] != keep_tier:
                for w in (t["cw"], t["uw"]):
                    try:
                        w.close()
                    except Exception:
                        pass
                self.tunnels.pop(tid, None)
                n += 1
        return n

    async def handle(self, cr: asyncio.StreamReader, cw: asyncio.StreamWriter):
        job, host, status, tier = "chrome", "?", "ok", "direct"
        up = down = 0
        try:
            head = await asyncio.wait_for(cr.readuntil(b"\r\n\r\n"), timeout=30)
        except Exception:
            cw.close()
            return
        try:
            first = head.split(b"\r\n")[0].decode("latin1", "replace")
            parts = first.split(" ", 2)
            if len(parts) < 2:
                cw.write(reject("bad request"))
                await cw.drain()
                return
            method, target = parts[0], parts[1]
            job = parse_proxy_user(head, first)
            req_tier = parse_tier(head)
            if method == "CONNECT":
                host, port = dest_from_connect(target)
            else:
                host, port = dest_from_request_line(first)
                if not host:
                    # origin-form (status server should be used for PAC); refuse
                    cw.write(reject("use CONNECT or an absolute-form URL"))
                    await cw.drain()
                    return
            if port not in (80, 443, 8080):
                cw.write(reject(f"port {port} is not allowed"))
                await cw.drain()
                status = "port_blocked"
                return
            if denied(host, self.cfg):
                # Payment / AWS console hosts stay direct-only (never paid proxy).
                tier = "direct"
            else:
                forced = await self.forced_tier(host, job)
                tier = req_tier or forced or self.geo_default(host) or "direct"
            if tier == "mobile" and not self.mobile_enabled():
                cw.write(reject("mobile tier is disabled (no DataImpulse mobile plan in credentials)"))
                await cw.drain()
                status = "mobile_disabled"
                return
            if tier in ("residential", "mobile"):
                reason, _ = await self.meter.check(job)
                if reason == "job_cap":
                    cw.write(reject(f"job {job} exceeded the {self.meter.job_cap} byte cap"))
                    await cw.drain()
                    status = "job_cap"
                    return
                if reason == "daily_budget":
                    cw.write(reject("daily egress budget exhausted"))
                    await cw.drain()
                    status = "daily_budget"
                    return

            counts = {"up": 0, "down": 0}
            if tier in ("residential", "mobile"):
                up_host, up_port = self.upstream_endpoint(tier)
                ur, uw = await asyncio.open_connection(up_host, up_port)
                auth = self.upstream_auth(job, tier)
                if method == "CONNECT":
                    req = (
                        f"CONNECT {host}:{port} HTTP/1.1\r\n"
                        f"Host: {host}:{port}\r\n"
                        f"Proxy-Authorization: Basic {auth}\r\n"
                        f"Proxy-Connection: Keep-Alive\r\n\r\n"
                    ).encode()
                    uw.write(req)
                    await uw.drain()
                    counts["up"] += len(req)
                    resp = await asyncio.wait_for(ur.readuntil(b"\r\n\r\n"), timeout=30)
                    counts["down"] += len(resp)
                    cw.write(resp)
                    await cw.drain()
                    if b" 200" not in resp.split(b"\r\n")[0]:
                        status = "upstream_" + resp.split(b"\r\n")[0].decode("latin1", "replace")[:40]
                        up, down = counts["up"], counts["down"]
                        return
                else:
                    headers = head
                    headers = re.sub(br"(?i)Proxy-Authorization:.*\r\n", b"", headers)
                    headers = re.sub(br"(?i)X-Egress-Tier:.*\r\n", b"", headers)
                    headers = headers.replace(b"\r\n\r\n", f"\r\nProxy-Authorization: Basic {auth}\r\n\r\n".encode(), 1)
                    uw.write(headers)
                    await uw.drain()
                    counts["up"] += len(headers)
            else:
                # DIRECT tunnel (no DataImpulse). CONNECT: open dest and return 200.
                ur, uw = await asyncio.open_connection(host, port)
                if method == "CONNECT":
                    resp = b"HTTP/1.1 200 Connection Established\r\nProxy-Agent: agent-lab-egress\r\n\r\n"
                    cw.write(resp)
                    await cw.drain()
                else:
                    # Absolute-form HTTP request: strip proxy headers and send origin-form.
                    headers = head
                    headers = re.sub(br"(?i)Proxy-Authorization:.*\r\n", b"", headers)
                    headers = re.sub(br"(?i)X-Egress-Tier:.*\r\n", b"", headers)
                    # rewrite "GET http://host/path" to "GET /path"
                    try:
                        line, rest = headers.split(b"\r\n", 1)
                        meth, url, ver = line.decode("latin1").split(" ", 2)
                        if url.startswith("http://"):
                            path = "/" + url.split("/", 3)[-1] if url.count("/") >= 3 else "/"
                            line = f"{meth} {path} {ver}".encode()
                            headers = line + b"\r\n" + rest
                    except Exception:
                        pass
                    uw.write(headers)
                    await uw.drain()
                    counts["up"] += len(headers)
            self._tid += 1
            tid = self._tid
            self.tunnels[tid] = {"host": host, "tier": tier, "cw": cw, "uw": uw}
            try:
                await asyncio.gather(pipe(cr, uw, counts, "up"), pipe(ur, cw, counts, "down"))
            finally:
                self.tunnels.pop(tid, None)
            up, down = counts["up"], counts["down"]
        except Exception as e:
            status = "error"
            # no exception text (might contain URLs)
            try:
                cw.write(reject("upstream error"))
                await cw.drain()
            except Exception:
                pass
        finally:
            try:
                cw.close()
            except Exception:
                pass
            try:
                await self.meter.add(job, host, up, down, status, tier)
            except Exception:
                pass


    async def lookup_exit(self, job="chrome"):
        """Timezone/city of the sticky exit IP for this job (same sessid Chrome uses).

        Direct-first means most Chrome traffic leaves from the lab itself, so this
        does not spend DataImpulse bytes unless ?paid=1 is requested.
        """
        job = re.sub(r"[^A-Za-z0-9._:-]", "", job or "chrome")[:40] or "chrome"
        sid = sessid_for(job)
        cached = self.exit_cache.get(job)
        if cached and cached.get("sess") == sid and (time.time() - cached["ts"]) < 600:
            return cached["info"]
        info = {"job": job, "timezone": "America/New_York", "fallback": True}
        paid = any((r or {}).get("tier") in ("residential", "mobile") for r in self.force_map.values())
        if not paid:
            self.exit_cache[job] = {"ts": time.time(), "sess": sid, "info": info}
            return info
        try:
            auth = self.upstream_auth(job, "residential")
            req = (
                "GET http://ip-api.com/json/?fields=status,country,regionName,city,lat,lon,timezone,query HTTP/1.1\r\n"
                "Host: ip-api.com\r\n"
                "Proxy-Authorization: Basic " + auth + "\r\n"
                "Connection: close\r\n\r\n"
            ).encode()
            ur, uw = await asyncio.open_connection(self.up_host, self.up_port)
            try:
                uw.write(req)
                await uw.drain()
                raw = await asyncio.wait_for(ur.read(65536), timeout=20)
            finally:
                try:
                    uw.close()
                except Exception:
                    pass
            try:
                await self.meter.add(job, "ip-api.com", len(req), len(raw or b""), "exit-info", "residential")
            except Exception:
                pass
            _head, _, body = (raw or b"").partition(b"\r\n\r\n")
            text = body.decode("utf-8", "replace").strip()
            start, end = text.find("{"), text.rfind("}")
            if start >= 0 and end > start:
                d = json.loads(text[start:end + 1])
                if d.get("timezone") or d.get("query"):
                    info = {
                        "job": job,
                        "ip": d.get("query"),
                        "city": d.get("city"),
                        "region": d.get("regionName"),
                        "country": d.get("country"),
                        "timezone": d.get("timezone") or "America/New_York",
                        "lat": d.get("lat"),
                        "lon": d.get("lon"),
                        "fallback": not bool(d.get("timezone")),
                    }
        except Exception:
            pass
        self.exit_cache[job] = {"ts": time.time(), "sess": sid, "info": info}
        return info

    async def status_handle(self, cr, cw):
        try:
            head = await asyncio.wait_for(cr.readuntil(b"\r\n\r\n"), timeout=15)
            first = head.split(b"\r\n")[0].decode("latin1", "replace")
            reqpath = first.split(" ")[1] if " " in first else "/"
            path, _, query = reqpath.partition("?")
            if path in ("/proxy.pac", "/pac"):
                body = pac_text(self.cfg).encode()
                ctype = "application/x-ns-proxy-autoconfig"
            elif path in ("/usage", "/usage.json"):
                snap = self.meter.snapshot()
                snap["mobile_enabled"] = self.mobile_enabled()
                body = json.dumps(snap, indent=2).encode() + b"\n"
                ctype = "application/json"
            elif path in ("/force", "/force.json"):
                qs = parse_qs(query)
                host = (qs.get("host") or [""])[0]
                tier = (qs.get("tier") or [""])[0]
                job = (qs.get("job") or ["chrome"])[0]
                ttl = int((qs.get("ttl") or ["900"])[0] or 900)
                if host and tier:
                    body = json.dumps(await self.set_force(host, tier, job, ttl), indent=2).encode() + b"\n"
                else:
                    # names only; no secrets
                    forced = {h: {"tier": r.get("tier"), "until": r.get("until")} for h, r in self.force_map.items()}
                    body = json.dumps({"forced": forced, "mobile_enabled": self.mobile_enabled()}, indent=2).encode() + b"\n"
                ctype = "application/json"
            elif path in ("/exit-info", "/exit-info.json"):
                job = (parse_qs(query).get("job") or ["chrome"])[0]
                body = json.dumps(await self.lookup_exit(job), indent=2).encode() + b"\n"
                ctype = "application/json"
            elif path in ("/health", "/"):
                body = b"ok\n"
                ctype = "text/plain"
            else:
                body = b"not found\n"
                ctype = "text/plain"
                cw.write(b"HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: 10\r\nConnection: close\r\n\r\n" + body)
                await cw.drain()
                return
            cw.write(
                b"HTTP/1.1 200 OK\r\nContent-Type: " + ctype.encode() +
                b"\r\nContent-Length: " + str(len(body)).encode() +
                b"\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n" + body
            )
            await cw.drain()
        except Exception:
            pass
        finally:
            try:
                cw.close()
            except Exception:
                pass

    async def run(self):
        ph, pp = self.cfg["proxy_listen"].split(":")
        sh, sp = self.cfg["status_listen"].split(":")
        proxy = await asyncio.start_server(self.handle, ph, int(pp))
        status = await asyncio.start_server(self.status_handle, sh, int(sp))
        print(f"egress-gateway proxy {ph}:{pp} status {sh}:{sp}", flush=True)
        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, stop.set)
            except NotImplementedError:
                pass
        async with proxy, status:
            await stop.wait()


def main():
    try:
        asyncio.run(Gateway().run())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
