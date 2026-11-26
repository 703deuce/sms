#!/usr/bin/env python3
"""Download one job render-asset to disk without printing signed URLs or tokens.
Env:
  MOTION_JOB_URL   e.g. https://transovo.ai/api/motion-studio/agent/jobs/<jobId>
  MOTION_JOB_TOKEN job bearer token
Usage:
  download_asset.py --out /tmp/out.mp4 (--asset-id <id> | --filename <name>)
"""
import argparse, json, os, sys, urllib.parse, urllib.request

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--asset-id")
    p.add_argument("--filename")
    p.add_argument("--out", required=True)
    args = p.parse_args()
    if not args.asset_id and not args.filename:
        p.error("pass --asset-id or --filename")

    base = os.environ["MOTION_JOB_URL"].rstrip("/")
    token = os.environ["MOTION_JOB_TOKEN"]
    q = urllib.parse.urlencode(
        {"assetId": args.asset_id} if args.asset_id else {"filename": args.filename}
    )
    req = urllib.request.Request(
        f"{base}/render-asset?{q}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())

    url = data.get("url") or data.get("downloadUrl") or data.get("signedUrl")
    if not url:
        print("missing download URL in response", file=sys.stderr)
        sys.exit(2)

    with urllib.request.urlopen(urllib.request.Request(url), timeout=300) as r, open(args.out, "wb") as f:
        total = 0
        while True:
            chunk = r.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
            total += len(chunk)
    print(json.dumps({"ok": True, "out": args.out, "bytes": total}))

if __name__ == "__main__":
    main()
