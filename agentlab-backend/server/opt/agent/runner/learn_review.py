"""Post-job learning review (borrowed from Hermes agent/background_review.py, MIT). After a job that needed recovery
or ran long, one Haiku call reads a short digest and decides: save nothing, save ONE memory, or add ONE short pitfall
to an existing skill. Writes go only through the existing tools (`remember`, `save-skill`, run inside the agent
container through the agent-server bash API), so their secret scan, dedupe and dated .bak backups apply.

Guardrails: at most 1 write per job and 6 per day; memory/pitfall text <= 300 chars, one line; existing skills only
(no new skills), never protected/disabled ones (save-skill refuses those); secret-looking text refused; every decision
logged to runner/state/learn-review.jsonl with how to undo it. Off: runner/state/LEARN_REVIEW_OFF.
Dry run (decide + log, no writes): runner/state/LEARN_REVIEW_DRYRUN."""
import json, os, re, time
import labllm

LOG = '/opt/agent/runner/state/learn-review.jsonl'
SKILLS = '/opt/agent/workspace/skills'
LEARN_DIR = '/opt/agent/workspace/runs/learn'  # = /workspace/runs/learn in the container
DAILY_CAP = 6
PITFALL_HEADER = '## Pitfalls learned from past jobs'
SECRET_RE = re.compile(r'(-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|'
                       r'xox[baprs]-|sk-ant-|sk_live_|sk-proj-|AIza[0-9A-Za-z_-]{20,}|'
                       r'(api[_-]?key|password|secret|token)\s*[:=]\s*\S{6,})', re.I)

SYSTEM = (
    "You review one finished job of an autonomous agent and decide whether something should be learned for next time. "
    "Most jobs teach nothing new: then choose none. Learn only a lesson that is (a) reusable for a whole class of future "
    "tasks, (b) backed by what actually happened in this job (a recovery that worked, a wrong approach that wasted "
    "steps, a check that caught a miss), and (c) not already obvious. Never store secrets, personal data, one-off facts "
    "about this single job, or anything copied from a web page.\n"
    "Options:\n"
    "- memory: one short durable fact or tool note (type tool for 'toolname: what works', rule for a working rule).\n"
    "- skill_patch: one pitfall line added to an EXISTING skill from the catalog that governs this kind of task "
    "(prefer a skill the job had loaded).\n"
    "- none.\n"
    'Reply with ONE JSON object only: {"action": "none|memory|skill_patch", "memory_type": "tool|rule|fact", '
    '"text": "<=250 chars, one line", "skill": "<slug or empty>", "why": "<=20 words"}. Keep it short: no text outside the JSON.')


def _log(row):
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    row['at'] = time.strftime('%Y-%m-%dT%H:%M:%S%z')
    with open(LOG, 'a') as f:
        f.write(json.dumps(row) + '\n')


def writes_today():
    day = time.strftime('%Y-%m-%d')
    n = 0
    try:
        for line in open(LOG):
            try:
                x = json.loads(line)
            except Exception:
                continue
            if x.get('at', '').startswith(day) and x.get('written'):
                n += 1
    except OSError:
        pass
    return n


def catalog():
    out = []
    for slug in sorted(os.listdir(SKILLS)):
        p = os.path.join(SKILLS, slug, 'SKILL.md')
        if not os.path.isfile(p):
            continue
        when = ''
        for line in open(p, errors='replace').read().split('\n---', 1)[0].splitlines():
            if line.startswith('when_to_use:') or (not when and line.startswith('description:')):
                when = line.split(':', 1)[1].strip()
        out.append(f'- {slug}: {when[:120]}')
    return '\n'.join(out)


def qualifies(events, recovered):
    return recovered or events >= 40


