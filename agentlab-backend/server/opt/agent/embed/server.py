#!/usr/bin/env python3
"""Search service for read_section --find: hybrid (BM25 + local embeddings + RRF + small cross-encoder rerank).
Runs on the host (127.0.0.1:6075), free and self-hosted: fastembed (ONNX, CPU) models, SQLite FTS5 + vectors in SQLite.
Indexes skills, job folders and user doc folders: docs by heading (path header on every chunk), code by function/class.
Reindexes only files whose sha1 changed. Paths are returned in the container's namespace (/workspace/...)."""
import json, os, re, sqlite3, sys, threading, time, hashlib, traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import numpy as np
sys.path.insert(0, '/opt/agent/tools')
os.environ.setdefault('SECLIB_CACHE', '/opt/agent/embed/cache')
import seclib

HOST_WS, CT_WS = '/opt/agent/workspace', '/workspace'
DB = '/opt/agent/embed/index.db'
ROOTS_FILE = '/opt/agent/embed/roots.txt'
MODEL = os.environ.get('EMBED_MODEL', 'nomic-ai/nomic-embed-text-v1.5-Q')
RERANK = os.environ.get('RERANK_MODEL', 'Xenova/ms-marco-MiniLM-L-6-v2')
PORT = int(os.environ.get('EMBED_PORT', '6075'))
SKIP_DIRS = {'node_modules', '.git', '__pycache__', 'venv', '.venv', 'dist', 'build', 'compiled', 'frames', 'view', 'visuals', 'work', 'out', 'assets',
             'target', 'vendor', '.tox', 'coverage', 'site-packages', '.next', '.mypy_cache', '.pytest_cache', 'log', 'helpers'}
# Code roots (a repo inside a job folder) are indexed explicitly; SKIP_DIRS applies only BELOW the root being walked,
# so a repo copied to out/<repo> is indexed when it is registered as a root. Roots unused for JOBROOT_TTL are dropped.
JOBROOT_TTL = 7 * 86400
PROJECT_MARKERS = ('pyproject.toml', 'setup.py', 'setup.cfg', 'package.json', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle',
                   'Gemfile', 'composer.json', 'CMakeLists.txt', 'Makefile', 'tsconfig.json', 'requirements.txt')
MAX_ROOT_FILES = 3000
MAX_DATA_BYTES = 300_000   # json/yaml/toml bigger than this are data, not code
REINDEX_LOCK = threading.Lock()
MAX_BYTES = 4_000_000
LOCK = threading.RLock()
_emb = _rr = None
_mat = None  # (ids, matrix)


def models():
    global _emb, _rr
    if _emb is None:
        os.environ.setdefault('FASTEMBED_CACHE_PATH', '/opt/agent/embed/models')
        from fastembed import TextEmbedding
        _emb = TextEmbedding(MODEL, threads=2)
    return _emb


def reranker():
    global _rr
    if _rr is None:
        from fastembed.rerank.cross_encoder import TextCrossEncoder
        _rr = TextCrossEncoder(RERANK, threads=2)
    return _rr


def pref(kind):
    if 'nomic' in MODEL: return 'search_query: ' if kind == 'q' else 'search_document: '
    if 'Qwen3' in MODEL and kind == 'q': return 'Instruct: Given a question, retrieve the passage that answers it\nQuery: '
    return ''


EMBED_CHARS = 1500   # ~500 tokens: long inputs make ONNX attention memory explode (the 8 GB box OOM-killed the service)


def embed(texts, kind):
    v = np.array(list(models().embed([pref(kind) + t[:EMBED_CHARS] for t in texts], batch_size=4)), dtype=np.float32)
    n = np.linalg.norm(v, axis=1, keepdims=True); n[n == 0] = 1
    return v / n


