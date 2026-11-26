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
    "requirement is met: each requested count, item, format, field and constraint. A conversational question answered "
    "or a quick task done also counts as DONE. A handoff to a background job counts as DONE only when the evidence lists "
    "a child run that exists and is running, queued, starting, or already finished. The agent's claim that a job was "
    "started is not enough if no child run is listed. If the agent said it handed the work off but the evidence shows "
    "no child run, and the requested deliverables are not on disk, the verdict is CONTINUE.\n"
    "CONTINUE: not finished and the agent can do more right now with its own tools: fewer items than requested "
    "(e.g. 19 of 25) without a real external reason, a requested part missing or thin, a claimed file that is not on "
    "disk, a required check not done, or no final reply at all. Name exactly what is missing.\n"
    "BLOCKED: the rest genuinely cannot be done by the agent now: a site blocks automated access (bot check, captcha, "
    "press-and-hold, Access Denied, sign-in wall), a needed login/payment/approval from the user, the thing does not "
    "exist, or the agent asked the user a question it truly needs answered. Set blocked_by_site true when a website "
    "block is the cause. Set blocker_stated true only if the final reply itself plainly tells the user what blocked it.\n"
    "A business website the owner wants online: a link on our own preview server (Agent Lab Pages, a transovo.ai/app/agent-lab "
    "page) is only a preview, never the owner's published website. If the owner has no hosting and asked for the site online, "
    "a reply is DONE when it gives the preview clearly labeled as a preview (not live, not their website yet) AND offers the "
    "owner both next steps (a free host account in their own name that the agent can set up or connect, with what it needs "
    "from them); and DONE when the owner chose a preview and got a labeled one. It is CONTINUE when the reply calls that "
    "preview link live, published or the business's website, or leaves out any way to get it onto real hosting.\n"
    "Judge the OUTCOME, not the method. If the reply gives a correct, complete answer to what the user asked, that is DONE "
    "even if the agent reached it differently from how the request suggested (a different tool, fewer or smaller steps, "
    "reading saved copies instead of re-opening files, no parallel batches). Never ask the agent to redo or repeat work "
    "only because a process step the user mentioned was done another way or not at all. CONTINUE only when the answer "
    "or a deliverable itself is wrong, missing or incomplete.\n"
    "EXCEPTION, pinned requirements: when the request ends with 'Pinned requirements', those are the user's explicit "
    "instructions (tools, engines, methods, sources, formats), quoted verbatim. Each one must be met, or the final reply "
    "must say plainly which one could not be met and why. A pinned requirement that was quietly replaced by another "
    "approach is CONTINUE: name it in missing as 'requirement: <quote>'. In reason, give the evidence for each pinned "
    "requirement (a file, command or render named in the reply or file facts).\n"
    "EARLIER TURNS COUNT: a request can span several turns, restarts and context rollovers of the same conversation. "
    "Work finished earlier (its file is on disk, or it appears in the progress recorded before this turn) is done: never "
    "ask to redo or repeat finished work in this turn, and a requirement about how a step is done is met when that step was "
    "done that way in an earlier turn. Ask only for what is still missing or wrong now.\n"
    "Judge only by evidence in the reply, the file facts, and the listed background jobs. Accept the agent's own account of checks it ran unless the file facts or the background-job list contradict it. Never invent requirements the user did not state. If the "
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
    # A deep folder with many files (a built site's fx/ or assets/ library, frames, ...) becomes one line, so it cannot push
    # the real deliverables (out/<name>/index.html, reports) out of the newest-first limit.
    cnt = {}
    for m, rel, sz, p in out:
        parts = rel.split(os.sep)[:-1]
        for k in range(3, len(parts) + 1):
            c = cnt.setdefault(os.sep.join(parts[:k]), [0, 0, 0.0])
            c[0] += 1; c[1] += sz; c[2] = max(c[2], m)
    big = {d for d, c in cnt.items() if c[0] > 12}
    top = {d for d in big if not any(d != e and d.startswith(e + os.sep) for e in big)}
    def under(rel):
        return next((d for d in top if rel.startswith(d + os.sep)), None)
    rows = [(m, rel, sz, p) for m, rel, sz, p in out if under(rel) is None]
    for d in top:
        rows.append((cnt[d][2], d + '/', cnt[d][1], None))
    rows.sort(reverse=True)
    lines = []
    for _, rel, sz, p in rows[:limit]:
        if p is None:
            lines.append(f'- {rel} ({cnt[rel[:-1]][0]} files, {cnt[rel[:-1]][1]} bytes in total, a library folder)')
            continue
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
    try:  # resilience 2026-11-26: background commands (bgjob) are a real hand-off; show their state to the judge
        for c in sorted(glob.glob(os.path.join(host_dir, 'log', 'bg', '*.cmd')))[:6]:
            b = c[:-4]
            name = os.path.basename(b)
            if os.path.exists(b + '.exit'):
                st = f"finished, exit code {open(b + '.exit').read().strip() or '?'}"
            elif os.path.exists(b + '.stopped'):
                st = 'stopped with bgjob stop'
            else:
                st = ('started, no exit code yet: still running (the runner wakes this conversation when it exits) '
                      'or killed')
            lines.append(f'- background command (bgjob) {name}: {st}')
    except Exception:
        pass
    lines += extra_facts(host_dir)
    return '\n'.join(lines) or '(no files)'


