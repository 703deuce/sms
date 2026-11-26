# Merge SFX cues for a mixed film: keep Cinematic cues outside Remotion ranges, add the Remotion hits.
# usage: python3 merge_cues.py <cinematic project> '[[4.0,8.0]]' '[{"type":"whoosh","t":3.95,"gain":0.7}]'
import json, sys, pathlib
proj = pathlib.Path(sys.argv[1]); ranges = json.loads(sys.argv[2]); extra = json.loads(sys.argv[3])
p = proj / "sfx_cues.json"; d = json.loads(p.read_text())
inside = lambda t: any(a <= t < b for a, b in ranges)
d["cues"] = sorted([c for c in d["cues"] if not inside(c["t"])] + extra, key=lambda c: c["t"])
d["room_tone"] = [[a, b] for a, b in (d.get("room_tone") or [])]
p.write_text(json.dumps(d, indent=1)); print(len(d["cues"]), "cues")
