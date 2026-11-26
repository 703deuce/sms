"""Goal judge (borrowed from Hermes hermes_cli/goals.py, MIT, and browser-use's Judgement): when a front-desk or helper
job is about to finish, one Haiku call compares the request with the final reply and the files on disk.

verdict: done | continue | blocked. On continue the reason goes back into the same conversation (max 2 extra rounds per
run). On blocked the reply must name the blocker plainly (one send-back if it does not). A site bot-block / captcha /
sign-in wall is blocked (blocked_by_site), never continue. Any judge error or unparseable reply FAILS OPEN (the job
finishes as it would have without the judge) and is logged. Off switch: runner/state/GOAL_JUDGE_OFF."""
import csv, glob, json, os, re, time
import labllm

STATE = '/opt/agent/runner/state/goal-judge.json'
MAX_ROUNDS = 2

SYSTEM = (
    "You are a strict but fair judge checking whether an autonomous agent finished what the user asked. You get the "
    "user's request, the agent's final reply, and the files in its job folder with measured facts (sizes, row counts). "
    "Pick one verdict.\n"
    "DONE: the request is satisfied. The deliverable exists (in the reply or as a file listed) and every explicit "
    "requirement is met: each requested count, item, format, field and constraint. A conversational question answered, "
    "a quick task done, or work clearly handed to a background job/helper that will report back also counts as DONE.\n"
    "CONTINUE: not finished and the agent can do more right now with its own tools: fewer items than requested "
    "(e.g. 19 of 25) without a real external reason, a requested part missing or thin, a claimed file that is not on "
    "disk, a required check not done, or no final reply at all. Name exactly what is missing.\n"
    "BLOCKED: the rest genuinely cannot be done by the agent now: a site blocks automated access (bot check, captcha, "
    "press-and-hold, Access Denied, sign-in wall), a needed login/payment/approval from the user, the thing does not "
    "exist, or the agent asked the user a question it truly needs answered. Set blocked_by_site true when a website "
    "block is the cause. Set blocker_stated true only if the final reply itself plainly tells the user what blocked it.\n"
    "Judge only by evidence in the reply and the file facts. Accept the agent's own account of checks it ran unless the file facts contradict it. Never invent requirements the user did not state. If the "
    "agent tried several routes and explains an honest shortfall caused by the outside world, that is BLOCKED, not "
    "CONTINUE.\n"
    'Reply with ONE JSON object only: {"verdict": "done|continue|blocked", "reason": "<one sentence>", '
    '"missing": ["<short item>", ...], "blocked_by_site": true|false, "blocker_stated": true|false}')


def _load():
    try:
        return json.load(open(STATE))
    except Exception:
        return {}


def _save(st):
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    if len(st) > 3000:  # keep the newest
        for k in sorted(st, key=lambda k: st[k].get('at', ''))[:len(st) - 2500]:
            st.pop(k, None)
    tmp = STATE + '.tmp'
    json.dump(st, open(tmp, 'w'), indent=1)
    os.replace(tmp, STATE)


def _rows(p):
    """Measured facts for a deliverable (deterministic gate input for the judge)."""
    ext = p.rsplit('.', 1)[-1].lower() if '.' in p else ''
    try:
        if ext in ('csv', 'tsv'):
            with open(p, newline='', errors='replace') as f:
                n = sum(1 for row in csv.reader(f, delimiter='\t' if ext == 'tsv' else ',') if any(c.strip() for c in row))
            return f'{max(n - 1, 0)} data rows'
        if ext == 'json':
            d = json.load(open(p, errors='replace'))
            if isinstance(d, list):
                return f'{len(d)} items'
            if isinstance(d, dict):
                big = max((v for v in d.values() if isinstance(v, list)), key=len, default=None)
                return f'object; largest list {len(big)} items' if big is not None else 'object'
        if ext == 'xlsx':
            try:
                import openpyxl
                wb = openpyxl.load_workbook(p, read_only=True)
                return '; '.join(f'sheet {ws.title}: {max((ws.max_row or 1) - 1, 0)} data rows' for ws in wb.worksheets[:4])
            except Exception:
                return ''
        if ext in ('md', 'txt', 'html'):
            t = open(p, errors='replace').read()
            return f'{len(t.split())} words'
    except Exception:
        return ''
    return ''


