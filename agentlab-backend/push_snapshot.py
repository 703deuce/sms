#!/usr/bin/env python3
"""push_snapshot.py --repo O/R --base master --folder agentlab-backend --stage DIR --branch-prefix P
Commits DIR as the whole top-level folder <folder>/ via the Git Data API (no local clone), on a branch, and opens/updates a PR.
Never force-pushes, never touches the base branch, never merges. Needs GITHUB_TOKEN in the environment (never printed)."""
import argparse, base64, json, os, sys, time, urllib.request, urllib.error, concurrent.futures as cf, datetime

ap = argparse.ArgumentParser()
ap.add_argument("--repo", required=True); ap.add_argument("--base", default="master")
ap.add_argument("--folder", required=True); ap.add_argument("--stage", required=True)
ap.add_argument("--branch-prefix", required=True); ap.add_argument("--message", default=None)
ap.add_argument("--dry", action="store_true")
a = ap.parse_args()
TOK = os.environ["GITHUB_TOKEN"]; API = f"https://api.github.com/repos/{a.repo}"

def call(method, path, body=None, ok404=False):
    for attempt in range(5):
        req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
              headers={"Authorization": f"Bearer {TOK}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "agentlab-backup"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:
            if e.code == 404 and ok404: return None
            if e.code in (502, 503, 429) or (e.code == 403 and "rate" in e.read().decode().lower()): time.sleep(2 ** attempt); continue
            print(f"GitHub API {method} {path} -> HTTP {e.code}: {e.read().decode()[:300] if not e.fp.closed else ''}", file=sys.stderr); sys.exit(1)
        except Exception as e:
            time.sleep(2 ** attempt)
    sys.exit(f"GitHub API {method} {path} failed repeatedly")

base_sha = call("GET", f"/git/ref/heads/{a.base}")["object"]["sha"]
# branch selection
branch = a.branch_prefix; head = call("GET", f"/git/ref/heads/{branch}", ok404=True)
pr = None
if head:
    owner = a.repo.split("/")[0]
    prs = call("GET", f"/pulls?state=open&head={owner}:{branch}")
    if prs: pr = prs[0]
    else:
        branch = f"{a.branch_prefix}-{datetime.datetime.utcnow():%Y%m%d-%H%M}"; head = None
parent = head["object"]["sha"] if head else base_sha
parent_tree = call("GET", f"/git/commits/{parent}")["tree"]["sha"]

files = []
for d, ds, fs in os.walk(a.stage):
    for f in fs:
        p = os.path.join(d, f)
        if os.path.islink(p): continue
        files.append((os.path.relpath(p, a.stage).replace(os.sep, "/"), p))
files.sort()
print(f"{len(files)} files, {sum(os.path.getsize(p) for _, p in files)/1e6:.1f} MB to upload")
if a.dry: sys.exit(0)

def blob(item):
    rel, p = item
    data = open(p, "rb").read()
    r = call("POST", "/git/blobs", {"content": base64.b64encode(data).decode(), "encoding": "base64"})
    mode = "100755" if os.access(p, os.X_OK) else "100644"
    return {"path": f"{rel}", "mode": mode, "type": "blob", "sha": r["sha"]}
with cf.ThreadPoolExecutor(8) as ex: entries = list(ex.map(blob, files))
# build the folder subtree from scratch (so deleted files disappear), then splice into the parent root tree
sub = call("POST", "/git/trees", {"tree": entries})["sha"]
root = call("POST", "/git/trees", {"base_tree": parent_tree, "tree": [{"path": a.folder, "mode": "040000", "type": "tree", "sha": sub}]})["sha"]
stamp = open(os.path.join(a.stage, "SNAPSHOT_TIME_UTC.txt")).read().strip() if os.path.exists(os.path.join(a.stage, "SNAPSHOT_TIME_UTC.txt")) else ""
msg = a.message or f"agentlab-backend: server snapshot {stamp}\n\nCode, configs, skills, tools, unit files, docs; secrets only as secrets.tar.age (age-encrypted)."
commit = call("POST", "/git/commits", {"message": msg, "tree": root, "parents": [parent]})["sha"]
if head: call("PATCH", f"/git/refs/heads/{branch}", {"sha": commit, "force": False})
else: call("POST", "/git/refs", {"ref": f"refs/heads/{branch}", "sha": commit})
print(f"branch {branch} -> {commit[:10]}")
if not pr:
    body = (f"Snapshot of the AgentLab server (`/opt/agent` code, systemd units, crontab, docker definitions) plus local AgentLab docs, under `{a.folder}/`.\n\n"
            f"- Plaintext files passed gitleaks + a key-prefix grep + an exact-value cross-check against the real secrets (hits redacted to `<REDACTED>`).\n"
            f"- Secrets are included **only** as `{a.folder}/secrets.tar.age` (age-encrypted; public recipient in `age-recipient.pub`).\n"
            f"- See `{a.folder}/README.md` for restore steps and `{a.folder}/sync.sh` to refresh.\n\nNot merged; needs John's review.")
    pr = call("POST", "/pulls", {"title": f"AgentLab server backup snapshot ({a.folder}/)", "head": branch, "base": a.base, "body": body})
print("PR:", pr["html_url"])
