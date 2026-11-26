# Pick and download a Kevin MacLeod (incompetech, CC BY 4.0) track by feel; prints the credit line.
# usage: python3 getmusic.py "Dark,Mysterious" out.mp3 [min_bpm max_bpm]
import json, sys, urllib.request, urllib.parse
UA = {"User-Agent": "Mozilla/5.0"}
feel = [w.strip().lower() for w in sys.argv[1].split(",")]; out = sys.argv[2]
lo, hi = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (0, 999)
pieces = json.load(urllib.request.urlopen(urllib.request.Request(
    "https://incompetech.com/music/royalty-free/pieces.json", headers=UA), timeout=40))
def score(p):
    f = (p.get("feel") or "").lower(); return sum(w in f for w in feel)
ok = [p for p in pieces if score(p) and lo <= int(p.get("bpm") or 0 or (lo + hi) // 2) <= hi]
ok.sort(key=lambda p: (-score(p), p["title"]))
for p in ok[:5]: print("candidate:", p["title"], "|", p.get("feel"), "|", p.get("bpm"), "bpm |", p.get("length"))
p = ok[0]
url = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/" + urllib.parse.quote(p["filename"])
open(out, "wb").write(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read())
print(f'credit: "{p["title"]}" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 '
      f'http://creativecommons.org/licenses/by/4.0/ | {url}')
