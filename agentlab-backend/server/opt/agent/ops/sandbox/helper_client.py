#!/usr/bin/env python3
"""Talk to the host helper daemon via the unix socket in the workspace."""
from __future__ import annotations
import json, os, socket, sys
from pathlib import Path


def sock_path() -> str:
    for p in (
        os.environ.get("AGENT_HELPER_SOCK"),
        "/workspace/.helper/helper.sock",
        "/opt/agent/workspace/.helper/helper.sock",
    ):
        if p and os.path.exists(p):
            return p
    return ""


def available() -> bool:
    return bool(sock_path())


def call(op: str, **kw) -> dict:
    path = sock_path()
    if not path:
        raise RuntimeError("helper socket not found")
    req = {"op": op, "cwd": kw.pop("cwd", os.getcwd()), "env": {"BOT_ID": os.environ.get("BOT_ID", "agent-lab")}}
    req.update(kw)
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(60)
    s.connect(path)
    s.sendall((json.dumps(req) + "\n").encode())
    buf = b""
    while b"\n" not in buf:
        chunk = s.recv(65536)
        if not chunk:
            break
        buf += chunk
    s.close()
    if not buf:
        raise RuntimeError("helper returned no response")
    return json.loads(buf.split(b"\n", 1)[0].decode())


def proxy_cli(op: str):
    """Forward argv[1:] to the helper, or exec the real /opt/tools CLI."""
    args = sys.argv[1:]
    stdin_text = None
    if not sys.stdin.isatty():
        stdin_text = sys.stdin.read()
    if available():
        try:
            rec = call(op, args=args, stdin=stdin_text)
        except Exception as e:
            print(f"{op}: helper failed ({e}), trying local CLI", file=sys.stderr)
        else:
            if rec.get("stdout"):
                sys.stdout.write(rec["stdout"])
            if rec.get("stderr"):
                sys.stderr.write(rec["stderr"])
            sys.exit(int(rec.get("exit") or (0 if rec.get("ok") else 1)))
    # Fallback: real CLI, for the period before lockdown is applied.
    for candidate in (f"/opt/tools/{op}", f"/opt/agent/tools/{op}"):
        if os.path.isfile(candidate):
            os.execv(candidate, [candidate] + args)
    print(f"{op}: helper not running and no local CLI found", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print("usage: helper-client <op> [args...]")
        sys.exit(0)
    op = sys.argv[1]
    sys.argv = [sys.argv[0]] + sys.argv[2:]
    proxy_cli(op)