_LOG_SKIP = {"goal.md", "context-log.md", "ledger.md", "checkpoints.md", "read-manifest.jsonl"}


def extra_facts(host_dir):
    """Deliverable-type evidence that file_facts skips (it hides log/ and evidence/ to keep working files out of the
    listing): the review/spec notes the agent wrote in log/*.md and the screenshots under evidence/**. Without this the
    judge cannot see a design review or evidence/ui/sheet.png that exist, and sends the agent back for them
    ("Goal check 1/2"), seen on every premium-UI run (2026-11-26)."""
    lines = []
    try:
        ld = os.path.join(host_dir, 'log')
        fs = [f for f in os.listdir(ld) if f.endswith('.md') and f not in _LOG_SKIP and os.path.isfile(os.path.join(ld, f))]
        fs.sort(key=lambda f: os.path.getmtime(os.path.join(ld, f)), reverse=True)
        for f in fs[:10]:
            p = os.path.join(ld, f)
            fact = _rows(p)
            lines.append(f'- log/{f} ({os.path.getsize(p)} bytes{", " + fact if fact else ""})')
    except Exception:
        pass
    try:
        ev = os.path.join(host_dir, 'evidence')
        for root, dirs, files in os.walk(ev):
            dirs[:] = sorted(d for d in dirs if d not in ('node_modules', '.git'))[:12]
            if root[len(ev):].count(os.sep) > 2:
                dirs[:] = []
            imgs = sorted(f for f in files if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')))
            if imgs and root != ev:
                lines.append(f"- evidence/{os.path.relpath(root, ev)}/ ({len(imgs)} images, e.g. {', '.join(imgs[:6])})")
    except Exception:
        pass
    return lines[:24]


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


def child_run_facts(r):
    """Structured evidence of jobs started from this conversation (not the agent's words)."""
    # r is the runner's sqlite3.Row (agentd passes the runs row), or a dict in tests: index it, don't type-check it.
    try:
        cid = r['conversation_id'] if r is not None else None
    except (KeyError, IndexError, TypeError):
        cid = None
    if not cid:
        return '- none (no conversation id)'
    dbpath = '/opt/agent/workspace/runs/runs.db'
    try:
        import sqlite3
        db = sqlite3.connect(dbpath, timeout=5)
        try:
            db.row_factory = sqlite3.Row
            rows = list(db.execute(
                "SELECT id, status, title, conversation_id, started_at, finished_at FROM runs "
                "WHERE parent_conversation_id=? ORDER BY created_at", (cid,)))
        finally:
            db.close()
    except Exception as e:
        return f'- (could not read runs db: {type(e).__name__})'
    if not rows:
        return '- none'
    lines = []
    for x in rows[:20]:
        lines.append(f"- {x['id']} status={x['status']} title={str(x['title'] or '')[:80]} "
                     f"conversation_id={x['conversation_id']}")
    return '\n'.join(lines)


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


def pinned_requirements(r):
    """The user's explicit instructions pinned by skill_gate.attach for this run (runner/state/skill-gate.json)."""
    try:
        rec = json.load(open('/opt/agent/runner/state/skill-gate.json')).get(r['id']) or {}
        return [str(x) for x in rec.get('requirements') or [] if str(x).strip()][:10]
    except Exception:
        return []


def earlier_progress(host_dir, limit=2500):
    """Progress the agent recorded in earlier turns (skill-reading 2026-11-26, from the T6 restart test): the checkpoint log
    from the job folder, newest last, so finished steps from before a restart or rollover count as done."""
    try:
        t = open(os.path.join(host_dir, 'log', 'checkpoints.md'), errors='replace').read().strip()
    except OSError:
        return ''
    if not t:
        return ''
    if len(t) > limit:
        t = '[... older entries cut ...]\n' + t[-limit:]
    return '\n\nProgress recorded before and during this turn (log/checkpoints.md, newest last):\n' + t


def stage_facts(host_dir):
    """Films from scratch (production-split 2026-11-26): which stage pages and plan-picked engine pages / reference
    sections reached the agent (video-stage rows in log/read-manifest.jsonl), and the agent's own log/stages.md,
    so the judge can ask for evidence they were read and followed. Structured files only; '' when not a film."""
    plan_p = os.path.join(host_dir, 'scenes', 'plan.json')
    if not os.path.isfile(plan_p):
        return ''
    try:
        pl = json.load(open(plan_p))
    except Exception:
        pl = {}
    picked = []
    for sc in (pl.get('scenes') or []) if isinstance(pl, dict) else []:
        if isinstance(sc, dict):
            for e in [sc.get('engine')] + [l.get('engine') for l in (sc.get('layers') or []) if isinstance(l, dict)]:
                if isinstance(e, str) and e.startswith('lab-engine-') and e not in picked:
                    picked.append(e)
    picked += [x for x in (pl.get('refs') or []) if isinstance(x, str)] if isinstance(pl, dict) else []
    got, stages = set(), {}
    for ln in _read(os.path.join(host_dir, 'log', 'read-manifest.jsonl')).splitlines():
        try:
            x = json.loads(ln)
        except Exception:
            continue
        if x.get('via') == 'video-stage':
            k = x.get('skill') if x.get('file') == 'SKILL.md' else f"{x.get('skill')}/{x.get('file')}"
            got.add(k)
            stages.setdefault(x.get('stage'), []).append(k)
    notes = _read(os.path.join(host_dir, 'log', 'stages.md'))
    out = ['\n\nFilm stage pages (a film from scratch: each stage page and every engine page or reference section its '
           'scenes/plan.json picked must have been opened with video-stage AND applied; log/stages.md is the agent\'s '
           'own per-page note of what it applied):']
    for st_, ks in stages.items():
        out.append(f'- stage {st_}: ' + ', '.join(ks))
    if not stages:
        out.append('- no stage pages were opened')
    miss = [p for p in picked if p not in got]
    out.append('- plan-picked pages/sections not opened: ' + (', '.join(miss) if miss else 'none'))
    out.append('- log/stages.md:\n' + (notes[-3000:] if notes else '(missing)'))
    out.append('If a plan-picked page or section was not opened, or log/stages.md gives no evidence that an opened page '
               'was applied, the verdict is continue and each one is listed as missing.')
    return '\n'.join(out)


def _read(p):
    try:
        return open(p, errors='replace').read()
    except OSError:
        return ''


def check(r, request, reply, host_dir):
    """At finish. Returns (action, message, record): action 'pass' | 'send_back'."""
    reqs = pinned_requirements(r)  # skill-reading 2026-11-26: explicit asks are checked, not excused as "method"
    if reqs:
        request = (request + '\n\nPinned requirements (verbatim from the user; each must be met or its shortfall '
                   'stated):\n' + ''.join(f'- "{x}"\n' for x in reqs))
    st = _load()
    rec = st.get(r['id']) or {'rounds': 0, 'history': [], 'blocker_asked': False}
    if rec.get('final'):
        return 'pass', '', rec  # already judged final for this run (e.g. re-finish after delivery)
    facts = file_facts(host_dir) + '\n\nBackground jobs started from this conversation:\n' + child_run_facts(r)
    facts += earlier_progress(host_dir)
    try:
        facts += stage_facts(host_dir)
    except Exception:
        pass
    v, info = judge(request, reply, facts, r['id'])
    if v and v['verdict'] == 'continue' and os.path.exists(os.path.join(host_dir, 'log', 'context-loop')):
        # The runner paused/warned this run for a context loop (re-reading files that cannot all fit). Pushing it to redo
        # work restarts the loop, so the judge reports its finding and lets the run finish.
        v = dict(v, reason=(v.get('reason') or '') + ' (reported only: the run had a context loop, so no re-push)')
        rec['context_loop_report'] = True
        rec['rounds'] = MAX_ROUNDS
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