def db():
    c = sqlite3.connect(DB, timeout=60, check_same_thread=False)
    c.execute('PRAGMA journal_mode=WAL')
    c.executescript('''CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, sha TEXT, mtime REAL, size INT, nchunks INT);
      CREATE TABLE IF NOT EXISTS chunks(id INTEGER PRIMARY KEY, path TEXT, a INT, b INT, heading TEXT, kind TEXT, text TEXT, vec BLOB);
      CREATE INDEX IF NOT EXISTS chunks_path ON chunks(path);
      CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(heading, text, path, tokenize="porter unicode61");
      CREATE TABLE IF NOT EXISTS jobroots(path TEXT PRIMARY KEY, last_used REAL);
      CREATE TABLE IF NOT EXISTS emb_cache(h TEXT PRIMARY KEY, vec BLOB);''')
    return c


def roots():
    r = [HOST_WS + '/skills']
    try:
        r += [x.strip() for x in open(ROOTS_FILE) if x.strip() and os.path.isdir(x.strip())]
    except OSError: pass
    try:   # code roots registered by codesearch / read_section --find / repo discovery, still in use
        c = db()
        r += [p for (p,) in c.execute('SELECT path FROM jobroots WHERE last_used > ?', (time.time() - JOBROOT_TTL,)) if os.path.isdir(p)]
        c.close()
    except Exception: pass
    return r


def register_root(path):
    c = db(); c.execute('INSERT OR REPLACE INTO jobroots VALUES (?,?)', (path, time.time())); c.commit(); c.close()


def discover_repos(max_age=2 * 3600):
    """Code projects inside recently active job folders (project marker files at depth 1-3, or code at the top). Registered as roots
    so the 90 s loop indexes a checkout soon after a job creates it, before the agent even asks."""
    base = HOST_WS + '/jobs'; found = []
    try: jobs = [os.path.join(base, j) for j in os.listdir(base)]
    except OSError: return found
    now = time.time()
    for j in jobs:
        try:
            if now - os.path.getmtime(j) > max_age: continue
        except OSError: continue
        for dp, dn, fn in os.walk(j):
            depth = dp[len(j):].count('/')
            dn[:] = [d for d in dn if not d.startswith('.') and d not in ('node_modules', 'log', 'venv', '.venv', '__pycache__', 'dist', 'build', 'frames', 'helpers')]
            if depth >= 3: dn[:] = []
            if dp != j and any(m in fn for m in PROJECT_MARKERS):
                found.append(dp); dn[:] = []   # the project root; do not look for nested ones
    for p in found:
        c = db()
        if not c.execute('SELECT 1 FROM jobroots WHERE path=?', (p,)).fetchone():
            c.execute('INSERT INTO jobroots VALUES (?,?)', (p, now)); c.commit()
        c.close()
    return found


def wanted(root, dp, f):
    ext = os.path.splitext(f)[1].lower()
    if ext not in seclib.DOC_EXTS + seclib.CODE_EXTS: return False
    if f.lower().endswith(('.min.js', '.lock', '.min.css', '.map')) or f in ('package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'): return False
    if ext in ('.json', '.yaml', '.yml', '.toml'):
        try:
            if os.path.getsize(os.path.join(dp, f)) > MAX_DATA_BYTES: return False
        except OSError: return False
    return True


def walk(rs):
    for root in rs:
        is_sk = root == HOST_WS + '/skills'
        for dp, dn, fn in os.walk(root):
            dn[:] = [d for d in dn if not d.startswith('.') and d not in SKIP_DIRS]
            if is_sk and dp == root:   # a skill folder without SKILL.md is disabled
                dn[:] = [d for d in dn if os.path.isfile(os.path.join(root, d, 'SKILL.md'))]
            for f in fn:
                p = os.path.join(dp, f)
                if not wanted(root, dp, f): continue
                try:
                    if os.path.getsize(p) > MAX_BYTES: continue
                except OSError: continue
                yield p


def ct(p): return CT_WS + p[len(HOST_WS):] if p.startswith(HOST_WS) else p


def reindex(rs=None, log=None):
    with REINDEX_LOCK:
        return _reindex(rs, log)