def file_facts(host_dir, limit=40):
    out = []
    for root, dirs, files in os.walk(host_dir):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'helpers', 'frames', 'log', 'evidence', '__pycache__',
                                                '.cache', 'src', 'work')]
        for f in files:
            if f.startswith('.'):
                continue
            p = os.path.join(root, f)
            try:
                sz = os.path.getsize(p)
            except OSError:
                continue
            out.append((os.path.getmtime(p), os.path.relpath(p, host_dir), sz, p))
    out.sort(reverse=True)
    lines = []
    for _, rel, sz, p in out[:limit]:
        fact = _rows(p) if sz < 5_000_000 else ''
        lines.append(f'- {rel} ({sz} bytes{", " + fact if fact else ""})')
    try:  # deep-research coverage ledger (tools/research-coverage)
        cov = json.load(open(os.path.join(host_dir, 'log', 'coverage.json')))
        items = cov.get('items') or {}
        acc = [v for v in items.values() if v.get('status') != 'rejected']
        ms = cov.get('min_sources', 2)
        weak = sum(1 for v in acc if len({str(u).split('/')[2] if '//' in str(u) else u for u in v.get('sources', [])}) < ms)
        lines.append(f"- research coverage ledger: {len(acc)} accepted" + (f" of target {cov.get('target')}" if cov.get('target') else '')
                     + f", {weak} with fewer than {ms} independent sources, "
                     f"{sum(1 for v in items.values() if v.get('status') == 'rejected')} rejected"
                     + (f"; recorded gap: {str(cov.get('gap'))[:200]}" if cov.get('gap') else ''))
    except Exception:
        pass
    ev = glob.glob(os.path.join(host_dir, 'evidence', '*.png')) + glob.glob(os.path.join(host_dir, 'evidence', '*.jpg'))
    if ev:
        lines.append(f'- evidence/ ({len(ev)} screenshots of browser steps)')
    return '\n'.join(lines) or '(no files)'


def parse(txt):
    """Model reply -> dict or None (fail open). Salvages the verdict word from a broken object."""
    d = labllm.parse_obj(txt)
    if d is None:
        m = re.search(r'"verdict"\s*:\s*"(done|continue|blocked)"', txt or '', re.I)
        if not m:
            return None
        d = {'verdict': m.group(1), '_salvaged': True}
        for k in ('blocked_by_site', 'blocker_stated'):
            mb = re.search(rf'"{k}"\s*:\s*(true|false)', txt, re.I)
            if mb:
                d[k] = mb.group(1).lower() == 'true'
        mr = re.search(r'"reason"\s*:\s*"([^"]{0,400})', txt)
        if mr:
            d['reason'] = mr.group(1)
        if m.group(1).lower() == 'blocked' and 'blocker_stated' not in d:
            d['blocker_stated'] = True  # unknown after a cut-off reply: do not nag (fail safe)
    v = str(d.get('verdict') or '').strip().lower()
    if v not in ('done', 'continue', 'blocked'):
        return None
    miss = d.get('missing') if isinstance(d.get('missing'), list) else []

    def b(x):
        return x is True or str(x).strip().lower() in ('true', 'yes', '1')
    return {'verdict': v, 'reason': str(d.get('reason') or '').strip()[:400], 'missing': [str(x)[:160] for x in miss[:8]],
            'blocked_by_site': b(d.get('blocked_by_site')), 'blocker_stated': b(d.get('blocker_stated')),
            'salvaged': bool(d.get('_salvaged'))}


def judge(request, reply, facts, run_id=None):
    """Returns (verdict dict or None, info)."""
    req = request if len(request) <= 6000 else request[:4500] + '\n...\n' + request[-1500:]
    rep = reply if len(reply) <= 8000 else reply[:6000] + '\n...\n' + reply[-2000:]
    user = (f'User request:\n{req}\n\nAgent final reply:\n{rep or "(no final reply)"}\n\n'
            f'Files in the job folder (newest first, measured):\n{facts}\n\nVerdict?')
    txt, info = labllm.call(SYSTEM, user, max_tokens=1500, purpose='goal_judge', run_id=run_id)
    if info.get('error'):
        return None, info
    v = parse(txt)
    if v is None:
        info['error'] = 'unparseable judge reply: ' + (txt or '')[:160]
    return v, info


MIN_ROUTE_TYPES = 3


def route_types(host_dir):
    """Distinct route types logged by readpage/egress-fetch in <job>/log/routes.jsonl (our own structured data).
    Returns (set, n_lines). Missing file -> (set(), 0)."""
    seen, n = set(), 0
    try:
        with open(os.path.join(host_dir, 'log', 'routes.jsonl'), errors='replace') as f:
            for line in f:
                try:
                    rt = str(json.loads(line).get('route') or '').split(':', 1)[0]
                except Exception:
                    continue
                n += 1
                if rt:
                    seen.add(rt)
    except OSError:
        pass
    return seen, n


