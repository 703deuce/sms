#!/usr/bin/env python3
"""agent-lab-keys: holds paid/outside API keys on the host so the agent never sees them.
Listens on 127.0.0.1:6071. Keys come from systemd EnvironmentFile (root-only files).
KIE:  POST /kie/upload {base64Data,fileName} | POST /kie/create {model,input} | GET /kie/record?taskId= | GET /kie/credits
Mail: GET /mail/address | GET /mail/messages?limit=&page_token= | GET /mail/message?id= |
      POST /mail/send {to,cc?,subject,text,html?,attachments?} (recipients must be in MAIL_ALLOW_TO) |
      POST /mail/reply {message_id,text,html?,attachments?} (reply to a message in this inbox; no reply-all) | GET /mail/sendlog
attachments: list of {filename, content (base64), content_type?}. Never silently dropped: missing/invalid/too large returns an error and is not sent. Inline limit 6 MB (AgentMail).
Anthropic: POST /anthropic/messages {model,messages,max_tokens,system?,purpose?,conversation_id?,job?} (Opus sub-calls only; the key is never returned).
Every KIE create, Anthropic sub-call, and mail send/reply is appended to $STATE_DIRECTORY/*.jsonl. No automatic retries.
"""
import base64, json, os, re, time, urllib.parse, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

KIE_KEY = os.environ.get('KIE_API_KEY', '').strip()
KIE = 'https://api.kie.ai'
KIE_UP = 'https://kieai.redpandaai.co'
AM_KEY = os.environ.get('AGENTMAIL_API_KEY', '').strip()
AM = 'https://api.agentmail.to/v0'
INBOX = os.environ.get('AGENTMAIL_INBOX', '').strip()
ALLOW = {a.strip().lower() for a in os.environ.get('MAIL_ALLOW_TO', '').split(',') if a.strip()}
STATE = os.environ.get('STATE_DIRECTORY', '/var/lib/agent-lab-keys')

# --- inserted by 2026-11-24-routing-enforce ---
ANTHROPIC_KEY = os.environ.get('ANTHROPIC_API_KEY', '').strip()
ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
ANTHROPIC_VERSION = '2023-06-01'
# List prices (USD / token), Claude API standard. Opus 5.5: 2026-10-22. Fable 5.2: $8 in / $40 out / $0.20 cache read;
# its 5-minute cache-write price is assumed at 1.25x input ($10) until confirmed.
OPUS_PRICES = {
    'input': 4.00 / 1_000_000,
    'output': 20.00 / 1_000_000,
    'cache_write_5m': 5.00 / 1_000_000,
    'cache_read': 0.20 / 1_000_000,
}
FABLE_PRICES = {
    'input': 8.00 / 1_000_000,
    'output': 40.00 / 1_000_000,
    'cache_write_5m': 10.00 / 1_000_000,
    'cache_read': 0.20 / 1_000_000,
}
ALLOWED_FAMILIES = ('opus', 'fable', 'sonnet')  # routing sub-calls only go to the strong models
# 2026-11-26 Sonnet 5.5 is reachable ONLY via sonnet-assist / code-rescue, never as a job model.
SONNET_PRICES = {
    'input': 2.00 / 1_000_000,
    'output': 10.00 / 1_000_000,
    'cache_write_5m': 2.50 / 1_000_000,
    'cache_read': 0.10 / 1_000_000,
}
RESCUE_MAX_REQ_CHARS = 90000     # about 22k input tokens of TEXT; image payloads counted separately
RESCUE_MAX_OUT = 8000
ASSIST_MODES = ('code', 'visual', 'plan', 'math', 'legal')
ALLOWED_SONNET_PURPOSES = frozenset({'code-rescue'} | {f'sonnet-assist:{m}' for m in ASSIST_MODES})
MAX_ASSIST_IMAGES = 4
MAX_ASSIST_IMAGE_BYTES = 4_000_000


def prices_for(model):
    m = str(model or '').lower()
    if 'sonnet' in m:
        return SONNET_PRICES
    return FABLE_PRICES if 'fable' in m else OPUS_PRICES


def root_job(body):
    s = str(body.get('job') or '')
    m = re.search(r'/jobs/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', s)
    return m.group(1) if m else (str(body.get('conversation_id') or '') or None)


def assist_mode(purpose):
    p = str(purpose or '')
    if p == 'code-rescue':
        return 'code'
    if p.startswith('sonnet-assist:') and p.split(':', 1)[1] in ASSIST_MODES:
        return p.split(':', 1)[1]
    return None


