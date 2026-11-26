#!/usr/bin/env python3
# ops helper: call the local OpenHands API without printing the token.  oh.py METHOD PATH [json-body]
import json, sys, urllib.request, urllib.error
tok = next(l.split('=',1)[1].strip() for l in open('/opt/agent/.env') if l.startswith('AGENT_LAB_TOKEN='))
def api(method, path, body=None, timeout=120):
    r = urllib.request.Request('http://127.0.0.1:8000'+path, data=json.dumps(body).encode() if body is not None else None,
        method=method, headers={'X-Session-API-Key': tok, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read(); return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        return {'_http_error': e.code, 'body': e.read()[:2000].decode('utf-8','replace')}
def events(cid):
    out, page = [], None
    while True:
        q = 'limit=100&sort_order=TIMESTAMP' + (f'&page_id={page}' if page else '')
        d = api('GET', f'/api/conversations/{cid}/events/search?{q}'); out += d['items']; page = d.get('next_page_id')
        if not page: return out
if __name__ == '__main__':
    m, p = sys.argv[1], sys.argv[2]
    b = json.loads(sys.argv[3]) if len(sys.argv) > 3 else None
    print(json.dumps(api(m, p, b), indent=1)[:int(__import__('os').environ.get('MAXOUT','20000'))])
