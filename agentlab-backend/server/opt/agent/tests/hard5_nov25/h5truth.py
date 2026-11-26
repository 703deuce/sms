import json, urllib.request
def get(u):
    req=urllib.request.Request(u,headers={"User-Agent":"agentlab-grader/1.0 (test harness)"})
    return json.load(urllib.request.urlopen(req,timeout=20))
out={}
for c in ("reqwest","tokio"):
    d=get(f"https://crates.io/api/v1/crates/{c}"); cr=d["crate"]
    v=cr.get("max_stable_version") or cr["max_version"]
    ver=[x for x in d["versions"] if x["num"]==v][0]
    out[c]=dict(ecosystem="crates",version=v,license=ver.get("license"),repository=cr.get("repository"),date=ver["created_at"][:10])
for p in ("axios","express"):
    d=get(f"https://registry.npmjs.org/{p}"); v=d["dist-tags"]["latest"]
    out[p]=dict(ecosystem="npm",version=v,license=d["versions"][v].get("license"),repository=(d.get("repository") or {}).get("url"),date=d["time"][v][:10])
for p in ("requests","fastapi"):
    d=get(f"https://pypi.org/pypi/{p}/json"); v=d["info"]["version"]
    up=d["urls"][0]["upload_time_iso_8601"][:10] if d["urls"] else None
    pu=d["info"].get("project_urls") or {}
    out[p]=dict(ecosystem="pypi",version=v,license=d["info"].get("license") or d["info"].get("license_expression"),repository=pu.get("Source") or pu.get("Repository") or pu.get("Source Code"),date=up,classifiers=[c for c in d["info"]["classifiers"] if c.startswith("License")],license_expression=d["info"].get("license_expression"))
print(json.dumps(out,indent=1))
