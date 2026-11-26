#!/usr/bin/env python3
"""Host-side Agent Lab helper daemon.

Listens on a unix socket (default /opt/agent/workspace/.helper/helper.sock).
Only accepts connections from uid 0, 10001 (OpenHands), 19999, or 20001-20100
(SO_PEERCRED). It is the only process that can write /workspace/memory,
/workspace/skills and /workspace/pages once lockdown is applied.

Ops:
  health
  init_job {job_id}
  remember | forget | project-note | save-skill   — run the real CLI as agentlab-helper
  publish {src, title, slug?} — write a page under /workspace/pages

Never logs env values, request bodies, or secret flags.
"""
from __future__ import annotations

import json, os, shutil, socket, struct, subprocess, sys, tempfile, threading
from pathlib import Path

sys.path.insert(0, "/opt/agent/ops/sandbox")
import uidmap

HOST_WS = Path(os.environ.get("AGENT_HOST_WORKSPACE", "/opt/agent/workspace"))
SOCK_PATH = Path(os.environ.get("AGENT_HELPER_SOCK_HOST", str(HOST_WS / ".helper" / "helper.sock")))
TOOLS = Path(os.environ.get("AGENT_TOOLS", "/opt/agent/tools"))
# Brokered writes run as this user. With the Landlock sandbox the files keep their normal owner (10001).
HELPER_UID = int(os.environ.get('AGENT_HELPER_UID', '19999'))
HELPER_GID = int(os.environ.get('AGENT_HELPER_GID', '19998'))
JOB_GROUP = 19998
ALLOWED_CMDS = {
    "remember": TOOLS / "remember",
    "forget": TOOLS / "forget",
    "project-note": TOOLS / "project-note",
    "save-skill": TOOLS / "save-skill",
    "recall": TOOLS / "recall",          # read-only, but SQLite WAL reads need write access to memory/
    "history-search": TOOLS / "history-search",  # read-only search of past conversations (memory/history.db)
}
SO_PEERCRED = 17
CRED_FMT = "3i"
MAX_BODY = 2 * 1024 * 1024


def log(msg):
    print(f"helperd: {msg}", flush=True)


def workspace_from_cwd(cwd: str | None) -> Path:
    """Map a container path (/workspace/...) to the host workspace."""
    cwd = cwd or ""
    if cwd.startswith("/workspace/") or cwd == "/workspace":
        return HOST_WS / cwd[len("/workspace/"):].lstrip("/") if cwd != "/workspace" else HOST_WS
    if cwd.startswith(str(HOST_WS)):
        return Path(cwd)
    return HOST_WS


def peer_uid(conn: socket.socket) -> int:
    creds = conn.getsockopt(socket.SOL_SOCKET, SO_PEERCRED, struct.calcsize(CRED_FMT))
    pid, uid, gid = struct.unpack(CRED_FMT, creds)
    return uid


def allowed_uid(uid: int) -> bool:
    return uid in (0, 10001, HELPER_UID) or (20001 <= uid <= 20100)


def recv_json(conn) -> dict:
    buf = b""
    conn.settimeout(30)
    while b"\n" not in buf:
        chunk = conn.recv(65536)
        if not chunk:
            break
        buf += chunk
        if len(buf) > MAX_BODY:
            raise ValueError("request too large")
    if not buf:
        return {}
    return json.loads(buf.split(b"\n", 1)[0].decode())


def send_json(conn, obj):
    data = (json.dumps(obj, ensure_ascii=False) + "\n").encode()
    conn.sendall(data)


def drop_and_run(argv, cwd, env_extra, stdin_bytes=None, run_uid=None, run_gid=None):
    host_cwd = str(workspace_from_cwd(cwd)) if cwd else str(HOST_WS)
    if not os.path.isdir(host_cwd):
        host_cwd = str(HOST_WS)
    env = os.environ.copy()
    # Do not import the helper's env secrets into the child beyond what's already there.
    env["BOT_ID"] = (env_extra or {}).get("BOT_ID") or env.get("BOT_ID") or "agent-lab"
    env["AGENT_MEMORY_DB"] = str(HOST_WS / "memory" / "memory.db")
    env["AGENT_SKILLS_DIR"] = str(HOST_WS / "skills")
    env["AGENT_PROJECTS_DIR"] = str(HOST_WS / "memory" / "projects")
    env["HOME"] = str(HOST_WS / ".helper" / "home")
    Path(env["HOME"]).mkdir(parents=True, exist_ok=True)
    os.chown(env["HOME"], HELPER_UID, JOB_GROUP)
    # save-skill must run as the owner of /workspace/skills (10001). HELPER_UID (19999)
    # cannot mkdir or update files there (mode 0755 / 0644).
    uid = HELPER_UID if run_uid is None else run_uid
    gid = HELPER_GID if run_gid is None else run_gid

    def preexec():
        os.setgid(gid)
        os.setuid(uid)

    r = subprocess.run(
        [str(x) for x in argv],
        cwd=host_cwd,
        env=env,
        input=stdin_bytes,
        capture_output=True,
        timeout=60,
        preexec_fn=preexec,
    )
    return {
        "ok": r.returncode == 0,
        "exit": r.returncode,
        "stdout": r.stdout.decode("utf-8", "replace"),
        "stderr": r.stderr.decode("utf-8", "replace"),
    }