def _reindex(rs=None, log=None):
    global _mat
    explicit = rs is not None
    c = db(); rs = rs or roots(); seen = set(); new = upd = 0; t0 = time.time()
    todo = []
    per_root = {}
    for p in walk(rs):
        rt = next((x for x in rs if p.startswith(x.rstrip('/') + '/')), '')
        per_root[rt] = per_root.get(rt, 0) + 1
        if per_root[rt] > MAX_ROOT_FILES and rt != HOST_WS + '/skills': continue
        seen.add(p)
        try: st = os.stat(p)
        except OSError: continue
        row = c.execute('SELECT sha,mtime,size FROM files WHERE path=?', (p,)).fetchone()
        if row and row[1] == st.st_mtime and row[2] == st.st_size: continue
        try: sha = seclib.sha1(p)
        except OSError: continue
        if row and row[0] == sha:
            c.execute('UPDATE files SET mtime=?, size=? WHERE path=?', (st.st_mtime, st.st_size, p)); continue
        todo.append((p, sha, st))
    # drop deleted files
    allr = roots() if explicit else rs
    gone = [r[0] for r in c.execute('SELECT path FROM files') if r[0] not in seen and (any(r[0].startswith(x.rstrip('/') + '/') for x in rs) or not any(r[0].startswith(x.rstrip('/') + '/') for x in allr))]
    for p in gone: drop(c, p)
    for p, sha, st in todo:
        try:
            ch = seclib.chunk_code(p) if os.path.splitext(p)[1].lower() in seclib.CODE_EXTS else seclib.chunk_doc(p)
        except Exception:
            ch = []
        ch = [(a, b, h, tx[:4000]) for a, b, h, tx in ch if tx.strip()][:400]
        drop(c, p)
        if ch:
            kind = 'code' if os.path.splitext(p)[1].lower() in seclib.CODE_EXTS else 'doc'
            texts = [f'{ct(p)} :: {h}\n{t}' for a, b, h, t in ch]
            # Embeddings are cached by chunk CONTENT (path-independent, like Cursor): a repo copied into another job folder,
            # or a file where only a few functions changed, re-embeds only the chunks that are actually new.
            keys = [hashlib.sha1(f'{MODEL}|{h}\n{t[:EMBED_CHARS]}'.encode()).hexdigest() for a, b, h, t in ch]
            got = {}
            for i in range(0, len(keys), 500):
                part = keys[i:i + 500]
                got.update({k: v for k, v in c.execute(f'SELECT h, vec FROM emb_cache WHERE h IN ({",".join("?" * len(part))})', part)})
            miss = [i for i, k in enumerate(keys) if k not in got]
            for i in range(0, len(miss), 4):   # small batches: peak RAM ~1 GB instead of 3-4 GB
                idx = miss[i:i + 4]
                for j, v in zip(idx, embed([texts[j] for j in idx], 'd')):
                    got[keys[j]] = v.astype(np.float32).tobytes()
                    c.execute('INSERT OR REPLACE INTO emb_cache VALUES (?,?)', (keys[j], got[keys[j]]))
            vecs = np.vstack([np.frombuffer(got[k], dtype=np.float32) for k in keys])
            for (a, b, h, t), v in zip(ch, vecs):
                cur = c.execute('INSERT INTO chunks(path,a,b,heading,kind,text,vec) VALUES (?,?,?,?,?,?,?)', (p, a, b, h, kind, t, v.tobytes()))
                c.execute('INSERT INTO fts(rowid,heading,text,path) VALUES (?,?,?,?)', (cur.lastrowid, h, t, ct(p)))
        c.execute('INSERT OR REPLACE INTO files VALUES (?,?,?,?,?)', (p, sha, st.st_mtime, st.st_size, len(ch)))
        c.commit(); upd += 1
    c.commit(); c.close()
    with LOCK: _mat = None
    return {'files_seen': len(seen), 'reindexed': upd, 'deleted': len(gone), 'secs': round(time.time() - t0, 1)}


