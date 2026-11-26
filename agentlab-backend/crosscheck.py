#!/usr/bin/env python3
"""crosscheck.py STAGE_DIR  (reads the decrypted secrets tar.gz from stdin; nothing hits disk)
Collects secret VALUES (from *.env files and sensitive JSON keys), then finds/redacts any exact occurrence in the plaintext stage.
Prints file + count only. Add --dry to only report. Add --context to print each hit line with the value masked as <V>."""
import sys, tarfile, os, re, json
stage = sys.argv[1]; dry = "--dry" in sys.argv; ctx = "--context" in sys.argv
SENS = re.compile(r"(key|secret|token|password|pass|auth|cookie|credential)", re.I)
vals = set()
def walk(o, k=""):
    if isinstance(o, dict):
        for kk, v in o.items(): walk(v, kk)
    elif isinstance(o, list):
        for v in o: walk(v, k)
    elif isinstance(o, str) and SENS.search(k) and len(o) >= 12: vals.add(o)
tf = tarfile.open(fileobj=sys.stdin.buffer, mode="r|gz")
for m in tf:
    if not m.isfile() or "jinja" in m.name: continue
    t = tf.extractfile(m).read().decode("utf-8", "replace")
    if m.name.endswith(".json"):
        try: walk(json.loads(t))
        except Exception: pass
    elif m.name.endswith(".env") or m.name.endswith("/.env") or m.name.endswith((".yml", ".yaml")):
        for l in t.splitlines():
            if l.lstrip().startswith("#"): continue
            for sep in ("=", ":"):
                if sep in l:
                    v = l.split(sep, 1)[1].strip().strip("\"'")
                    if len(v) >= 12 and (sep == "=" or "key" in l.lower()): vals.add(v)
                    break
# identifiers that live in .env files but are NOT credentials (hostnames, email addresses, numeric IDs): leave in docs/config
NONSECRET = re.compile(r"^(\d+|[A-Za-z0-9._\-]+@[A-Za-z0-9.\-]+\.[a-z]{2,}|[a-z0-9][a-z0-9.\-]*\.[a-z]{2,}|https?://\S+)$")
skipped = [v for v in vals if NONSECRET.match(v)]
vals = sorted((v for v in vals if not NONSECRET.match(v)), key=len, reverse=True)
print(f"[crosscheck] {len(skipped)} non-credential identifiers (host/email/numeric id) allow-listed")
print(f"[crosscheck] {len(vals)} secret values loaded (never printed)")
total = 0; files = 0
for d, ds, fs in os.walk(stage):
    for f in fs:
        if f == "secrets.tar.age": continue
        p = os.path.join(d, f)
        try: b = open(p, "r", errors="surrogateescape").read()
        except Exception: continue
        n = 0; nb = b
        for v in vals:
            c = nb.count(v)
            if c:
                n += c
                if ctx:
                    for i, l in enumerate(nb.split("\n")):
                        if v in l: print("   ", os.path.relpath(p, stage), i + 1, l.replace(v, "<V>")[:160])
                nb = nb.replace(v, "<REDACTED>")
        if n:
            total += n; files += 1
            print(f"[crosscheck] {os.path.relpath(p, stage)}: {n} exact secret value(s)" + ("" if dry else " -> redacted"))
            if not dry: open(p, "w", errors="surrogateescape").write(nb)
print(f"[crosscheck] {total} occurrences in {files} files")
sys.exit(1 if (dry and total) else 0)
