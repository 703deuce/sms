#!/usr/bin/env python3
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from allowlist import pac_text, load_config
out = sys.argv[1] if len(sys.argv) > 1 else "/opt/tools/egress/proxy.pac"
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, "w").write(pac_text(load_config()))
print("wrote", out)
