"""`job`: the front desk's tool for background workers (start, list/status, result, steer, cancel)."""
import argparse, os, sys, time
import runlib as R
import joblib as J

HELP = '''Background jobs for the front desk (the chat with Rick). Each job is its own agent run in parallel; this chat
stays free. Its result arrives in this chat as a [Background job ...] message when it finishes.
  job start "full self-contained task" [--name "short name"]
  job list                      all jobs of this chat with status and latest progress
  job status [N|name]           one job (or all active ones): status, time, latest progress line
  job result N|name             the finished job's result
  job steer N|name "message"    new instructions for a running (or queued) job
  job cancel N|name|all         stop one job, or every job of this chat ("stop" from Rick = job cancel all)
N is the job number shown by `job list` (1 = first job started in this chat).'''


def me():
    cid, job = R.job_from_cwd()
    if not cid:
        sys.exit('job: run this from your job folder (/workspace/jobs/<your conversation id>).')
    return cid, job


def line(i, r):
    st = r['status']
    st = 'cancelled' if st == 'stopped' else st
    prog = (r['progress'] or r['last_checkpoint'] or '').replace('\n', ' ')
    s = f"{i}. {r['name'] or r['title']}: {st} ({J.elapsed(r)})"
    if st in J.ACTIVE and prog:
        s += f'\n   latest: {prog[:220]}'
    if st == 'failed' and r['error']:
        s += f"\n   error: {r['error'][:220]}"
    return s


def numbered(db, cid):
    return list(enumerate(J.jobs_of(db, cid), 1))


def control(db, r, action, text=None, cid=None):
    db.execute('''CREATE TABLE IF NOT EXISTS helper_ctl(id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, action TEXT,
                  text TEXT, created_by TEXT, created_at TEXT, done_at TEXT, note TEXT)''')
    db.execute('INSERT INTO helper_ctl(run_id, action, text, created_by, created_at) VALUES (?,?,?,?,?)',
               (r['run_id'], action, text, cid, R.iso(R.now())))
    return db.execute('SELECT last_insert_rowid()').fetchone()[0]


def wait_ctl(db, ids, secs=4):
    end = time.time() + secs
    while time.time() < end:
        left = [i for i in ids if not db.execute('SELECT done_at FROM helper_ctl WHERE id=?', (i,)).fetchone()['done_at']]
        if not left:
            return True
        time.sleep(1)
    return False