def op_init_job(job_id, caller_uid):
    job_id = uidmap._clean(job_id)
    existing = uidmap.lookup(job_id)
    # A job user may only init its own job; the daemon user (10001/root) can init any new job.
    if 20001 <= caller_uid <= 20100:
        if existing is not None and existing != caller_uid:
            return {"ok": False, "error": "cannot init a job that belongs to another user"}
        if existing is None:
            return {"ok": False, "error": "job user cannot allocate a new job id"}
        uid = existing
    else:
        uid = uidmap.allocate(job_id)
    dest = HOST_WS / "jobs" / job_id
    dest.mkdir(parents=True, exist_ok=True)
    # Never re-chown a job that already belongs to a different uid.
    try:
        st = dest.stat()
        if st.st_uid not in (0, uid, 10001, HELPER_UID) and st.st_uid != uid:
            # if owned by another job uid, refuse
            if 20001 <= st.st_uid <= 20100 and st.st_uid != uid:
                return {"ok": False, "error": "job folder already owned by another job"}
    except FileNotFoundError:
        pass
    os.chown(dest, uid, JOB_GROUP)
    os.chmod(dest, 0o700)  # owner-only; shared gid 19998 must not be group-writable
    for sub in ("src", "work", "frames", "out", "log"):
        p = dest / sub
        p.mkdir(exist_ok=True)
        os.chown(p, uid, JOB_GROUP)
        os.chmod(p, 0o700)
    return {"ok": True, "job_id": job_id, "uid": uid, "path": str(dest)}


def op_cli(cmd, args, cwd, env, stdin_text):
    binary = ALLOWED_CMDS[cmd]
    if not binary.is_file():
        return {"ok": False, "error": f"{cmd} CLI is not installed at {binary}"}
    argv = [str(binary)] + [str(a) for a in (args or [])]
    stdin_bytes = None if stdin_text is None else str(stdin_text).encode()
    extra = {}
    if cmd == "save-skill":
        extra = {"run_uid": 10001, "run_gid": 10001}
    return drop_and_run(argv, cwd, env, stdin_bytes, **extra)


def op_publish(req):
    # Reuse the publish implementation if available, running as helper.
    pub = Path("/opt/agent/workspace/tools/bin/publish")
    if not pub.is_file():
        pub = Path("/workspace/tools/bin/publish")
    if not pub.is_file():
        return {"ok": False, "error": "publish CLI not found"}
    src = req.get("src")
    if not src:
        return {"ok": False, "error": "src is required"}
    # Map container path
    if src.startswith("/workspace/"):
        src = str(HOST_WS / src[len("/workspace/"):])
    if not os.path.isfile(src):
        return {"ok": False, "error": "source file not found"}
    argv = [str(pub), src]
    if req.get("title"):
        argv += ["--title", str(req["title"])]
    if req.get("slug"):
        argv += ["--slug", str(req["slug"])]
    env = {"AGENT_PAGES_DIR": str(HOST_WS / "pages"), "BOT_ID": (req.get("env") or {}).get("BOT_ID") or "agent-lab"}
    return drop_and_run(argv, req.get("cwd"), env)


def handle(req, caller_uid):
    op = req.get("op")
    if op == "health":
        return {"ok": True, "uid_pool": "20001-20100"}
    if op == "init_job":
        return op_init_job(req.get("job_id") or "", caller_uid)
    if op in ALLOWED_CMDS:
        return op_cli(op, req.get("args") or [], req.get("cwd"), req.get("env") or {}, req.get("stdin"))
    if op == "publish":
        return op_publish(req)
    return {"ok": False, "error": f"unknown op {op}"}


def serve_one(conn, addr):
    try:
        uid = peer_uid(conn)
        if not allowed_uid(uid):
            send_json(conn, {"ok": False, "error": "unauthorized"})
            return
        req = recv_json(conn)
        op = req.get("op")
        log(f"uid={uid} op={op}")
        try:
            resp = handle(req, uid)
        except Exception as e:
            resp = {"ok": False, "error": f"{type(e).__name__}"}
        send_json(conn, resp)
    except Exception as e:
        log(f"connection error: {type(e).__name__}")
    finally:
        try:
            conn.close()
        except OSError:
            pass


def main():
    SOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    if SOCK_PATH.exists():
        SOCK_PATH.unlink()
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.bind(str(SOCK_PATH))
    # 0666 so any job uid in the container can connect; auth is SO_PEERCRED.
    os.chmod(SOCK_PATH, 0o666)
    sock.listen(32)
    log(f"listening on {SOCK_PATH}")
    while True:
        conn, addr = sock.accept()
        t = threading.Thread(target=serve_one, args=(conn, addr), daemon=True)
        t.start()


if __name__ == "__main__":
    main()