def route_retry_msg(v, seen, round_no):
    tried = ', '.join(sorted(seen)) or 'none logged'
    return (f"[Goal check {round_no}/{MAX_ROUNDS}] You are stopping because a site blocked you ({v['reason']}), but only "
            f"{len(seen)} route type(s) were tried (logged: {tried}); a job may end blocked only after at least "
            f"{MIN_ROUTE_TYPES} different routes. Before giving up, try the ones you have not used:\n"
            "- `readpage <URL>` (runs the whole free ladder by itself: Chrome-TLS, residential proxy, stealth browser with "
            "captcha solving, Wayback copy, other sites with the same content)\n"
            "- the browser tool on the page\n"
            "- `search` for the same facts on another site (official site, press, cached or mirror copy)\n"
            "If these were already tried outside the log, or they also fail, finish with your COMPLETE final reply that "
            "says plainly what blocked you and what you tried. Do not redo finished work. This is an automatic check, not "
            "a new request from Rick.")


def check(r, request, reply, host_dir):
    """At finish. Returns (action, message, record): action 'pass' | 'send_back'."""
    st = _load()
    rec = st.get(r['id']) or {'rounds': 0, 'history': [], 'blocker_asked': False}
    if rec.get('final'):
        return 'pass', '', rec  # already judged final for this run (e.g. re-finish after delivery)
    v, info = judge(request, reply, file_facts(host_dir), r['id'])
    h = {'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'cost': info.get('cost'), 'error': info.get('error')}
    if v:
        h.update(v)
    rec['history'].append(h)
    rec['at'] = h['at']
    action, msg = 'pass', ''
    if not v:
        rec['last'] = 'judge_failed_open'
    elif v['verdict'] == 'continue' and rec['rounds'] < MAX_ROUNDS:
        rec['rounds'] += 1
        miss = ''.join(f'\n- {m}' for m in v['missing'])
        msg = (f"[Goal check {rec['rounds']}/{MAX_ROUNDS}] Your result does not finish the request yet: {v['reason']}"
               + (f'\nStill missing:{miss}' if miss else '') +
               '\nKeep working on exactly what is missing (try other sources or routes if the first one came up short). '
               'Then deliver your COMPLETE final reply again (every file path and detail, updated). If part of it truly '
               'cannot be done, say plainly what blocked it and how far you got. This is an automatic check, not a new '
               'request from Rick.')
        action = 'send_back'
    elif (v['verdict'] == 'blocked' and v['blocked_by_site'] and not rec.get('route_retry')
          and rec['rounds'] < MAX_ROUNDS and len(route_types(host_dir)[0]) < MIN_ROUTE_TYPES):
        # M2: one "try these routes" message, counts as one of the extra rounds (fails open: errors -> pass below)
        rec['rounds'] += 1
        rec['route_retry'] = True
        msg = route_retry_msg(v, route_types(host_dir)[0], rec['rounds'])
        action = 'send_back'
    elif v['verdict'] == 'blocked' and not v['blocker_stated'] and not rec['blocker_asked']:
        rec['blocker_asked'] = True
        msg = (f"[Goal check] Part of this could not be done ({v['reason']}), but your reply does not say so plainly. "
               'Rewrite your COMPLETE final reply: what you delivered, exactly what blocked the rest (quote the error or '
               'block page), what you tried, and what Rick could do about it. Do not redo finished work. This is an '
               'automatic check, not a new request from Rick.')
        action = 'send_back'
    if action == 'pass':
        rec['final'] = v['verdict'] if v else 'judge_failed_open'
        if v and v['verdict'] == 'continue':
            rec['final'] = 'continue_capped'
        rec['blocked_by_site'] = bool(v and v['blocked_by_site'])
    st[r['id']] = rec
    _save(st)
    try:
        os.makedirs(os.path.join(host_dir, 'log'), exist_ok=True)
        json.dump(rec, open(os.path.join(host_dir, 'log', 'goal-judge.json'), 'w'), indent=1)
    except OSError:
        pass
    return action, msg, rec


def had_recovery(run_id):
    rec = _load().get(run_id) or {}
    return rec.get('rounds', 0) > 0 or rec.get('blocker_asked', False)