def drop(c, p):
    ids = [r[0] for r in c.execute('SELECT id FROM chunks WHERE path=?', (p,))]
    for i in ids: c.execute('DELETE FROM fts WHERE rowid=?', (i,))
    c.execute('DELETE FROM chunks WHERE path=?', (p,)); c.execute('DELETE FROM files WHERE path=?', (p,))


def matrix(c):
    global _mat
    with LOCK:
        if _mat is None:
            rows = c.execute('SELECT id, vec FROM chunks').fetchall()
            ids = np.array([r[0] for r in rows], dtype=np.int64)
            m = np.vstack([np.frombuffer(r[1], dtype=np.float32) for r in rows]) if rows else np.zeros((0, 1), dtype=np.float32)
            _mat = (ids, m)
        return _mat


def fts_query(q):
    words = [w for w in re.findall(r'[A-Za-z0-9_\.\-\+#]+', q) if len(w) > 1]
    return ' OR '.join('"' + w.replace('"', '') + '"' for w in words[:12])


def search(q, scope=None, k=8, rerank=True):
    c = db(); res = {}
    scope_h = None
    if scope:
        scope_h = HOST_WS + scope[len(CT_WS):] if scope.startswith(CT_WS) else scope
    fq = fts_query(q)
    bm = []
    allowed = None
    if scope_h:   # rank only inside the scope, so other jobs' and skills' chunks cannot crowd a repo search out
        allowed = {r[0] for r in c.execute('SELECT id FROM chunks WHERE path=? OR path LIKE ?', (scope_h, scope_h.rstrip('/') + '/%'))}
    if fq:
        try:
            if scope_h:
                ct_scope = ct(scope_h)
                bm = [r[0] for r in c.execute('SELECT rowid FROM fts WHERE fts MATCH ? AND (path = ? OR path LIKE ?) ORDER BY bm25(fts, 5.0, 1.0, 2.0) LIMIT 60',
                                              (fq, ct_scope, ct_scope.rstrip('/') + '/%'))]
            else:
                bm = [r[0] for r in c.execute('SELECT rowid FROM fts WHERE fts MATCH ? ORDER BY bm25(fts, 5.0, 1.0, 2.0) LIMIT 60', (fq,))]
        except sqlite3.OperationalError:
            bm = []
    ids, m = matrix(c)
    vs = []
    if len(ids):
        qv = embed([q], 'q')[0]
        sc = m @ qv
        if allowed is not None:
            sc = np.where(np.isin(ids, np.fromiter(allowed, dtype=np.int64, count=len(allowed))), sc, -np.inf)
        top = [i for i in np.argsort(-sc)[:60] if np.isfinite(sc[i])]
        vs = [int(ids[i]) for i in top]
    score = {}
    for lst in (bm, vs):
        for r, i in enumerate(lst): score[i] = score.get(i, 0) + 1.0 / (60 + r)
    order = sorted(score, key=lambda i: -score[i])
    rows = {}
    for i in order[:120]:
        r = c.execute('SELECT id,path,a,b,heading,kind,text FROM chunks WHERE id=?', (i,)).fetchone()
        if r and (not scope_h or r[1] == scope_h or r[1].startswith(scope_h.rstrip('/') + '/')): rows[i] = r
    cand = [rows[i] for i in order if i in rows][:20]
    how = 'bm25+vector+rrf'
    if rerank and len(cand) > 1:
        try:
            s = list(reranker().rerank(q, [f'{r[4]}\n{r[6][:900]}' for r in cand]))
            cand = [r for _, r in sorted(zip(s, cand), key=lambda x: -x[0])]
            how += '+rerank'
        except Exception:
            traceback.print_exc()
    out = []
    for r in cand[:k]:
        body = re.sub(r'\s+', ' ', r[6]).strip()
        out.append({'path': ct(r[1]), 'a': r[2], 'b': r[3], 'heading': r[4], 'kind': r[5], 'snippet': body[:260]})
    c.close()
    return {'how': how, 'results': out, 'indexed_chunks': int(len(ids))}