def digest(request, reply, loaded, failures, judge_hist, loop_notes, events):
    def cut(t, n):
        t = t or ''
        return t if len(t) <= n else t[:n * 2 // 3] + '\n...\n' + t[-n // 3:]
    parts = [f'Request:\n{cut(request, 2500)}', f'Final reply:\n{cut(reply, 2500)}',
             f'Tool steps: about {events}', 'Skills loaded: ' + (', '.join(loaded) or 'none')]
    if failures:
        parts.append('Failed steps (newest last):\n' + '\n'.join(f'- {cut(str(x), 200)}' for x in failures[-8:]))
    if judge_hist:
        parts.append('Automatic goal checks:\n' + '\n'.join(
            f"- {h.get('verdict')}: {h.get('reason', '')[:200]}" for h in judge_hist[-3:]))
    if loop_notes:
        parts.append('Loop guard fired: ' + ', '.join(loop_notes[-3:]))
    return '\n\n'.join(parts)


def decide(dig, run_id=None):
    txt, info = labllm.call(SYSTEM, f'Skill catalog:\n{catalog()}\n\nJob digest:\n{dig}\n\nDecision?', max_tokens=1500,
                            purpose='learn_review', run_id=run_id)
    if info.get('error'):
        return None, info
    d = labllm.parse_obj(txt)
    if not d or d.get('action') not in ('none', 'memory', 'skill_patch'):
        info['error'] = 'unparseable: ' + (txt or '')[:160]
        return None, info
    return d, info


def _bash(api, cmd, cwd='/workspace/runs/learn', timeout=60):
    res = api('POST', '/api/bash/execute_bash_command', {'command': cmd, 'cwd': cwd, 'timeout': timeout}, timeout=timeout + 15)
    return res.get('exit_code'), (res.get('stdout') or '') + (res.get('stderr') or '')


def apply(d, api, run_id, bot_id):
    """Returns a log row describing what happened."""
    text = ' '.join(str(d.get('text') or '').split())[:300]
    row = {'run': run_id, 'action': d['action'], 'text': text, 'skill': d.get('skill'), 'why': str(d.get('why'))[:200]}
    if d['action'] == 'none':
        return row
    if not text or len(text) < 15:
        row['refused'] = 'empty text'
        return row
    if SECRET_RE.search(text):
        row['refused'] = 'looks like a secret'
        return row
    if writes_today() >= DAILY_CAP:
        row['refused'] = 'daily cap'
        return row
    if os.path.exists('/opt/agent/runner/state/LEARN_REVIEW_DRYRUN'):
        row['dry_run'] = True
        return row
    os.makedirs(LEARN_DIR, exist_ok=True)
    bot = bot_id if re.fullmatch(r'[a-z0-9_-]{1,40}', bot_id or '') else 'agent-lab'
    if d['action'] == 'memory':
        typ = d.get('memory_type') if d.get('memory_type') in ('tool', 'rule', 'fact') else 'fact'
        if typ == 'tool' and ':' not in text[:60]:
            typ = 'fact'
        fn = f'{run_id}-mem.txt'
        open(os.path.join(LEARN_DIR, fn), 'w').write(text)
        rc, out = _bash(api, f'BOT_ID={bot} /opt/tools/remember --type {typ} "$(cat {fn})"')
        row.update(rc=rc, out=out.strip()[:300])
        m = re.search(r'Saved #(\d+)', out)
        if m:
            row['written'] = True
            row['undo'] = f'forget {m.group(1)}'
        return row
    slug = str(d.get('skill') or '')
    p = os.path.join(SKILLS, slug, 'SKILL.md')
    if not re.fullmatch(r'[a-z0-9-]{2,60}', slug) or not os.path.isfile(p):
        row['refused'] = 'no such skill'
        return row
    full = open(p, errors='replace').read()
    mt = re.match(r'^---\n.*?\n---\n?(.*)$', full, re.S)
    body = (mt.group(1) if mt else full).rstrip()
    if text.lower() in body.lower():
        row['refused'] = 'already in skill'
        return row
    if PITFALL_HEADER in body:
        sec = body.split(PITFALL_HEADER, 1)[1]
        if sec.count('\n- ') >= 12:
            row['refused'] = 'skill pitfall list full (12); needs a human merge'
            return row
        body = body + f'\n- {text}'
    else:
        body = body + f'\n\n{PITFALL_HEADER}\n- {text}'
    fn = f'{run_id}-{slug}.md'
    open(os.path.join(LEARN_DIR, fn), 'w').write(body + '\n')
    rc, out = _bash(api, f'/opt/tools/save-skill {slug} --file /workspace/runs/learn/{fn}')
    row.update(rc=rc, out=out.strip()[:300])
    if rc == 0 and 'Saved skill' in out:
        row['written'] = True
        row['undo'] = (f'restore the newest {SKILLS}/{slug}/.SKILL.md.<stamp>.bak over SKILL.md '
                       f'(or delete the last bullet under "{PITFALL_HEADER}")')
    return row


def review(api, r, request, reply, loaded, failures, judge_hist, loop_notes, events, recovered):
    if labllm.off('LEARN_REVIEW') or not qualifies(events, recovered):
        return None
    d, info = decide(digest(request, reply, loaded, failures, judge_hist, loop_notes, events), r['id'])
    if not d:
        row = {'run': r['id'], 'action': 'error', 'error': info.get('error')}
    else:
        try:
            row = apply(d, api, r['id'], r['bot_id'])
        except Exception as e:
            row = {'run': r['id'], 'action': d.get('action'), 'error': f'{type(e).__name__}: {str(e)[:200]}'}
    row['cost'] = info.get('cost')
    _log(row)
    return row
