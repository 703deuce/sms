"""Zero-token scheduled scripts (borrowed from Hermes cron no-agent mode, MIT). A routine with action='script' runs a
script in the agent container (sandboxed to its job folder, clean environment, timeout) with NO model call. The agent
is woken (or Rick notified) only when the output changes, when there is output, or when the script fails.

routines.prompt holds JSON: {"script": "/workspace/jobs/<id>/.../x.py", "root": "/workspace/jobs/<id>",
"on": "change"|"output", "then": "notify"|"run", "task": "what the agent should do with the output"}.
Off: runner/state/SCRIPT_ROUTINES_OFF (script routines are skipped; their next time still advances)."""
import hashlib, json, os, re, shlex, time

STATE = '/opt/agent/runner/state/script-routines.json'
LOG = '/opt/agent/runner/state/script-routines.jsonl'
UUID = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
ROOT_RE = re.compile(rf'^/workspace/jobs/{UUID}(?:/helpers/{UUID})*$')
TIMEOUT = 120
OUT_CAP = 20000


def spec_of(prompt):
    try:
        s = json.loads(prompt)
    except Exception:
        return None
    if not isinstance(s, dict):
        return None
    script, root = str(s.get('script') or ''), str(s.get('root') or '')
    if not ROOT_RE.match(root) or not os.path.normpath(script).startswith(root + '/') or '..' in script:
        return None
    s['on'] = s.get('on') if s.get('on') in ('change', 'output') else 'change'
    s['then'] = s.get('then') if s.get('then') in ('notify', 'run') else 'notify'
    return s


def command(s):
    script = s['script']
    interp = 'bash' if script.endswith(('.sh', '.bash')) else 'python3'
    return (f'env -i PATH=/opt/tools:/usr/local/bin:/usr/bin:/bin HOME=/tmp LANG=C.UTF-8 TZ=America/New_York '
            f'/opt/tools/job-sandbox --root {shlex.quote(s["root"])} -- timeout {TIMEOUT} {interp} {shlex.quote(script)}')


def _load():
    try:
        return json.load(open(STATE))
    except Exception:
        return {}


def _save(st):
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    tmp = STATE + '.tmp'
    json.dump(st, open(tmp, 'w'), indent=1)
    os.replace(tmp, STATE)


def decide(s, rc, out, last_hash):
    """Returns (trigger, why, new_hash). trigger in None | 'failed' | 'changed' | 'output'."""
    body = (out or '').strip()
    h = hashlib.sha1(body.encode('utf-8', 'replace')).hexdigest()[:16] if body else ''
    if rc not in (0, None):
        return 'failed', f'exit code {rc}' + (' (timed out)' if rc == 124 else ''), last_hash
    if not body:
        return None, 'no output (silent tick)', last_hash
    if s['on'] == 'output':
        return 'output', 'script printed output', h
    if h != last_hash:
        return 'changed', 'output changed' if last_hash else 'first output', h
    return None, 'output unchanged', h


def tick(api, R, db, r):
    """Run one script routine. Never raises. Uses its own db connection when called from a thread."""
    s = spec_of(r['prompt'])
    row = {'routine': r['id'], 'name': r['name']}
    if not s:
        row['error'] = 'bad script routine spec'
        _log(row)
        return row
    try:
        res = api('POST', '/api/bash/execute_bash_command', {'command': command(s), 'cwd': s['root'], 'timeout': TIMEOUT + 10},
                  timeout=TIMEOUT + 30)
        rc = res.get('exit_code')
        out = ((res.get('stdout') or '') + ('\n[stderr]\n' + res['stderr'] if (res.get('stderr') or '').strip() else ''))[:OUT_CAP]
        if rc is None:
            rc = 124
    except Exception as e:
        rc, out = -1, f'could not run the script: {str(e)[:300]}'
    st = _load()
    prev = st.get(r['id'], {})
    trig, why, h = decide(s, rc, out if rc in (0, None) else '', prev.get('hash', ''))
    if rc not in (0, None):
        trig, why = 'failed', f'exit code {rc}' + (' (timed out)' if rc == 124 else '')
    st[r['id']] = {'hash': h if trig != 'failed' else prev.get('hash', ''), 'last_rc': rc,
                   'last_at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'last_trigger': trig}
    _save(st)
    row.update(rc=rc, trigger=trig, why=why, out_chars=len(out))
    if trig:
        label = r['name'] or r['id']
        shown = out if len(out) <= 6000 else out[:4000] + '\n...\n' + out[-2000:]
        if s['then'] == 'run' or trig == 'failed' and s.get('task'):
            prompt = (f"[Scheduled run of routine {label} ({r['id']}): its script {why}]\n"
                      f"Script: {s['script']}\nOutput:\n```\n{shown}\n```\n\nTask: "
                      + (s.get('task') or 'Look at the output above and report what matters to Rick briefly.')
                      + ('\nThe script failed: find out why, fix the script in place if you can, and report.' if trig == 'failed' else ''))
            run_id, _ = R.enqueue(db, prompt, 'routine', title=label, routine_id=r['id'], bot_id=r['bot_id'])
            row['run'] = run_id
        else:
            R.notify(db, 'run_done', f"Routine {label}: {why}", shown[:4000], conversation_id=r['created_by'],
                     bot_id=r['bot_id'])
            row['notified'] = True
    _log(row)
    return row


def _log(row):
    row['at'] = time.strftime('%Y-%m-%dT%H:%M:%S%z')
    try:
        with open(LOG, 'a') as f:
            f.write(json.dumps(row) + '\n')
    except OSError:
        pass
