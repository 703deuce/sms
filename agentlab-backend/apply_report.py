#!/usr/bin/env python3
"""apply_report.py REPORT.json : redact the exact spans gitleaks flagged (replace with <REDACTED>). Prints file+rule counts only."""
import json, sys, collections
hits = json.load(open(sys.argv[1])) or []
by = collections.defaultdict(list)
for h in hits: by[h["File"]].append(h)
for f, hs in by.items():
    lines = open(f, encoding="utf-8", errors="replace").read().split("\n")
    for h in sorted(hs, key=lambda h: (h["StartLine"], -h["StartColumn"]), reverse=True):
        i = h["StartLine"] - 1; l = lines[i]
        s, e = h["StartColumn"] - 1, h["EndColumn"]
        lines[i] = l[:s] + "<REDACTED>" + l[e:]
        print(f"redacted {h['RuleID']} in {f.split('agentlab-backend/')[-1]}")
    open(f, "w", encoding="utf-8").write("\n".join(lines))
