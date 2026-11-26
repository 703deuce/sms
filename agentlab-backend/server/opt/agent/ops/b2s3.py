#!/usr/bin/env python3
"""Minimal S3 (SigV4) client for the Agent Lab offsite backup on Backblaze B2. Stdlib only. Never prints credentials.
Reads /opt/agent/secrets/b2.env (S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY).
Every key is forced under PREFIX (agent-lab-backups/), so nothing else in the bucket can be touched.
  b2s3.py put FILE [NAME]     upload FILE as PREFIX/NAME
  b2s3.py list                list PREFIX objects (key size)
  b2s3.py get NAME OUT        download PREFIX/NAME
  b2s3.py prune KEEP          delete all but the newest KEEP agent-lab-*.tar.gz under PREFIX"""
import datetime, hashlib, hmac, os, sys, urllib.parse, urllib.request, xml.etree.ElementTree as ET
ENVF = os.environ.get('B2_ENV_FILE', '/opt/agent/secrets/b2.env')
PREFIX = 'agent-lab-backups/'
cfg = {}
for line in open(ENVF):
    if '=' in line and not line.lstrip().startswith('#'):
        k, v = line.strip().split('=', 1); cfg[k] = v.strip().strip('"').strip("'")
EP, REG, BUCKET = cfg['S3_ENDPOINT'].rstrip('/'), cfg['S3_REGION'], cfg.get('B2_BACKUP_BUCKET') or cfg['S3_BUCKET']
AK, SK = cfg['S3_ACCESS_KEY_ID'], cfg['S3_SECRET_ACCESS_KEY']
HOST = urllib.parse.urlparse(EP).netloc

def sign(k, m): return hmac.new(k, m.encode(), hashlib.sha256).digest()

def req(method, key='', query=None, body=b'', body_path=None, out_path=None):
    query = query or {}
    path = '/' + BUCKET + ('/' + urllib.parse.quote(key, safe='/-_.~') if key else '')
    qs = '&'.join(f"{urllib.parse.quote(k, safe='-_.~')}={urllib.parse.quote(str(v), safe='-_.~')}" for k, v in sorted(query.items()))
    now = datetime.datetime.now(datetime.timezone.utc)
    amz, day = now.strftime('%Y%m%dT%H%M%SZ'), now.strftime('%Y%m%d')
    if body_path:
        h = hashlib.sha256()
        with open(body_path, 'rb') as f:
            for c in iter(lambda: f.read(1 << 20), b''): h.update(c)
        ph, length = h.hexdigest(), os.path.getsize(body_path)
    else:
        ph, length = hashlib.sha256(body).hexdigest(), len(body)
    hdrs = {'host': HOST, 'x-amz-content-sha256': ph, 'x-amz-date': amz}
    sh = ';'.join(sorted(hdrs))
    creq = '\n'.join([method, path, qs, ''.join(f'{k}:{hdrs[k]}\n' for k in sorted(hdrs)), sh, ph])
    scope = f'{day}/{REG}/s3/aws4_request'
    sts = '\n'.join(['AWS4-HMAC-SHA256', amz, scope, hashlib.sha256(creq.encode()).hexdigest()])
    k = sign(sign(sign(sign(('AWS4' + SK).encode(), day), REG), 's3'), 'aws4_request')
    auth = f'AWS4-HMAC-SHA256 Credential={AK}/{scope}, SignedHeaders={sh}, Signature={hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()}'
    data = open(body_path, 'rb') if body_path else (body if method in ('PUT', 'POST') else None)
    r = urllib.request.Request(EP + path + ('?' + qs if qs else ''), data=data, method=method,
                               headers={'x-amz-content-sha256': ph, 'x-amz-date': amz, 'Authorization': auth,
                                        **({'Content-Length': str(length)} if method == 'PUT' else {})})
    try:
        with urllib.request.urlopen(r, timeout=600) as resp:
            if out_path:
                with open(out_path, 'wb') as f:
                    for c in iter(lambda: resp.read(1 << 20), b''): f.write(c)
                return b''
            return resp.read()
    except urllib.error.HTTPError as e:
        sys.exit(f'b2s3: {method} {key or "(list)"} failed: HTTP {e.code} {e.read()[:200]!r}')
    finally:
        if body_path: data.close()

def listing():
    out, token = [], None
    while True:
        q = {'list-type': '2', 'prefix': PREFIX}
        if token: q['continuation-token'] = token
        x = ET.fromstring(req('GET', query=q)); ns = {'s': x.tag.split('}')[0].strip('{')}
        out += [(c.find('s:Key', ns).text, int(c.find('s:Size', ns).text)) for c in x.findall('s:Contents', ns)]
        token = (x.find('s:NextContinuationToken', ns).text if x.find('s:NextContinuationToken', ns) is not None else None)
        if not token: return out

def name(n):
    n = os.path.basename(n)
    if not n or '..' in n: sys.exit('bad name')
    return PREFIX + n

a = sys.argv[1:]
if not a or a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
if a[0] == 'put':
    req('PUT', name(a[2] if len(a) > 2 else a[1]), body_path=a[1]); print(f'uploaded {name(a[2] if len(a) > 2 else a[1])}')
elif a[0] == 'list':
    for k, s in listing(): print(k, s)
elif a[0] == 'get':
    req('GET', name(a[1]), out_path=a[2]); print(f'downloaded {name(a[1])} -> {a[2]}')
elif a[0] == 'prune':
    keep = int(a[1]); arch = sorted(k for k, _ in listing() if os.path.basename(k).startswith('agent-lab-') and k.endswith('.tar.gz'))
    for k in arch[:-keep] if len(arch) > keep else []:
        assert k.startswith(PREFIX); req('DELETE', k); print(f'pruned {k}')
    print(f'{min(len(arch), keep)} offsite archives kept (max {keep})')
