"""Agent Lab long-term memory: one SQLite file with FTS5 (keywords) + sqlite-vec (meaning).

Scopes: every fact belongs to a bot_id (env BOT_ID, default 'agent-lab') or 'shared' (all bots).
Embeddings: Gemini gemini-embedding-001 (768 dims, normalized). If embedding fails, the fact is
stored without a vector and keyword search still works; `remember --reindex` backfills vectors.
"""
import json, os, re, sqlite3, struct, sys, urllib.request
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pylib'))
import sqlite_vec  # noqa: E402

DB = os.environ.get('AGENT_MEMORY_DB', '/workspace/memory/memory.db')
BOT = os.environ.get('BOT_ID', 'agent-lab')
DIM = 768
TYPES = ('rule', 'person', 'project', 'preference', 'fact', 'tool')
EMBED_MODEL = os.environ.get('EMBED_MODEL', 'gemini-embedding-001')


def now():
    return datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')


def connect():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    db = sqlite3.connect(DB, timeout=30)
    db.enable_load_extension(True)
    sqlite_vec.load(db)
    db.enable_load_extension(False)
    db.execute('PRAGMA journal_mode=WAL')
    db.executescript(f'''
    CREATE TABLE IF NOT EXISTS facts(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id TEXT NOT NULL,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      source TEXT,
      replaced_by INTEGER
    );
    CREATE INDEX IF NOT EXISTS facts_scope ON facts(bot_id, replaced_by);
    CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(text, content='facts', content_rowid='id');
    CREATE TRIGGER IF NOT EXISTS facts_ai AFTER INSERT ON facts BEGIN
      INSERT INTO facts_fts(rowid, text) VALUES (new.id, new.text); END;
    CREATE TRIGGER IF NOT EXISTS facts_ad AFTER DELETE ON facts BEGIN
      INSERT INTO facts_fts(facts_fts, rowid, text) VALUES ('delete', old.id, old.text); END;
    CREATE VIRTUAL TABLE IF NOT EXISTS facts_vec USING vec0(embedding float[{DIM}] distance_metric=cosine);
    ''')
    return db


def embed(text, task='RETRIEVAL_DOCUMENT'):
    key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    if not key:
        return None
    body = json.dumps({'model': f'models/{EMBED_MODEL}', 'content': {'parts': [{'text': text}]},
                       'taskType': task, 'outputDimensionality': DIM}).encode()
    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{EMBED_MODEL}:embedContent',
        data=body, headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            v = json.load(r)['embedding']['values']
    except Exception as e:
        print(f'(embedding unavailable: {e}; keyword search only)', file=sys.stderr)
        return None
    n = sum(x * x for x in v) ** 0.5 or 1.0
    return [x / n for x in v]


def pack(v):
    return struct.pack(f'{len(v)}f', *v)


def scopes(include_shared=True):
    return (BOT, 'shared') if include_shared else (BOT,)


def source_from_cwd():
    m = re.match(r'^/workspace/jobs/([^/]+)', os.getcwd())
    return m.group(1) if m else os.environ.get('OPENHANDS_SESSION_ID')


def fts_query(q):
    words = [w for w in re.findall(r'[\w\-]{2,}', q.lower()) if w not in STOP]
    return ' OR '.join(f'"{w}"' for w in words[:24])


STOP = set('the a an and or of to in on for is are was were be been it this that with as at by from what which who how '
           'does do did i you we he she they rick his her my our your me us about any some please can could would should '
           'want wants like likes'.split())


def active_clause(alias='f'):
    return f'{alias}.replaced_by IS NULL AND {alias}.bot_id IN (?, ?)'


def search(db, q, n=10, types=None):
    """Hybrid search: reciprocal-rank fusion of FTS5 bm25 and vector similarity."""
    scores, why = {}, {}
    fq = fts_query(q)
    if fq:
        rows = db.execute(f'''SELECT f.id FROM facts_fts JOIN facts f ON f.id = facts_fts.rowid
                              WHERE facts_fts MATCH ? AND {active_clause()} ORDER BY bm25(facts_fts) LIMIT 30''',
                          (fq, *scopes())).fetchall()
        for rank, (fid,) in enumerate(rows):
            scores[fid] = scores.get(fid, 0) + 1 / (60 + rank)
            why.setdefault(fid, set()).add('kw')
    v = embed(q, 'RETRIEVAL_QUERY')
    if v:
        rows = db.execute('SELECT rowid, distance FROM facts_vec WHERE embedding MATCH ? AND k = 60 ORDER BY distance',
                          (pack(v),)).fetchall()
        live = {r[0] for r in db.execute(f'SELECT id FROM facts f WHERE {active_clause()}', scopes())}
        rank = 0
        for fid, dist in rows:
            if fid not in live or dist > 0.6:
                continue
            scores[fid] = scores.get(fid, 0) + 1 / (60 + rank)
            why.setdefault(fid, set()).add('meaning')
            rank += 1
    ids = sorted(scores, key=lambda i: -scores[i])
    out = []
    for fid in ids:
        r = db.execute('SELECT id, bot_id, type, text, created_at FROM facts WHERE id=?', (fid,)).fetchone()
        if r and (not types or r[2] in types):
            out.append(r)
        if len(out) >= n:
            break
    return out


def fmt(r):
    fid, bot, typ, text, created = r[:5]
    scope = 'shared' if bot == 'shared' else bot
    return f'#{fid} [{typ}] {text}  ({created[:10]}, {scope})'