def digest(text, goal=''):
    """Haiku compresses a long tool output so only the useful lines reach the (possibly Opus) agent. Free of regex on user text:
    the model reads the output; we only cap its size."""
    import urllib.request
    key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
    if not key: return {'error': 'no key'}
    try:
        m = json.load(open('/opt/agent/oh-home/profiles/lab-anthropic.json')).get('model') or ''
    except Exception: m = ''
    model = (m.split('/', 1)[1] if m.startswith('anthropic/') else m) or 'claude-haiku-5-5'
    t = text if len(text) <= 60000 else text[:20000] + '\n...[middle omitted]...\n' + text[-38000:]
    body = {'model': model, 'max_tokens': 700, 'system': 'You compress long tool output for an engineer. Reply with at most 12 short lines: what ran and '
            'whether it worked, every error or warning (exact text), key numbers, file paths with line numbers, and the next thing to look at. '
            'Quote, never guess. No preamble.',
            'messages': [{'role': 'user', 'content': (f'Goal of the command: {goal}\n\n' if goal else '') + 'Output:\n' + t}]}
    req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=json.dumps(body).encode(), method='POST',
                                 headers={'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01'})
    with urllib.request.urlopen(req, timeout=40) as r:
        res = json.loads(r.read())
    u = res.get('usage') or {}
    cost = ((u.get('input_tokens') or 0) * 0.10 + (u.get('output_tokens') or 0) * 0.50) / 1e6
    return {'text': ''.join(b.get('text', '') for b in res.get('content') or [] if b.get('type') == 'text'), 'cost_usd': round(cost, 6), 'model': model}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def reply(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header('content-type', 'application/json'); self.send_header('content-length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path == '/health':
            c = db(); n = c.execute('SELECT count(*) FROM chunks').fetchone()[0]; f = c.execute('SELECT count(*) FROM files').fetchone()[0]; c.close()
            return self.reply(200, {'ok': True, 'model': MODEL, 'rerank': RERANK, 'chunks': n, 'files': f})
        self.reply(404, {})
    def do_POST(self):
        try:
            body = json.loads(self.rfile.read(int(self.headers.get('content-length', 0)) or 0) or b'{}')
            if self.path == '/search':
                return self.reply(200, search(body.get('q', ''), body.get('scope'), int(body.get('k', 8)), body.get('rerank', True)))
            if self.path == '/reindex':
                rs = None
                if body.get('job'):
                    j = body['job']; j = HOST_WS + j[len(CT_WS):] if j.startswith(CT_WS) else j
                    rs = [j] if os.path.isdir(j) else None
                if body.get('root'):   # a code repo (codesearch, auto-index after edits)
                    j = body['root']; j = HOST_WS + j[len(CT_WS):] if j.startswith(CT_WS) else j
                    if not (os.path.isdir(j) and j.startswith(HOST_WS + '/')):
                        return self.reply(400, {'error': 'root must be a folder under /workspace'})
                    rs = [j]
                if rs:
                    for x in rs: register_root(x)
                return self.reply(200, reindex(rs))
            if self.path == '/digest':
                return self.reply(200, digest(body.get('text', ''), body.get('goal', '')))
            if self.path == '/add_root':
                d = body.get('dir', ''); d = HOST_WS + d[len(CT_WS):] if d.startswith(CT_WS) else d
                if not os.path.isdir(d): return self.reply(400, {'error': 'not a folder'})
                open(ROOTS_FILE, 'a').write(d + '\n'); return self.reply(200, reindex())
            self.reply(404, {})
        except Exception as e:
            traceback.print_exc(); self.reply(500, {'error': str(e)[:300]})


def loop():
    time.sleep(2)
    while True:
        try: discover_repos()
        except Exception: traceback.print_exc()
        try: print('reindex', reindex(), flush=True)
        except Exception: traceback.print_exc()
        time.sleep(90)


if __name__ == '__main__':
    try: reranker()
    except Exception: traceback.print_exc()
    threading.Thread(target=loop, daemon=True).start()
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
