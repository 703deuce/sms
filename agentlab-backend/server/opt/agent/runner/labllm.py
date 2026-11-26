"""labllm: one small Haiku call for runner-side checks (goal judge, learning review). Haiku only.
Also a tolerant JSON parser for the MODEL's reply (never applied to user text)."""
import json, os, time, urllib.request

HAIKU = (0.10, 0.50, 0.01, 0.125)  # $/M in, out, cache read, cache write (John's rates; same as skill_gate)
COST_LOG = '/opt/agent/runner/state/runner-llm.jsonl'


def model():
    try:
        m = json.load(open('/opt/agent/oh-home/profiles/lab-anthropic.json')).get('model') or ''
    except Exception:
        m = ''
    m = m.split('/', 1)[1] if m.startswith('anthropic/') else m
    return m if 'haiku' in m else 'claude-haiku-5-5'  # Haiku only, whatever the profile says


def call(system, user, max_tokens=600, timeout=40, purpose='', run_id=None):
    """Returns (text, info). Never raises: info['error'] is set instead."""
    body = {'model': model(), 'max_tokens': max_tokens, 'system': system,
            'messages': [{'role': 'user', 'content': user}]}
    info = {'model': body['model'], 'purpose': purpose}
    key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
    if not key:
        info['error'] = 'no ANTHROPIC_API_KEY in runner env'
        return '', info
    req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=json.dumps(body).encode(), method='POST',
                                 headers={'content-type': 'application/json', 'x-api-key': key,
                                          'anthropic-version': '2023-06-01'})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            res = json.loads(resp.read() or b'{}')
    except Exception as e:
        info['error'] = f'{type(e).__name__}: {str(e)[:200]}'
        return '', info
    u = res.get('usage') or {}
    i, o, cr, cw = HAIKU
    info['cost'] = round(((u.get('input_tokens') or 0) * i + (u.get('output_tokens') or 0) * o
                          + (u.get('cache_read_input_tokens') or 0) * cr
                          + (u.get('cache_creation_input_tokens') or 0) * cw) / 1e6, 6)
    info['tokens'] = [u.get('input_tokens'), u.get('output_tokens')]
    info['secs'] = round(time.time() - t0, 1)
    try:
        os.makedirs(os.path.dirname(COST_LOG), exist_ok=True)
        with open(COST_LOG, 'a') as f:
            f.write(json.dumps({'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'purpose': purpose, 'run': run_id,
                                'cost': info['cost'], 'tokens': info['tokens']}) + '\n')
    except OSError:
        pass
    return ''.join(b.get('text', '') for b in res.get('content') or [] if b.get('type') == 'text'), info


def parse_obj(txt):
    """Tolerant parse of a model reply that should be one JSON object: code fences, text around it, trailing junk.
    Returns a dict, or None when no object can be decoded."""
    t = (txt or '').strip()
    if t.startswith('```'):
        t = t.strip('`')
        nl = t.find('\n')
        t = t[nl + 1:] if nl != -1 else t
    i = t.find('{')
    while i >= 0:
        try:
            obj, _ = json.JSONDecoder().raw_decode(t[i:])
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass
        i = t.find('{', i + 1)
    return None


def off(name):
    """Kill switch: /opt/agent/runner/state/<NAME>_OFF or /opt/agent/tools/flags/<NAME>_OFF."""
    return any(os.path.exists(p) for p in (f'/opt/agent/runner/state/{name}_OFF', f'/opt/agent/tools/flags/{name}_OFF'))
