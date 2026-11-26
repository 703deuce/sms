#!/usr/bin/env python3
import os, sys, json, time, sqlite3, subprocess, urllib.request, shutil
sys.path.insert(0, '/opt/agent/runner'); sys.path.insert(0, '/opt/agent/tools')
for l in open('/opt/agent/.env'):
    if '=' in l and not l.startswith('#'):
        k, v = l.rstrip('\n').split('=', 1); os.environ.setdefault(k, v.strip('"\''))
os.environ['HAIKU_CTX_BACKSTOP'] = '75000'
os.environ['RUNS_DB'] = '/opt/agent/workspace/runs/runs.db'
JID = '00000000-0000-0000-0000-0000000a5e01'
HJOB = f'/opt/agent/workspace/jobs/{JID}'; CJOB = f'/workspace/jobs/{JID}'
def res(n, ok, d=''): print(f'RESULT|{n}|{"PASS" if ok else "FAIL"}|{d}', flush=True)
def post(path, body, t=300):
    rq = urllib.request.Request('http://127.0.0.1:6075' + path, data=json.dumps(body).encode(), method='POST', headers={'content-type': 'application/json'})
    return json.loads(urllib.request.urlopen(rq, timeout=t).read())
import skill_gate as G
import agentd as A
def row(**kw):
    d = {'id': 'smoketest1', 'kind': 'visual-owner', 'source': 'agent', 'prompt': '', 'working_dir': CJOB, 'conversation_id': 'abcd1234abcd1234abcd1234abcd1234',
         'last_checkpoint': None, 'parent_conversation_id': None}
    d.update(kw); return d

# ---- router
vid = 'Make a 30 second documentary about the history of the lighthouse at Cape Hatteras: research, script, voiceover, motion graphics, sound, render 854x480 mp4.'
sheet = 'Open the attached sales spreadsheet and tell me which region grew fastest last quarter, then draft two sentences for my manager.'
p1, i1 = G.route(vid, 'owner'); p2, i2 = G.route(sheet, 'owner')
res('router: video job -> lab-video-producer', any((s['slug'] if isinstance(s, dict) else s) == 'lab-video-producer' for s, _ in p1), f'picks={[x[0]["slug"] if isinstance(x[0], dict) else x[0] for x in p1]} cost=${i1.get("cost")}')
res('router: spreadsheet job -> no video skill', not any((s['slug'] if isinstance(s, dict) else s) == 'lab-video-producer' for s, _ in p2), f'picks={[x[0]["slug"] if isinstance(x[0], dict) else x[0] for x in p2]}')
# ---- attach / core size / big-file hint
try:
    out = G.attach(row(prompt=vid), 'ORIGINAL PROMPT')
    core = G._core([s for s in G.skills() if s['slug'] == 'lab-video-producer'][0])
    res('skill core small (<10K tokens ~ 40K chars)', 0 < len(core) < 40000, f'core {len(core)} chars (~{len(core)//4} tokens)')
    res('attach injects core + lookup hint', 'read_section' in out and 'ORIGINAL PROMPT' in out and 'ref/' in out, f'prompt grew to {len(out)} chars; has big-file hint={"read_section" in out}')
except Exception as e:
    import traceback; traceback.print_exc(); res('skill attach', False, repr(e)[:150])
# ---- deliver check against plan-check.json
sk = [s for s in G.skills() if s['slug'] == 'lab-video-producer'][0]
os.makedirs(HJOB + '/log', exist_ok=True)
open(HJOB + '/log/plan-check.json', 'w').write('{"verdict": "pass"}')
ok1 = G._deliver_check(sk['deliver_check'], HJOB)[0]
os.remove(HJOB + '/log/plan-check.json')
ok2 = G._deliver_check(sk['deliver_check'], HJOB)[0]
res('planning-stage gate (deliver_check on plan-check.json)', ok1 and not ok2, f'with pass-record={ok1}, without={ok2}')
# ---- hybrid: rerank on/off, hash reindex
q = 'which engine should I use for a camera flying through 3D'
a = post('/search', {'q': q, 'k': 5, 'rerank': False}); b = post('/search', {'q': q, 'k': 5, 'rerank': True})
res('reranker active and changes/keeps sane order', 'rerank' in b['how'] and 'rerank' not in a['how'] and len(b['results']) == 5, f'no-rerank top={a["results"][0]["heading"][:50]!r}; rerank top={b["results"][0]["heading"][:50]!r}')
d = HJOB + '/docs'; os.makedirs(d, exist_ok=True); f = d + '/hashtest.md'
open(f, 'w').write('# Hash test\n\n## Zorblax protocol\n\nThe zorblax protocol uses seventeen purple widgets.\n')
r1 = post('/reindex', {'job': CJOB})
s1 = post('/search', {'q': 'seventeen purple widgets', 'k': 3})
os.utime(f, (time.time() + 5, time.time() + 5)); r2 = post('/reindex', {'job': CJOB})
open(f, 'w').write('# Hash test\n\n## Zorblax protocol\n\nThe zorblax protocol now uses nine green gadgets.\n'); r3 = post('/reindex', {'job': CJOB})
s3 = post('/search', {'q': 'nine green gadgets', 'k': 3}); s3b = post('/search', {'q': 'seventeen purple widgets', 'k': 3})
os.remove(f); r4 = post('/reindex', {'job': CJOB}); s4 = post('/search', {'q': 'nine green gadgets zorblax', 'k': 3})
res('hash reindex: new file indexed', r1['reindexed'] >= 1 and 'hashtest.md' in json.dumps(s1['results'][:1]), f'reindexed={r1["reindexed"]}; top={s1["results"][0]["path"][-20:]}')
res('hash reindex: touch only (same content) is skipped', r2['reindexed'] == 0, f'reindexed={r2["reindexed"]}')
res('hash reindex: changed content re-indexed, old text gone', r3['reindexed'] == 1 and 'hashtest.md' in s3['results'][0]['path'] and 'nine green' in s3['results'][0]['snippet'] and 'seventeen' not in json.dumps(s3b['results']), f'reindexed={r3["reindexed"]}; top={s3["results"][0]["path"][-20:]} {s3["results"][0]["snippet"][:60]!r}')
res('hash reindex: deleted file dropped', r4['deleted'] >= 1 and 'hashtest.md' not in json.dumps(s4['results']), f'deleted={r4["deleted"]}')

