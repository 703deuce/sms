"""Deny-list + PAC generation for the AgentLab egress gateway.

Paid proxy traffic is no longer limited to a fixed allowlist. Any public host
may use the gateway; the client tries DIRECT first and only asks the gateway
for a paid tier when the response is blocked. deny_suffixes still never go
through DataImpulse (payment and AWS console hosts stay direct-only).
"""
import json, os, re

CONFIG_PATH = os.environ.get("EGRESS_CONFIG", "/opt/agent/ops/egress/config.json")

def load_config():
    with open(CONFIG_PATH) as f:
        cfg = json.load(f)
    cap = os.environ.get("EGRESS_JOB_CAP_BYTES")
    budget = os.environ.get("EGRESS_DAILY_BUDGET_BYTES")
    if cap:
        cfg["job_cap_bytes"] = int(cap)
    if budget:
        cfg["daily_budget_bytes"] = int(budget)
    return cfg

def _norm(host):
    return (host or "").split("%")[0].strip().lower().rstrip(".")

def _match_suffix(host, domain):
    domain = (domain or "").lower().lstrip(".")
    return host == domain or host.endswith("." + domain)

def denied(host, cfg=None):
    """True if this host must never use the paid proxy."""
    host = _norm(host)
    if not host or not re.fullmatch(r"[a-z0-9.-]+", host):
        return True
    cfg = cfg or load_config()
    for d in cfg.get("deny_suffixes") or []:
        if _match_suffix(host, d):
            return True
    return False

def allowed(host, cfg=None):
    """Backward compatible: a host may use the paid proxy unless it is denied."""
    return not denied(host, cfg)

def pac_text(cfg=None):
    """Send every public host to the local gateway.

    The gateway itself uses a DIRECT TCP tunnel unless the client asked for a
    paid tier (or the host was /force'd after a blocked response). Local and
    denied hosts stay DIRECT and never reach the gateway.
    """
    cfg = cfg or load_config()
    listen = cfg.get("proxy_listen", "127.0.0.1:18080")
    deny = [h.lower().lstrip(".") for h in cfg.get("deny_suffixes") or []]
    lines = [
        "// Generated from /opt/agent/ops/egress/config.json — do not edit by hand.",
        "// All public hosts go to the local gateway, which tries DIRECT first and",
        "// only uses DataImpulse when a fetch was blocked (or the host was forced).",
        "function FindProxyForURL(url, host) {",
        "  host = host.toLowerCase();",
        "  if (isPlainHostName(host) || shExpMatch(host, '127.*') || host == 'localhost'",
        "      || shExpMatch(host, '10.*') || shExpMatch(host, '192.168.*') || shExpMatch(host, '172.1[6-9].*')",
        "      || shExpMatch(host, '172.2[0-9].*') || shExpMatch(host, '172.3[0-1].*')) return 'DIRECT';",
    ]
    for d in deny:
        lines.append(f"  if (dnsDomainIs(host, '.{d}') || host == '{d}') return 'DIRECT';")
    lines.append(f"  return 'PROXY {listen}';")
    lines.append("}")
    lines.append("")
    return "\n".join(lines)