def main():
    argv = sys.argv[1:]
    if not argv or argv[0] in ('-h', '--help', 'help'):
        print(HELP); return
    cmd, rest = argv[0], argv[1:]
    cid, job = me()
    db = J.connect()
    mine = db.execute('SELECT source FROM runs WHERE conversation_id=?', (cid,)).fetchone()
    if cmd == 'start':
        if '/helpers/' in job or (mine and mine['source'] == 'helper'):
            sys.exit('job: you are a background worker, not the front desk. Do this work yourself '
                     '(use `helper` for an independent side task or an Opus sub-step).')
        p = argparse.ArgumentParser(prog='job start')
        p.add_argument('task')
        p.add_argument('--name')
        a = p.parse_args(rest)
        import uuid
        ccid = str(uuid.uuid4())
        wd = f'{job}/helpers/{ccid}'
        name = (a.name or a.task.strip().split('\n')[0])[:60]
        # Model ownership: code (not the agent) classifies the work and picks the owner model.
        wclass, cues = R.classify_work(R.classification_text(a.task))
        tail = ('When done, reply with the result itself (the answer or findings, or what you made with full file '
                'paths), concise and ready to pass on.')
        if wclass == 'visual':  # the whole job is visual: the worker itself is the visual owner (fresh Opus conversation)
            model, kind = R.visual_owner_profile(), 'visual-owner'
            prompt = (f'{J.WORKER_MARK} {name}\n\n' + R.visual_owner_prompt('(whole job; no helper prep)', wd, name, a.task) + '\n\n'
                      '(You are a background worker. Rick is not watching: the front desk relays your final reply. '
                      'Never start `job`s. After each major step run `checkpoint "what is done, what is next"`. A '
                      '"[Message from the conversation that started you]" is Rick\'s new instruction relayed by the front '
                      f'desk: follow it at once. {tail})')
        else:
            model, kind = R.mechanical_owner_profile(), 'agent'
            prompt = (f'{J.WORKER_MARK} {name}\n\n{a.task.strip()}\n\n'
                      '(You are a background worker. Rick is not watching this conversation: the front desk chat relays your '
                      'final reply to him. Do the whole task yourself here' + (' (except the visual piece, see below)' if wclass == 'mixed' else '') + '; never start `job`s. Work and save files only in your '
                      f'own folder {wd}. After each major step run `checkpoint "what is done, what is next"` (the front desk shows '
                      'it as your progress). A "[Message from the conversation that started you]" is Rick\'s new instruction '
                      f'relayed by the front desk: follow it at once. {R.WORKER_AUTONOMY} {tail})'
                      + (f'\n\n({R.MIXED_JOB_NOTE})' if wclass == 'mixed' else ''))
        rid, _ = R.enqueue(db, prompt, 'helper', title=name, parent_conversation_id=cid, created_by=cid,
                           conversation_id=ccid, working_dir=wd, model=model)
        if kind != 'agent':
            db.execute('UPDATE runs SET kind=? WHERE id=?', (kind, rid))
        db.execute('INSERT INTO jobs(run_id, front_cid, name, created_at, work_class) VALUES (?,?,?,?,?)',
                   (rid, cid, name, R.iso(R.now()), wclass))
        n = len(J.jobs_of(db, cid))
        active = len(J.jobs_of(db, cid, active_only=True))
        owner = {'visual': f'visual owner on {model}', 'mixed': f'{model} for the mechanical steps, visual piece handed to the visual owner',
                 'mechanical': f'{model}'}[wclass]
        print(f'Job {n} started: "{name}" ({active} active in this chat; work class {wclass}: {owner}). It runs in the background; its result will '
              'arrive here as a message. Tell Rick in one short line that you are on it, then end your turn.')
        return
    if cmd in ('list', 'status'):
        rows = numbered(db, cid)
        if cmd == 'status' and rest:
            r = J.find(db, cid, rest[0])
            if not r:
                sys.exit(f'job: no job {rest[0]!r} in this chat (see `job list`).')
            rows = [(i, x) for i, x in rows if x['run_id'] == r['run_id']]
        elif cmd == 'status':
            rows = [(i, x) for i, x in rows if x['status'] in J.ACTIVE] or rows[-3:]
        if not rows:
            print('No jobs in this chat.'); return
        print('\n'.join(line(i, r) for i, r in rows)); return
    if cmd == 'result':
        if not rest:
            sys.exit('usage: job result N|name')
        r = J.find(db, cid, rest[0])
        if not r:
            sys.exit(f'job: no job {rest[0]!r}')
        print(r['result'] or f"(no result yet; {r['status']}, latest: {r['progress'] or '-'})"); return
    if cmd == 'steer':
        if len(rest) < 2:
            sys.exit('usage: job steer N|name "message"')
        r = J.find(db, cid, rest[0])
        if not r:
            sys.exit(f'job: no job {rest[0]!r}')
        text = ' '.join(rest[1:])
        if r['status'] == 'queued':
            db.execute('UPDATE runs SET prompt=prompt||? WHERE id=? AND status=\'queued\'',
                       (f'\n\n[Update from Rick before you started] {text}', r['run_id']))
            db.execute('UPDATE jobs SET steer_count=steer_count+1 WHERE run_id=?', (r['run_id'],))
            print(f'Job "{r["name"]}" had not started yet; the new instruction was added to its task.'); return
        if r['status'] != 'running':
            sys.exit(f'job: "{r["name"]}" is {r["status"]}; start a new job with the full updated task instead.')
        i = control(db, r, 'send', text, cid)
        db.execute('UPDATE jobs SET steer_count=steer_count+1 WHERE run_id=?', (r['run_id'],))
        ok = wait_ctl(db, [i])
        print(f'Sent to job "{r["name"]}"' + ('' if ok else ' (queued; the runner delivers it within seconds)') +
              '. It reads it before its next step.'); return
    if cmd == 'cancel':
        if not rest:
            sys.exit('usage: job cancel N|name|all')
        rows = J.jobs_of(db, cid, active_only=True) if rest[0] == 'all' else [J.find(db, cid, rest[0])]
        rows = [r for r in rows if r]
        if not rows:
            print('No running jobs to cancel.' if rest[0] == 'all' else f'job: no job {rest[0]!r}'); return
        ids = []
        for r in rows:
            if r['status'] not in J.ACTIVE:
                print(f'"{r["name"]}" already {r["status"]}.'); continue
            db.execute('UPDATE jobs SET cancelled_by=? WHERE run_id=?', ('front desk', r['run_id']))
            ids.append(control(db, r, 'stop', None, cid))
        ok = wait_ctl(db, ids) if ids else True
        print(f'Cancelled {len(ids)} job(s)' + ('' if ok else ' (the runner finishes stopping them within seconds)') + '.'); return
    sys.exit(f'job: unknown command {cmd!r}\n{HELP}')


if __name__ == '__main__':
    main()
