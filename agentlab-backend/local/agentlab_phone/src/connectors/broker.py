#!/usr/bin/env python3
"""AgentLab connector broker (host-only). One-click OAuth for Microsoft 365, Calendly, Salesforce, Zoho CRM using the
existing Transovo app registrations. Tokens stay on the host (/opt/agent/secrets/connectors); the agent and the phone
worker call APIs through POST /call/<provider> and never see a token.

Listens on 127.0.0.1:6081 (API) and PUBLIC_PORT (default 6082, callback only) for /oauth/<p>/callback.
"""
import json, os, secrets, threading, time, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import urllib.request

ENV = '/opt/agent/secrets/phone.env'
STORE = '/opt/agent/secrets/connectors'
PUBLIC_BASE = os.environ.get('CONNECT_PUBLIC_BASE', 'https://transovo.ai')
# Redirect URIs ALREADY registered with each provider for the prod Transovo app. A Traefik rule on the Coolify proxy sends only
# callbacks whose state starts with "agentlab." to this broker; everything else still reaches the prod app. Nothing new to register.
REDIRECT_PATHS = {'microsoft': '/api/integrations/microsoft/callback', 'salesforce': '/api/crm/salesforce/callback',
                  'zoho': '/api/crm/zoho/callback', 'calendly': '/api/integrations/native/calendly/callback'}
PKCE = {'salesforce', 'calendly'}


def env():
    d = {}
    for line in open(ENV):
        if '=' in line and not line.startswith('#'):
            k, v = line.rstrip('\n').split('=', 1)
            d[k] = v
    return d


E = env()
_B = 'openid profile offline_access User.Read Calendars.ReadWrite Contacts.Read Mail.ReadWrite Mail.Send Files.ReadWrite.All'
MS_SETS = {
    'calendar': 'openid profile offline_access User.Read Calendars.ReadWrite',
    'personal': _B + ' Tasks.ReadWrite',                                   # personal Microsoft accounts (outlook.com/hotmail/custom-domain MSA): calendar, mail, contacts, OneDrive, To Do
    'work': _B + ' Chat.ReadWrite ChatMessage.Send ChannelMessage.Send Team.ReadBasic.All Channel.ReadBasic.All OnlineMeetings.ReadWrite',   # work/school only; user-consentable Teams scopes
    'work-full': _B + ' Chat.ReadWrite ChatMessage.Send ChannelMessage.Send Team.ReadBasic.All Channel.ReadBasic.All OnlineMeetings.ReadWrite Sites.ReadWrite.All Bookings.ReadWrite.All',
}
TENANT = 'common'   # multi-tenant: any customer's Microsoft 365 org (John's verified publisher app)
PROVIDERS = {
    'microsoft': {
        'auth': f'https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/authorize',
        'token': f'https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token',
        'id': E.get('MICROSOFT_CLIENT_ID'), 'secret': E.get('MICROSOFT_CLIENT_SECRET'),
        'scope': 'openid profile email offline_access User.Read Calendars.ReadWrite Contacts.Read Mail.ReadWrite Mail.Send '
                 'Chat.ReadWrite ChannelMessage.Send Team.ReadBasic.All Channel.ReadBasic.All Files.ReadWrite.All Sites.ReadWrite.All '
                 'Bookings.ReadWrite.All',
        'base': 'https://graph.microsoft.com/v1.0', 'extra': {'prompt': 'select_account'}},
    'calendly': {
        'auth': 'https://auth.calendly.com/oauth/authorize', 'token': 'https://auth.calendly.com/oauth/token',
        'id': E.get('CALENDLY_CLIENT_ID'), 'secret': E.get('CALENDLY_CLIENT_SECRET'), 'scope': '',
        'base': 'https://api.calendly.com'},
    'salesforce': {
        'auth': 'https://login.salesforce.com/services/oauth2/authorize', 'token': 'https://login.salesforce.com/services/oauth2/token',
        'id': E.get('SALESFORCE_CLIENT_ID'), 'secret': E.get('SALESFORCE_CLIENT_SECRET'), 'scope': 'api refresh_token',
        'base': None},  # instance_url from token
    'zoho': {
        'auth': 'https://accounts.zoho.com/oauth/v2/auth', 'token': 'https://accounts.zoho.com/oauth/v2/token',
        'id': E.get('ZOHO_CLIENT_ID'), 'secret': E.get('ZOHO_CLIENT_SECRET'),
        'scope': 'ZohoCRM.modules.ALL,ZohoCRM.settings.READ,ZohoCRM.users.READ', 'base': None,
        'extra': {'access_type': 'offline', 'prompt': 'consent'}},
}
STATES = {}
LOCK = threading.Lock()


