#!/usr/bin/env python3
"""Create Agent Lab LLM profiles (lab-deepseek, lab-gemini, lab-openai). Never prints secrets."""
import json, os, stat, urllib.request, urllib.error
from pathlib import Path

ENV = Path('/opt/agent/.env')
OPENAI_FILE = Path('/opt/agent/secrets/openai.env')

def load_env(path):
    out = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith('#') or '=' not in s:
            continue
        k, v = s.split('=', 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out

env = load_env(ENV)
openai_env = load_env(OPENAI_FILE)
token = env.get('AGENT_LAB_TOKEN')
if not token:
    raise SystemExit('AGENT_LAB_TOKEN missing')
openai_key = openai_env.get('OPENAI_API_KEY') or env.get('OPENAI_API_KEY')
if openai_key and 'OPENAI_API_KEY' not in env:
    # Keep for future container restarts; do not restart now.
    with ENV.open('a') as f:
        f.write('\nOPENAI_API_KEY=' + openai_key + '\n')
    os.chmod(ENV, stat.S_IRUSR | stat.S_IWUSR)
    print('appended OPENAI_API_KEY to /opt/agent/.env (not loaded by running container)')

def api(method, path, body=None, headers=None, timeout=30):
    h = {'X-Session-API-Key': token, 'Content-Type': 'application/json'}
    if headers:
        h.update(headers)
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request('http://127.0.0.1:8000' + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8', 'replace')
        # strip possible secrets
        raise SystemExit(f'HTTP {e.code} {path}: {err[:240]}')

def drop_output_only(llm):
    llm = dict(llm or {})
    llm.pop('is_subscription', None)
    return llm

# Current DeepSeek settings (plaintext stays on this host)
status, settings = api('GET', '/api/settings', headers={'X-Expose-Secrets': 'plaintext'})
deepseek = drop_output_only((settings.get('agent_settings') or {}).get('llm') or {})
if not deepseek.get('model'):
    raise SystemExit('default llm missing')
print('default model', deepseek.get('model'), 'api_key_set', bool(deepseek.get('api_key')))

def save_profile(name, llm, model):
    cfg = drop_output_only(llm)
    cfg['model'] = model
    cfg['usage_id'] = name
    cfg['auth_type'] = cfg.get('auth_type') or 'api_key'
    status, out = api('POST', f'/api/profiles/{name}', {'llm': cfg, 'include_secrets': True})
    print(f'saved {name} status={status} model={model} api_key_set={bool(cfg.get("api_key"))}')

if not deepseek.get('api_key') and env.get('DEEPSEEK_API_KEY'):
    deepseek['api_key'] = env['DEEPSEEK_API_KEY']
save_profile('lab-deepseek', deepseek, 'deepseek/deepseek-v4-pro')

status, gem = api('GET', '/api/profiles/fallback-gemini', headers={'X-Expose-Secrets': 'plaintext'})
gemini = drop_output_only(gem.get('config') or {})
if not gemini.get('api_key'):
    # fall back to env
    gkey = env.get('GEMINI_API_KEY')
    if gkey:
        gemini = drop_output_only(deepseek)
        gemini['api_key'] = gkey
        gemini['base_url'] = None
    else:
        raise SystemExit('gemini key missing')
save_profile('lab-gemini', gemini, 'gemini/gemini-flash-latest')

if not openai_key:
    print('SKIP lab-openai: no OPENAI_API_KEY')
else:
    oai = drop_output_only(deepseek)
    oai['api_key'] = openai_key
    oai['base_url'] = None
    oai['auth_type'] = 'api_key'
    save_profile('lab-openai', oai, 'openai/gpt-5.5')

anthropic_key = env.get('ANTHROPIC_API_KEY')
if not anthropic_key:
    print('SKIP lab-anthropic: no ANTHROPIC_API_KEY')
else:
    ant = drop_output_only(deepseek)
    ant['api_key'] = anthropic_key
    ant['base_url'] = None
    ant['auth_type'] = 'api_key'
    save_profile('lab-anthropic', ant, 'anthropic/claude-haiku-5-5')

# Confirm list (no secrets)
status, listing = api('GET', '/api/profiles')
names = []
for p in listing.get('profiles') or []:
    names.append(p.get('name') if isinstance(p, dict) else str(p))
print('profiles', names)
