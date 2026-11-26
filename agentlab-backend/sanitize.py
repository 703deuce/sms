#!/usr/bin/env python3
"""sanitize.py DIR        -> redact secret VALUES in text files under DIR (in place), report counts by file+rule only.
   sanitize.py --scan DIR -> read-only scan for key-like patterns; exit 1 if any hit. Never prints values."""
import json, os, re, sys

SENS_KEY = re.compile(r"(api[_-]?key|secret|token|password|passwd|passphrase|authorization|bearer|private[_-]?key|client[_-]?secret|access[_-]?key|cookie|credential|session[_-]?key|auth)", re.I)
SAFE_VALUES = re.compile(r"^(|<REDACTED>|none|null|true|false|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|[A-Z][A-Z0-9_]{2,}|bearer|basic|x-api-key)$", re.I)
# value patterns (rule name -> regex matching the secret VALUE)
VALUE_RULES = {
  "anthropic-key": r"sk-ant-[A-Za-z0-9_\-]{10,}",
  "openai-style-key": r"\bsk-[A-Za-z0-9_\-]{20,}",
  "github-token": r"\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}",
  "slack-token": r"\bxox[abprs]-[A-Za-z0-9\-]{10,}",
  "aws-access-key": r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
  "google-api-key": r"\bAIza[0-9A-Za-z_\-]{35}\b",
  "private-key-block": r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
  "jwt": r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}",
  "bearer-literal": r"(?i)bearer\s+[A-Za-z0-9_\-\.=]{24,}",
}
# assignment patterns: KEY=value / key: value / "key": "value" where key looks sensitive
ASSIGN = re.compile(r"""(?P<pre>(?:^|[\s,;{(\[])(?P<k>[A-Za-z0-9_.\-]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PASS|PSK|AUTH|COOKIE)[A-Za-z0-9_.\-]*)(?:\s*[:=]\s*|"\s*:\s*"?|'\s*:\s*'?))(?P<q>["']?)(?P<v>[^\s"',;#)}\]]{8,})(?P=q)""", re.I)
SKIPEXT = {".png",".jpg",".jpeg",".gif",".webp",".ico",".woff",".woff2",".ttf",".otf",".age",".gz",".zip",".pdf",".mp3",".mp4",".wav",".ogg",".so",".pyc",".bin",".db"}

def files(root):
    for d, ds, fs in os.walk(root):
        if ".git" in ds: ds.remove(".git")
        for f in fs:
            p = os.path.join(d, f)
            if os.path.islink(p): continue
            if os.path.splitext(f)[1].lower() in SKIPEXT: continue
            yield p

def read(p):
    try:
        b = open(p, "rb").read()
        if b"\0" in b[:4096]: return None
        return b.decode("utf-8", "replace")
    except Exception: return None

def looks_secret(v):
    if SAFE_VALUES.match(v) or v.startswith("<REDACTED") or "$" in v or v.startswith(("/", "http", "<", "{", "%", "@")): return False
    if len(v) < 16 or re.search(r"[(){}\[\]\\]", v): return False
    if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)): return False
    if re.fullmatch(r"[\w.\-]+\.(py|json|md|txt|sh|js|mjs|ts|yml|yaml|env|html)", v): return False
    if re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", v): return False  # uuid
    return True

def redact_json(o, counts):
    if isinstance(o, dict):
        for k, v in list(o.items()):
            if isinstance(v, str) and SENS_KEY.search(k) and looks_secret(v.strip()):
                o[k] = "<REDACTED>"; counts["json-sensitive-key"] += 1
            else: redact_json(v, counts)
    elif isinstance(o, list):
        for i, v in enumerate(o): redact_json(v, counts)

def sanitize_text(t, counts):
    for rule, rx in VALUE_RULES.items():
        t, n = re.subn(rx, "<REDACTED>", t)
        if n: counts[rule] += n
    def sub(m):
        v = m.group("v")
        if not looks_secret(v): return m.group(0)
        counts["assign-sensitive-key"] += 1
        return m.group("pre") + m.group("q") + "<REDACTED>" + m.group("q")
    return ASSIGN.sub(sub, t)

def do_sanitize(root):
    total = {}
    for p in files(root):
        t = read(p)
        if t is None: continue
        counts = {k: 0 for k in list(VALUE_RULES) + ["json-sensitive-key", "assign-sensitive-key"]}
        new = t
        if p.endswith(".json"):
            try:
                o = json.loads(t); c0 = counts["json-sensitive-key"]; redact_json(o, counts)
                if counts["json-sensitive-key"] > c0: new = json.dumps(o, indent=2, ensure_ascii=False) + "\n"
            except Exception: pass
        new = sanitize_text(new, counts)
        if new != t:
            open(p, "w").write(new)
            total[os.path.relpath(p, root)] = {k: v for k, v in counts.items() if v}
    n = sum(sum(v.values()) for v in total.values())
    print(f"[sanitize] redacted {n} values in {len(total)} files")
    for f, c in sorted(total.items()): print(f"  {f}: {c}")
    # write a log of redactions (file+rule counts only)
    json.dump(total, open(os.path.join(root, "REDACTIONS.json"), "w"), indent=1, sort_keys=True)

def do_scan(root):
    hits = {}
    for p in files(root):
        t = read(p)
        if t is None: continue
        for rule, rx in VALUE_RULES.items():
            if re.search(rx, t): hits.setdefault(os.path.relpath(p, root), []).append(rule)
        for m in ASSIGN.finditer(t):
            v = m.group("v")
            if not looks_secret(v): continue
            hits.setdefault(os.path.relpath(p, root), []).append("assign-sensitive-key"); break
    if p_ := hits:
        print(f"[scan] {len(hits)} files with hits (file: rules; values never printed)")
        for f, r in sorted(hits.items()): print(f"  {f}: {sorted(set(r))}")
        sys.exit(1)
    print("[scan] key-prefix/assignment grep: clean")

if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--scan": do_scan(sys.argv[2])
    elif len(sys.argv) == 2: do_sanitize(sys.argv[1])
    else: sys.exit("usage: sanitize.py [--scan] DIR")