def redirect_uri(p):
    return PUBLIC_BASE + REDIRECT_PATHS[p]


def path(p):
    return os.path.join(STORE, f'{p}.json')


def load(p):
    try:
        return json.load(open(path(p)))
    except Exception:
        return None


def save(p, d):
    os.makedirs(STORE, mode=0o700, exist_ok=True)
    tmp = path(p) + '.tmp'
    with open(os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 'w') as f:
        json.dump(d, f)
    os.replace(tmp, path(p))


def post_form(url, data):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode(), method='POST',
                                 headers={'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def exchange(p, code, verifier=None, accounts_server=None):
    c = PROVIDERS[p]
    data = {'grant_type': 'authorization_code', 'code': code, 'redirect_uri': redirect_uri(p),
            'client_id': c['id'], 'client_secret': c['secret']}
    if verifier:
        data['code_verifier'] = verifier
    url = c['token']
    if p == 'zoho' and accounts_server and accounts_server.startswith('https://accounts.zoho.'):
        url = accounts_server.rstrip('/') + '/oauth/v2/token'
    tok = post_form(url, data)
    if 'access_token' not in tok:
        raise RuntimeError(str(tok.get('error_description') or tok.get('error') or tok)[:200])
    return store_token(p, tok, None)


def store_token(p, tok, old):
    d = dict(old or {})
    d['access_token'] = tok['access_token']
    if tok.get('refresh_token'):
        d['refresh_token'] = tok['refresh_token']
    d['expires_at'] = time.time() + int(tok.get('expires_in') or 3600) - 120
    if tok.get('scope'):
        d['scope'] = tok['scope']
    for k in ('instance_url', 'api_domain', 'owner', 'organization'):
        if tok.get(k):
            d[k] = tok[k]
    d['connected_at'] = d.get('connected_at') or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    save(p, d)
    return d


def token(p):
    with LOCK:
        d = load(p)
        if not d:
            raise RuntimeError(f'{p} is not connected')
        if time.time() < d.get('expires_at', 0):
            return d
        c = PROVIDERS[p]
        tok = post_form(c['token'], {'grant_type': 'refresh_token', 'refresh_token': d['refresh_token'],
                                     'client_id': c['id'], 'client_secret': c['secret']})
        return store_token(p, tok, d)


def api_call(p, method, pth, query=None, body=None, headers=None):
    d = token(p)
    base = PROVIDERS[p]['base'] or (d.get('instance_url') if p == 'salesforce' else (d.get('api_domain', 'https://www.zohoapis.com') + '/crm/v6'))
    url = base + pth + ('?' + urllib.parse.urlencode(query) if query else '')
    h = {'Authorization': ('Zoho-oauthtoken ' if p == 'zoho' else 'Bearer ') + d['access_token'], 'Accept': 'application/json'}
    h.update(headers or {})
    data = None
    if body is not None:
        data = json.dumps(body).encode(); h['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, method=method.upper(), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {'error': raw[:500].decode('utf-8', 'replace')}


def status():
    out = {}
    for p, c in PROVIDERS.items():
        d = load(p)
        out[p] = {'app_configured': bool(c['id'] and c['secret']), 'connected': bool(d),
                  'granted_scopes': (d or {}).get('scope'), 'connected_at': (d or {}).get('connected_at'),
                  'redirect_uri_to_register': redirect_uri(p)}
    return out


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, code, obj, html=False):
        b = (obj if html else json.dumps(obj)).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'text/html' if html else 'application/json')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def local(self):
        return self.server.server_address[0] == '127.0.0.1'

    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = dict(urllib.parse.parse_qsl(u.query))
        parts = u.path.strip('/').split('/')
        cb = [k for k, v in REDIRECT_PATHS.items() if v == u.path]
        if cb:
            p = cb[0]
            print('callback', p, {k: (v[:200] if k != 'code' else '<code>') for k, v in q.items() if k != 'state'}, 'state_known', q.get('state', '') in STATES, flush=True)
            st = STATES.pop(q.get('state', ''), None)
            if not st or st['p'] != p or time.time() - st['t'] > 900:
                return self.reply(400, '<h3>Sign-in link expired. Ask the agent for a new one.</h3>', True)
            if 'code' not in q:
                import html as _h
                det = ' / '.join(_h.escape(str(q[k])[:300]) for k in ('error', 'error_subcode', 'error_description') if q.get(k))
                return self.reply(400, f"<h3>Sign-in was not completed: {det or 'no details returned'}</h3>", True)
            try:
                d = exchange(p, q['code'], st.get('v'), q.get('accounts-server'))
            except Exception as e:
                return self.reply(500, f'<h3>Could not finish connecting {p}: {str(e)[:200]}</h3>', True)
            return self.reply(200, f'<h3>{p.title()} is connected to AgentLab. You can close this tab.</h3><p>Granted: {d.get("scope","")}</p>', True)
        if not self.local():
            return self.reply(404, {'error': 'not found'})
        if u.path == '/status':
            return self.reply(200, status())
        if parts[:1] == ['connect'] and len(parts) == 2 and parts[1] in PROVIDERS:
            p = parts[1]; c = PROVIDERS[p]
            s = 'agentlab.' + secrets.token_urlsafe(24); STATES[s] = {'p': p, 't': time.time()}
            params = {'client_id': c['id'], 'response_type': 'code', 'redirect_uri': redirect_uri(p), 'state': s}
            if c['scope']:
                params['scope'] = c['scope']
            auth = c['auth']
            if p == 'microsoft' and q.get('scope') in MS_SETS:   # named scope sets (see MS_SETS); default = everything the app may ask for
                params['scope'] = MS_SETS[q['scope']]
                if q['scope'].startswith('work'):
                    auth = auth.replace('/common/', '/organizations/')   # work/school (Entra ID) accounts only: Teams, SharePoint, Bookings do not exist for personal accounts
            params.update(c.get('extra') or {})
            if p in PKCE:
                import base64, hashlib
                v = secrets.token_urlsafe(48); STATES[s]['v'] = v
                params['code_challenge'] = base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).rstrip(b'=').decode()
                params['code_challenge_method'] = 'S256'
            return self.reply(200, {'url': auth + '?' + urllib.parse.urlencode(params), 'expires_in_s': 900})
        return self.reply(404, {'error': 'not found'})

    def do_POST(self):
        if not self.local():
            return self.reply(404, {'error': 'not found'})
        parts = self.path.strip('/').split('/')
        n = int(self.headers.get('Content-Length') or 0)
        try:
            b = json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return self.reply(400, {'error': 'bad json'})
        if parts[:1] == ['call'] and len(parts) == 2 and parts[1] in PROVIDERS:
            try:
                code, data = api_call(parts[1], b.get('method', 'GET'), b.get('path', '/'), b.get('query'), b.get('body'), b.get('headers'))
            except Exception as e:
                return self.reply(409, {'error': str(e)[:300]})
            return self.reply(200, {'status': code, 'data': data})
        if parts[:1] == ['disconnect'] and len(parts) == 2 and parts[1] in PROVIDERS:
            try:
                os.remove(path(parts[1]))
            except FileNotFoundError:
                pass
            return self.reply(200, {'ok': True})
        return self.reply(404, {'error': 'not found'})


if __name__ == '__main__':
    api_srv = ThreadingHTTPServer(('127.0.0.1', 6081), H)
    pub = ThreadingHTTPServer((os.environ.get('PUBLIC_BIND', '0.0.0.0'), int(os.environ.get('PUBLIC_PORT', '6082'))), H)
    threading.Thread(target=pub.serve_forever, daemon=True).start()
    api_srv.serve_forever()
