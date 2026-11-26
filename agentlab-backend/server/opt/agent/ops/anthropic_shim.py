#!/usr/bin/env python3
"""Anthropic Messages pass-through for models that bind thinking blocks to their conversation prefix (Fable/Mythos).

Why: those models reject a replayed thinking block whose preceding history changed ("Invalid `signature` in
`thinking` block. The block is bound to a different conversation"). Condensation always changes that history.
Anthropic's control for this is thinking.block_binding.prefix_mismatch_behavior = "drop_block" (beta header
thinking-binding-controls-2026-08-01), but OpenHands 1.63.1 + litellm cannot put it in the request (litellm_extra_body
is forwarded to Anthropic as a literal "extra_body" key and rejected). This shim adds it on the wire, and if Anthropic
still rejects a thinking block it removes all thinking blocks from the replayed history and retries once.

It holds no secrets: the caller's own x-api-key (from its OpenHands profile) is forwarded unchanged and never logged.
Profiles opt in with base_url http://127.0.0.1:6074 (runlib.with_thinking_binding). Listens on 127.0.0.1 only.
"""
import copy, json, os, re, time, urllib.error, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UPSTREAM = 'https://api.anthropic.com'
PORT = int(os.environ.get('ANTHROPIC_SHIM_PORT') or 6074)
BETA = 'thinking-binding-controls-2026-08-01'
LOG = '/opt/agent/workspace/runs/anthropic-shim.jsonl'
FORWARD = ('x-api-key', 'authorization', 'anthropic-version', 'anthropic-beta', 'content-type', 'accept')


def log(rec):
    try:
        with open(LOG, 'a') as f:
            f.write(json.dumps({'ts': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), **rec}) + '\n')
    except OSError:
        pass


def add_binding(body, headers):
    th = body.get('thinking')
    if isinstance(th, dict) and th.get('type') not in (None, 'disabled'):
        th = dict(th)
        th['block_binding'] = {'prefix_mismatch_behavior': 'drop_block'}
        body['thinking'] = th
        betas = [b.strip() for b in (headers.get('anthropic-beta') or '').split(',') if b.strip()]
        if BETA not in betas:
            betas.append(BETA)
        headers['anthropic-beta'] = ','.join(betas)
        return True
    return False


def strip_thinking(body):
    """Drop thinking / redacted_thinking blocks from replayed history (Anthropic accepts history without them)."""
    out, n = [], 0
    for m in body.get('messages') or []:
        if isinstance(m, dict) and isinstance(m.get('content'), list):
            keep = [b for b in m['content'] if not (isinstance(b, dict) and b.get('type') in ('thinking', 'redacted_thinking'))]
            n += len(m['content']) - len(keep)
            if not keep:
                continue
            m = {**m, 'content': keep}
        out.append(m)
    body['messages'] = out
    return n


JOB_PATH_RE = re.compile(
    r"/workspace/jobs/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    r"(?:/helpers/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})*"
)
CWD_LINE_RE = re.compile(
    r"Your current working directory is: /workspace/jobs/"
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    r"(?:/helpers/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})*"
)
STABLE_CWD = "Your current working directory is the job folder named in your session context."
STABLE_PATH = "the job folder named in your session context"


def _rewrite_text(s):
    if not isinstance(s, str):
        return s, False
    n = s
    n2, c = CWD_LINE_RE.subn(STABLE_CWD, n)
    n3, c2 = JOB_PATH_RE.subn(STABLE_PATH, n2)
    return n3, (c + c2) > 0


def stabilize_tools(body):
    """Keep the cached tool prefix identical across jobs.

    OpenHands bakes the conversation working_dir into file_editor (and similar)
    descriptions. The real executor still uses the job folder; only the LLM-facing
    text is rewritten. Tool order and cache_control placement are left unchanged
    so OpenHands' breakpoints still cache tools+system as one prefix.
    """
    tools = body.get("tools")
    if not isinstance(tools, list) or not tools:
        return {"rewritten": 0, "sorted": False}

    def tool_name(t):
        if not isinstance(t, dict):
            return ""
        return str(t.get("name") or (t.get("function") or {}).get("name") or t.get("title") or "")

    rewritten = 0

    def walk(o):
        nonlocal rewritten
        if isinstance(o, dict):
            for k, v in list(o.items()):
                if isinstance(v, str):
                    nv, ch = _rewrite_text(v)
                    if ch:
                        o[k] = nv
                        rewritten += 1
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(tools)
    paths_left = len(JOB_PATH_RE.findall(json.dumps(tools, default=str)))
    return {
        "rewritten": rewritten,
        "sorted": False,
        "n_tools": len(tools),
        "names": [tool_name(t) for t in tools],
        "paths_left": paths_left,
    }



def _sha16(o):
    import hashlib
    return hashlib.sha256(json.dumps(o, sort_keys=True, default=str, separators=(",", ":")).encode()).hexdigest()[:16]