def iter_blocks(messages):
    for m in messages or []:
        if not isinstance(m, dict):
            continue
        c = m.get('content')
        if isinstance(c, str):
            yield {'type': 'text', 'text': c}
        elif isinstance(c, list):
            for b in c:
                if isinstance(b, dict):
                    yield b


def text_chars(body):
    n = len(str(body.get('system') or ''))
    for b in iter_blocks(body.get('messages')):
        if b.get('type') == 'image':
            continue
        n += len(str(b.get('text') or ''))
    return n


def image_stats(body):
    n = total = 0
    for b in iter_blocks(body.get('messages')):
        if b.get('type') != 'image':
            continue
        n += 1
        data = ((b.get('source') or {}).get('data') or '')
        total += (len(data) * 3) // 4
    return n, total


def rescue_check(body):
    """Return an error string if this Sonnet call is not allowed, else None. No per-job or daily call cap; plan usage is the limit."""
    purpose = str(body.get('purpose') or '')
    mode = assist_mode(purpose)
    if mode is None:
        return 'sonnet is only available to sonnet-assist (purpose=sonnet-assist:<code|visual|plan|math|legal> or code-rescue)'
    if not root_job(body):
        return 'sonnet-assist needs a job id (run it from the job folder)'
    if text_chars(body) > RESCUE_MAX_REQ_CHARS:
        return 'sonnet-assist context too large: send only the relevant snippets'
    n_img, img_bytes = image_stats(body)
    if mode != 'visual' and n_img:
        return 'images are only allowed for sonnet-assist --mode visual'
    if mode == 'visual' and n_img < 1:
        return 'visual mode needs at least one image'
    if n_img > MAX_ASSIST_IMAGES:
        return f'too many images (max {MAX_ASSIST_IMAGES})'
    if img_bytes > MAX_ASSIST_IMAGE_BYTES:
        return 'images too large (max 4 MB total)'
    return None


def anthropic_cost(usage, model=None):
    usage = usage or {}
    p = prices_for(model)
    return round(
        int(usage.get('input_tokens') or 0) * p['input']
        + int(usage.get('output_tokens') or 0) * p['output']
        + int(usage.get('cache_creation_input_tokens') or 0) * p['cache_write_5m']
        + int(usage.get('cache_read_input_tokens') or 0) * p['cache_read'],
        6,
    )


def anthropic_messages(body, timeout=180):
    """Forward a Messages request. The key never appears in the response or the state log."""
    if not ANTHROPIC_KEY:
        return 503, {'error': 'ANTHROPIC_API_KEY is not configured on the key proxy'}
    model = str(body.get('model') or 'claude-opus-5-5')
    if model.startswith('anthropic/'):
        model = model.split('/', 1)[1]
    # Only the strong models (this endpoint exists for routing sub-calls). Refuse other models.
    if not any(f in model.lower() for f in ALLOWED_FAMILIES):
        return 400, {'error': 'this endpoint is only for Opus / Fable sub-calls'}
    is_sonnet = 'sonnet' in model.lower()
    if is_sonnet:
        err = rescue_check(body)
        if err:
            log('anthropic-messages.jsonl', {'purpose': body.get('purpose'), 'model': model, 'code': 429,
                                             'blocked': err, 'root_job': root_job(body), 'job': body.get('job')})
            return 429, {'error': err}
    return _anthropic_messages_inner(body, model, timeout)