# ---- agentd harness pieces with fake API
D = A.Daemon.__new__(A.Daemon); D.ctx = {}; D.loopst = {}
calls = []
def fake_api_factory(events=None, last=None):
    def f(method, path, body=None, timeout=60, headers=None):
        calls.append((method, path, body))
        if '/events/search' in path: return {'items': events or []}
        return {}
    return f
act = lambda args: {'tool_name': 'terminal', 'tool_call': {'arguments': args}}
A.api = fake_api_factory([act('{"command":"ls"}')] * 3)
D.watch_loop(row()); posted = [c for c in calls if c[0] == 'POST']
res('3x identical tool call -> loop guard nudge', len(posted) == 1 and 'Loop guard' in json.dumps(posted[0][2]), f'posts={len(posted)}')
calls.clear(); D.loopst = {}
A.api = fake_api_factory([act('{"command":"ls"}'), act('{"command":"ls -l"}'), act('{"command":"ls"}')])
D.watch_loop(row()); res('different calls -> no nudge', not [c for c in calls if c[0] == 'POST'], '')
calls.clear(); D.loopst = {}
A.api = fake_api_factory([act('{"command":"ls"}')] * 2)
D.watch_loop(row()); res('only 2 identical -> no nudge', not [c for c in calls if c[0] == 'POST'], '')
# token budget / summarize-restart
calls.clear(); D.ctx = {}
open(HJOB + '/log/notes.md', 'w').write('note')
shutil.rmtree(HJOB + '/.git', ignore_errors=True)
A.last_call_usage = lambda info: (50000, 5)
info = {'agent': {'llm': {'model': 'x'}}}
D.watch_context(row(), info); time.sleep(0.5); under = [c for c in calls if c[1].endswith('/condense')]
A.last_call_usage = lambda info: (80000, 9)
D.watch_context(row(), info); time.sleep(3); over = [c for c in calls if c[1].endswith('/condense')]
res('budget: no condense under 75K', not under, f'budget={A.EMERGENCY_BACKSTOP}')
res('budget: condense requested over 75K (per conversation, helpers too)', len(over) == 1 and A.EMERGENCY_BACKSTOP == 75000, f'backstop={A.EMERGENCY_BACKSTOP} (env HAIKU_CTX_BACKSTOP; runner service sets 75000)' if A.EMERGENCY_BACKSTOP != 75000 else 'condense POST sent at 80K')
D.watch_context(row(), info); time.sleep(0.3)
res('budget: not re-requested while in flight / <3 calls later', len([c for c in calls if c[1].endswith('/condense')]) == 1, '')
snap = open(HJOB + '/log/context-log.md').read() if os.path.exists(HJOB + '/log/context-log.md') else ''
res('pre-condense snapshot written to log/context-log.md', 'Pre-condensation snapshot' in snap and '80,000' in snap, '')
gl = subprocess.run(['git', '-c', 'safe.directory=*', '-C', HJOB, 'log', '--oneline'], capture_output=True, text=True).stdout
res('git checkpoint before condensation', 'before condensation' in gl, gl.strip()[:70])
# context note re-injects task file + notes
os.makedirs(HJOB + '/log/notes', exist_ok=True)
open(HJOB + '/log/notes/00-task.md', 'w').write('GOAL: lighthouse film. NEXT STEP: render scene 3.')
open(HJOB + '/log/notes/02-research.md', 'w').write('facts: tower height 198 ft')
open(HJOB + '/log/plan.md', 'w').write('| 1 | Remotion | kinetic type |')
n = A.context_note(row(), 'SUMMARY TEXT')
res('restart: task file + stage notes + plan re-injected', 'NEXT STEP: render scene 3' in n and '198 ft' in n and 'kinetic type' in n and 'Context restored' in n, f'{len(n)} chars')
# cleanup
for p in (HJOB + '/log/notes.md',):
    if os.path.exists(p): os.remove(p)