def _cache_map(body):
    """Locations of cache_control only (no bodies, no secrets)."""
    locs = []
    if isinstance(body.get("cache_control"), dict):
        locs.append({"at": "top", "cc": body.get("cache_control")})
    tools = body.get("tools") or []
    if isinstance(tools, list):
        for i, tool in enumerate(tools):
            if isinstance(tool, dict) and isinstance(tool.get("cache_control"), dict):
                locs.append({"at": "tool", "i": i, "name": tool.get("name"), "cc": tool.get("cache_control")})
    sys_ = body.get("system")
    if isinstance(sys_, list):
        for i, b in enumerate(sys_):
            if isinstance(b, dict) and isinstance(b.get("cache_control"), dict):
                locs.append({"at": "system", "i": i, "cc": b.get("cache_control")})
    elif isinstance(sys_, dict) and isinstance(sys_.get("cache_control"), dict):
        locs.append({"at": "system", "i": 0, "cc": sys_.get("cache_control")})
    for mi, m in enumerate(body.get("messages") or []):
        if not isinstance(m, dict):
            continue
        if isinstance(m.get("cache_control"), dict):
            locs.append({"at": "message", "i": mi, "role": m.get("role"), "cc": m.get("cache_control")})
        content = m.get("content")
        if isinstance(content, list):
            for bi, b in enumerate(content):
                if isinstance(b, dict) and isinstance(b.get("cache_control"), dict):
                    locs.append({"at": "message_block", "i": mi, "b": bi, "role": m.get("role"), "cc": b.get("cache_control")})
    return locs


CC_5M = {"type": "ephemeral", "ttl": "5m"}


def _set_cc(block):
    if not isinstance(block, dict):
        return False
    if block.get("cache_control") == CC_5M:
        return False
    block["cache_control"] = dict(CC_5M)
    return True


def stabilize_cache(body):
    """Write a cache entry at the end of tools and at the end of system.

    Anthropic prefixes are tools, then system, then messages. Unique clock,
    job-folder, intent, and memory live in messages; they must not share a
    breakpoint with system or the cross-job prefix misses. cache_prompt is
    false on stored system blocks, so OpenHands was not creating this break.
    Message-level cache_control is left in place for within-job turns.
    """
    added = []
    tools = body.get("tools")
    if isinstance(tools, list) and tools:
        last = tools[-1]
        if isinstance(last, dict) and _set_cc(last):
            added.append("last_tool")
        elif isinstance(last, dict) and last.get("cache_control"):
            added.append("last_tool_kept")
    sys_ = body.get("system")
    if isinstance(sys_, str):
        body["system"] = [{"type": "text", "text": sys_, "cache_control": dict(CC_5M)}]
        added.append("system_from_string")
    elif isinstance(sys_, list) and sys_:
        last = sys_[-1]
        if isinstance(last, str):
            sys_[-1] = {"type": "text", "text": last, "cache_control": dict(CC_5M)}
            added.append("system_from_last_string")
        elif isinstance(last, dict) and _set_cc(last):
            added.append("last_system")
        elif isinstance(last, dict) and last.get("cache_control"):
            added.append("last_system_kept")
    elif isinstance(sys_, dict) and _set_cc(sys_):
        added.append("system_dict")
    sys_now = body.get("system")
    return {
        "added": added,
        "cache_map": _cache_map(body),
        "tools_sha": _sha16(tools) if tools is not None else None,
        "system_sha": _sha16(sys_now) if sys_now is not None else None,
        "system_kind": type(sys_now).__name__,
        "n_system_blocks": len(sys_now) if isinstance(sys_now, list) else (1 if sys_now else 0),
        "n_messages": len(body.get("messages") or []),
    }


def is_thinking_error(text):

    t = (text or '').lower()
    return 'thinking' in t and ('bound to a different conversation' in t or 'invalid `signature`' in t or 'thinking.signature' in t)


def upstream(path, body, headers):
    req = urllib.request.Request(UPSTREAM + path, data=json.dumps(body).encode(), method='POST', headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=900) as r:
            return r.status, r.headers.get('Content-Type') or 'application/json', r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('Content-Type') or 'application/json', e.read()


class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *a):
        pass

    def reply(self, code, ctype, data):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == '/health':
            return self.reply(200, 'application/json', b'{"ok": true}')
        self.reply(404, 'application/json', b'{"error": "unknown path"}')

    def do_POST(self):
        path = self.path.split('?')[0]
        if not path.startswith('/v1/'):
            return self.reply(404, 'application/json', b'{"error": "only /v1/* is forwarded"}')
        try:
            raw = self.rfile.read(int(self.headers.get('Content-Length') or 0))
            body = json.loads(raw or b'{}')
        except Exception:
            return self.reply(400, 'application/json', b'{"error": "bad json"}')
        headers = {k: self.headers[k] for k in FORWARD if self.headers.get(k)}
        headers.setdefault('content-type', 'application/json')
        is_messages = path.rstrip('/').endswith('/v1/messages')
        bound = add_binding(body, headers) if is_messages else False
        stab = stabilize_tools(body) if is_messages else {}
        cache = stabilize_cache(body) if is_messages else {}
        code, ctype, data = upstream(path, body, headers)
        rec = {'path': path, 'model': body.get('model'), 'code': code, 'binding': bound,
               'tools_rewritten': stab.get('rewritten'), 'tools_sorted': stab.get('sorted'),
               'n_tools': stab.get('n_tools'), 'tool_names': stab.get('names'),
               'paths_left': stab.get('paths_left'),
               'cache_added': cache.get('added'), 'cache_map': cache.get('cache_map'),
               'tools_sha': cache.get('tools_sha'), 'system_sha': cache.get('system_sha'),
               'system_kind': cache.get('system_kind'), 'n_system_blocks': cache.get('n_system_blocks'),
               'n_messages': cache.get('n_messages')}
        if is_messages and code == 400 and is_thinking_error(data.decode('utf-8', 'replace')):
            first = data.decode('utf-8', 'replace')[:300]
            body2 = copy.deepcopy(body)
            rec['stripped_blocks'] = strip_thinking(body2)
            code, ctype, data = upstream(path, body2, headers)
            rec.update(retried=True, retry_code=code, first_error=first)
        log(rec)
        self.reply(code, ctype, data)


if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