def _anthropic_messages_inner(body, model, timeout):
    is_sonnet = 'sonnet' in model.lower()
    payload = {
        'model': model,
        'max_tokens': min(int(body.get('max_tokens') or 2500), RESCUE_MAX_OUT) if is_sonnet else int(body.get('max_tokens') or 2500),
        'messages': body.get('messages') or [],
    }
    if body.get('system'):
        payload['system'] = body['system']
    payload['output_config'] = {'effort': (body.get('effort') if is_sonnet and body.get('effort') in ('low', 'medium', 'high') else 'low')}
    data = json.dumps(payload).encode()
    req = urllib.request.Request(ANTHROPIC_API, data=data, method='POST', headers={
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            res = json.loads(r.read() or b'{}')
            status = r.status
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read() or b'{}')
        except Exception:
            err = {'error': f'anthropic HTTP {e.code}'}
        # Never include request headers or the key.
        return e.code, {'error': (err.get('error') or err)}
    except Exception as e:
        return 502, {'error': f'anthropic request failed: {type(e).__name__}'}
    text = ''
    thinking = ''
    for block in res.get('content') or []:
        if not isinstance(block, dict):
            continue
        if block.get('type') == 'text':
            text += block.get('text') or ''
        elif block.get('type') in ('thinking', 'reasoning'):
            thinking += block.get('thinking') or block.get('text') or ''
    if not text and thinking:
        text = thinking
    usage = res.get('usage') or {}
    # Keep only token counts (no raw payload).
    usage_out = {k: int(usage[k]) for k in (
        'input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'
    ) if usage.get(k) is not None}
    cost = anthropic_cost(usage_out, model)
    log('anthropic-messages.jsonl', {
        'purpose': body.get('purpose'),
        'model': model,
        'code': status,
        'usage': usage_out,
        'cost_usd': cost,
        'conversation_id': body.get('conversation_id'),
        'job': body.get('job'),
        'root_job': root_job(body) if is_sonnet else None,
        'mode': assist_mode(body.get('purpose')) if is_sonnet else None,
        'n_images': image_stats(body)[0] if is_sonnet else 0,
        'chars': len(text),
    })
    return status, {'text': text, 'usage': usage_out, 'cost_usd': cost, 'model': 'anthropic/' + model}
# --- end insert ---



def log(name, rec):
    rec = {'ts': time.strftime('%Y-%m-%dT%H:%M:%S%z'), **rec}
    with open(os.path.join(STATE, name), 'a') as f:
        f.write(json.dumps(rec) + '\n')


def call(method, url, key, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'User-Agent': 'agent-lab-keys'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {'error': raw.decode('utf-8', 'replace')[:500]}


def addrs(v):
    if not v:
        return []
    if isinstance(v, str):
        v = v.split(',')
    out = []
    for a in v:
        m = re.search(r'[^<>\s,]+@[^<>\s,]+', str(a))
        if m:
            out.append(m.group(0).lower())
    return out



MAX_INLINE = 5_500_000  # leave headroom under AgentMail's 6 MB request limit


def normalize_attachments(raw):
    """Return (error, list). error is a clear string if attachments cannot be sent."""
    if raw is None or raw == []:
        return None, []
    if not isinstance(raw, list):
        return "attachments must be a list of {filename, content (base64), content_type?}; not sent", []
    out = []
    for i, a in enumerate(raw):
        if not isinstance(a, dict):
            return f"attachment {i} must be an object; not sent", []
        fn = a.get("filename") or a.get("name")
        content = a.get("content")
        ctype = a.get("content_type") or a.get("contentType")
        if not fn or not content:
            return f"attachment {i} needs filename and base64 content; not sent", []
        if not isinstance(content, str):
            return f"attachment {fn}: content must be a base64 string; not sent", []
        try:
            data = base64.b64decode(content, validate=True)
        except Exception:
            return f"attachment {fn}: content is not valid base64; not sent", []
        if not data:
            return f"attachment {fn} is empty; not sent", []
        item = {"filename": str(fn), "content": content}
        if ctype:
            item["content_type"] = str(ctype)
        out.append(item)
    return None, out


def mid(i):
    return urllib.parse.quote(i, safe='')


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n) or b'{}') if n else {}

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        p = u.path
        if p == '/kie/record':
            return self.send(*call('GET', f"{KIE}/api/v1/jobs/recordInfo?taskId={urllib.parse.quote(q.get('taskId', ''))}", KIE_KEY))
        if p == '/kie/credits':
            return self.send(*call('GET', f"{KIE}/api/v1/chat/credit", KIE_KEY))
        if p == '/mail/address':
            return self.send(200, {'address': INBOX, 'send_allowed_to': sorted(ALLOW), 'replies': 'allowed to messages in this inbox'})
        if p == '/mail/messages':
            qs = urllib.parse.urlencode({k: q[k] for k in ('limit', 'page_token', 'after') if k in q})
            return self.send(*call('GET', f"{AM}/inboxes/{mid(INBOX)}/messages?{qs}", AM_KEY))
        if p == '/mail/message':
            return self.send(*call('GET', f"{AM}/inboxes/{mid(INBOX)}/messages/{mid(q.get('id', ''))}", AM_KEY))
        if p == '/mail/sendlog':
            f = os.path.join(STATE, 'mail-sends.jsonl')
            lines = open(f).read().splitlines()[-int(q.get('n', 50)):] if os.path.exists(f) else []
            return self.send(200, {'sends': [json.loads(x) for x in lines]})
        self.send(404, {'error': 'unknown path'})

    def do_POST(self):
        p = urllib.parse.urlparse(self.path).path
        try:
            b = self.body()
        except Exception:
            return self.send(400, {'error': 'bad json'})
        if p == '/kie/upload':
            return self.send(*call('POST', f"{KIE_UP}/api/file-base64-upload", KIE_KEY,
                                   {'base64Data': b.get('base64Data'), 'uploadPath': 'agent-lab',
                                    'fileName': b.get('fileName') or 'ref.png'}))
        if p == '/kie/create':
            body = {'model': b.get('model'), 'input': b.get('input') or {}}
            code, res = call('POST', f"{KIE}/api/v1/jobs/createTask", KIE_KEY, body)
            log('kie-tasks.jsonl', {'model': body['model'], 'code': code, 'api_code': res.get('code'),
                                    'taskId': (res.get('data') or {}).get('taskId'), 'by': b.get('by')})
            return self.send(code, res)
        if p == '/mail/send':
            rcpt = addrs(b.get('to')) + addrs(b.get('cc')) + addrs(b.get('bcc'))
            bad = [a for a in rcpt if a not in ALLOW]
            if not rcpt or bad:
                log('mail-sends.jsonl', {'kind': 'send', 'blocked': True, 'to': rcpt, 'subject': b.get('subject'), 'by': b.get('by')})
                return self.send(403, {'error': f"sending is limited to replies and to {sorted(ALLOW)}; blocked: {bad or 'no recipient'}"})
            body = {k: b[k] for k in ('to', 'cc', 'bcc', 'subject', 'text', 'html') if b.get(k)}
            err, atts = normalize_attachments(b.get('attachments'))
            if err:
                log('mail-sends.jsonl', {'kind': 'send', 'blocked': True, 'error': err, 'to': rcpt, 'subject': b.get('subject'), 'by': b.get('by')})
                return self.send(400, {'error': err})
            if atts:
                body['attachments'] = atts
            payload = json.dumps(body).encode()
            if len(payload) > MAX_INLINE:
                err = (f"attachments make the request {len(payload)} bytes; AgentMail inline "
                       "limit is 6 MB. Not sent. Use a smaller file.")
                log('mail-sends.jsonl', {'kind': 'send', 'blocked': True, 'error': err, 'to': rcpt, 'subject': b.get('subject'),
                                          'attachments': [a['filename'] for a in atts], 'by': b.get('by')})
                return self.send(413, {'error': err})
            code, res = call('POST', f"{AM}/inboxes/{mid(INBOX)}/messages/send", AM_KEY, body)
            log('mail-sends.jsonl', {'kind': 'send', 'to': rcpt, 'subject': b.get('subject'), 'chars': len(b.get('text') or ''),
                                     'attachments': [a['filename'] for a in atts], 'code': code,
                                     'message_id': res.get('message_id'), 'by': b.get('by')})
            if code == 200 and atts:
                res = dict(res or {})
                res['attachments_sent'] = [a['filename'] for a in atts]
            return self.send(code, res)
        if p == '/mail/reply':
            m = b.get('message_id') or ''
            code0, orig = call('GET', f"{AM}/inboxes/{mid(INBOX)}/messages/{mid(m)}", AM_KEY)
            if code0 != 200:
                return self.send(404, {'error': 'message not found in this inbox', 'detail': orig})
            body = {k: b[k] for k in ('text', 'html') if b.get(k)}
            err, atts = normalize_attachments(b.get('attachments'))
            if err:
                log('mail-sends.jsonl', {'kind': 'reply', 'blocked': True, 'error': err, 'in_reply_to': m, 'by': b.get('by')})
                return self.send(400, {'error': err})
            if atts:
                body['attachments'] = atts
            payload = json.dumps(body).encode()
            if len(payload) > MAX_INLINE:
                err = (f"attachments make the request {len(payload)} bytes; AgentMail inline "
                       "limit is 6 MB. Not sent. Use a smaller file.")
                log('mail-sends.jsonl', {'kind': 'reply', 'blocked': True, 'error': err, 'in_reply_to': m,
                                          'attachments': [a['filename'] for a in atts], 'by': b.get('by')})
                return self.send(413, {'error': err})
            code, res = call('POST', f"{AM}/inboxes/{mid(INBOX)}/messages/{mid(m)}/reply", AM_KEY, body)
            log('mail-sends.jsonl', {'kind': 'reply', 'in_reply_to': m, 'to': addrs(orig.get('from')) or addrs(orig.get('reply_to')),
                                     'subject': orig.get('subject'), 'chars': len(b.get('text') or ''),
                                     'attachments': [a['filename'] for a in atts], 'code': code,
                                     'message_id': res.get('message_id'), 'by': b.get('by')})
            if code == 200 and atts:
                res = dict(res or {})
                res['attachments_sent'] = [a['filename'] for a in atts]
            return self.send(code, res)
        if p == '/anthropic/messages':
            return self.send(*anthropic_messages(b))
        self.send(404, {'error': 'unknown path'})


if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 6071), H).serve_forever()
