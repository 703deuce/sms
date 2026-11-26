"""CLIs for routines, reminders, helpers, checkpoints and notifications (run inside the agent container)."""
import argparse, json, os, re, sys, time
import runlib as R

WEBHOOK_BASE = 'https://transovo.ai/api/agent-lab/webhooks'


def me():
    cid, job = R.job_from_cwd()
    return cid, job


def fmt_routine(r):
    when = r['cron'] and f"cron '{r['cron']}' ({r['tz']})" or (r['kind'] == 'once' and 'once') or 'webhook only'
    state = 'done' if r['done'] else ('paused' if r['paused'] else 'active')
    hook = ' +webhook' if r['webhook'] else ''
    nxt = f" next {R.local(r['next_run_at'], r['tz'])}" if r['next_run_at'] and not r['paused'] and not r['done'] else ''
    return f"{r['id']}  [{state}] {r['name'] or ''} {when}{hook} action={r['action']}{nxt}\n    {r['prompt'][:200]}"


def cmd_routine(argv):
    p = argparse.ArgumentParser(prog='routine', description='Scheduled / webhook-triggered runs. Plain code decides when; '
                                'the agent only wakes when a run starts (a fresh conversation with the saved prompt).')
    sub = p.add_subparsers(dest='cmd', required=True)
    a = sub.add_parser('add', help='add a routine')
    a.add_argument('prompt')
    a.add_argument('--cron', help='5-field cron, e.g. "0 8 * * *" (minute hour dom month dow)')
    a.add_argument('--tz', default=R.DEFAULT_TZ)
    a.add_argument('--name')
    a.add_argument('--webhook', action='store_true', help='also allow triggering by POST to a secret webhook URL')
    a.add_argument('--notify-only', action='store_true', help='just post the text as a notification (no agent run)')
    a.add_argument('--script', help='zero-token routine: run this script (in your job folder) on the schedule with NO '
                   'model call; PROMPT is what the agent should do with the output when it wakes')
    a.add_argument('--wake-on', choices=['change', 'output'], default='change',
                   help='script routines: act when the output changes (default) or whenever there is any output; a '
                   'failing script always reports')
    a.add_argument('--then', choices=['notify', 'run'], default='notify',
                   help='script routines: post the output to Rick (default, zero tokens) or start an agent run with it')
    for n in ('rm', 'pause', 'resume', 'run', 'rotate-secret', 'show'):
        s = sub.add_parser(n)
        s.add_argument('id')
    sub.add_parser('list').add_argument('--all', action='store_true')
    args = p.parse_args(argv)
    db = R.connect()
    cid, _ = me()
    if args.cmd == 'add':
        if not args.cron and not args.webhook:
            p.error('give --cron and/or --webhook (for a one-off use `remind`)')
        nxt = None
        if args.cron:
            nxt = R.iso(R.cron_next(args.cron, args.tz))
        rid = R.new_id('rt')
        secret = h = None
        action, prompt = ('notify' if args.notify_only else 'run'), args.prompt
        if args.script:
            if not args.cron:
                p.error('--script needs --cron')
            import json as _j, re as _re
            sp = os.path.abspath(args.script)
            m = _re.match(r'^(/workspace/jobs/[0-9a-f-]{36}(?:/helpers/[0-9a-f-]{36})*)/', sp)
            if not m or not os.path.isfile(sp):
                p.error('--script must be an existing file inside your job folder')
            action = 'script'
            prompt = _j.dumps({'script': sp, 'root': m.group(1), 'on': args.wake_on, 'then': args.then,
                               'task': args.prompt})
        if args.webhook:
            secret, h = R.make_secret()
        db.execute('''INSERT INTO routines(id, bot_id, name, kind, cron, tz, action, prompt, webhook, secret_hash, next_run_at,
                      created_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                   (rid, R.BOT, args.name, 'cron' if args.cron else 'webhook', args.cron, args.tz,
                    action, prompt, int(args.webhook), h, nxt, R.iso(R.now()), cid))
        if action == 'script':
            print('Zero-token script routine: the script runs on schedule with no model call; ' +
                  ('Rick gets the output as a notification' if args.then == 'notify' else 'an agent run starts with the output') +
                  f" when it {'changes' if args.wake_on == 'change' else 'prints anything'} or the script fails. Test it now "
                  f'with `routine run {rid}` (fires on the next runner tick).')
        print(f'Added routine {rid}' + (f"; next run {R.describe(R.parse_iso(nxt), args.tz)}" if nxt else '') +
              '\nTell Rick the schedule and the next run date and time (ET) in your reply.')
        if secret:
            print(f'Webhook: POST {WEBHOOK_BASE}/{rid}  with header "X-Webhook-Secret: {secret}" (JSON body optional; '
                  'it is passed to the run as data). The secret is shown only now; `routine rotate-secret` makes a new one.')
        return
    if args.cmd == 'list':
        q = 'SELECT * FROM routines WHERE bot_id=?' + ('' if args.all else ' AND done=0') + ' ORDER BY created_at'
        rows = db.execute(q, (R.BOT,)).fetchall()
        print('\n'.join(fmt_routine(r) for r in rows) or 'No routines.')
        return
    r = db.execute('SELECT * FROM routines WHERE id=? AND bot_id=?', (args.id, R.BOT)).fetchone()
    if not r:
        sys.exit(f'No routine {args.id}')
    if args.cmd == 'show':
        print(fmt_routine(r))
    elif args.cmd == 'rm':
        db.execute('DELETE FROM routines WHERE id=?', (r['id'],))
        print(f'Removed {r["id"]}')
    elif args.cmd == 'pause':
        db.execute('UPDATE routines SET paused=1 WHERE id=?', (r['id'],))
        print(f'Paused {r["id"]}')
    elif args.cmd == 'resume':
        nxt = R.iso(R.cron_next(r['cron'], r['tz'])) if r['cron'] else r['next_run_at']
        db.execute('UPDATE routines SET paused=0, next_run_at=? WHERE id=?', (nxt, r['id']))
        print(f'Resumed {r["id"]}' + (f'; next run {R.local(nxt, r["tz"])}' if nxt else ''))
    elif args.cmd == 'run' and r['action'] == 'script':
        db.execute('UPDATE routines SET next_run_at=? WHERE id=?', (R.iso(R.now()), r['id']))
        print(f'Script routine {r["id"]} will run on the next runner tick (within ~10 s); results go to notifications.')
    elif args.cmd == 'run':
        run_id, _ = R.enqueue(db, r['prompt'], 'routine', title=r['name'], routine_id=r['id'], created_by=cid)
        print(f'Queued {run_id}')
    elif args.cmd == 'rotate-secret':
        secret, h = R.make_secret()
        db.execute('UPDATE routines SET webhook=1, secret_hash=? WHERE id=?', (h, r['id']))
        print(f'Webhook: POST {WEBHOOK_BASE}/{r["id"]}  header "X-Webhook-Secret: {secret}"')


def cmd_remind(argv):
    p = argparse.ArgumentParser(prog='remind', description='One-off reminder: posts a notification to Rick at a time '
                                '(or, with --run, starts an agent run with the text as the task).')
    p.add_argument('text')
    p.add_argument('--at', required=True, help='"5pm", "17:30", "in 10 minutes", "tomorrow 9am", "2026-11-24 08:00"')
    p.add_argument('--tz', default=R.DEFAULT_TZ)
    p.add_argument('--run', action='store_true', help='start an agent run instead of only notifying')
    args = p.parse_args(argv)
    when = R.parse_when(args.at, args.tz)
    db = R.connect()
    cid, _ = me()
    rid = R.new_id('rm')
    db.execute('''INSERT INTO routines(id, bot_id, name, kind, tz, action, prompt, next_run_at, created_at, created_by)
                  VALUES (?,?,?,?,?,?,?,?,?,?)''', (rid, R.BOT, 'reminder', 'once', args.tz,
                                                    'run' if args.run else 'notify', args.text, R.iso(when), R.iso(R.now()), cid))
    note = (f"\nNote: read \"{args.at}\" as the coming {when.astimezone(R.ZoneInfo(args.tz)).strftime('%A')}; "
            "give a date to be exact.") if re.search(r'\bnext\b', args.at.lower()) else ''
    print(f'Reminder {rid} set for {R.describe(when, args.tz)}.{note}\n'
          'Tell Rick this exact date and time (ET) in your reply.')


def helper_ctl(argv):
    p = argparse.ArgumentParser(prog=f'helper {argv[0]}')
    p.add_argument('id')
    if argv[0] == 'send':
        p.add_argument('text')
    args = p.parse_args(argv[1:])
    cid, _ = me()
    db = R.connect()
    db.execute('''CREATE TABLE IF NOT EXISTS helper_ctl(id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, action TEXT,
                  text TEXT, created_by TEXT, created_at TEXT, done_at TEXT, note TEXT)''')
    r = db.execute('SELECT * FROM runs WHERE (id=? OR conversation_id=?) AND source=?', (args.id, args.id, 'helper')).fetchone()
    if not r:
        sys.exit(f'No helper {args.id}')
    if r['kind'] == 'vision':
        if argv[0] == 'send':
            sys.exit('Vision helpers take no messages; stop it and start a new one with the full goal.')
        import subprocess
        subprocess.run(['pkill', '-f', f"--run-id {r['id']}"])
        db.execute("UPDATE runs SET status='stopped', finished_at=?, result=COALESCE(result, ?) WHERE id=?",
                   (R.iso(R.now()), '(vision helper stopped by its parent)', r['id']))
        print(f"Vision helper {r['id']} stopped."); return
    db.execute('INSERT INTO helper_ctl(run_id, action, text, created_by, created_at) VALUES (?,?,?,?,?)',
               (r['id'], argv[0], getattr(args, 'text', None), cid, R.iso(R.now())))
    ctl = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    for _ in range(12):  # the runner handles it within a few seconds
        time.sleep(1)
        row = db.execute('SELECT done_at, note FROM helper_ctl WHERE id=?', (ctl,)).fetchone()
        if row and row['done_at']:
            print(f"helper {argv[0]} {r['id']}: {row['note']}"); return
    print(f"helper {argv[0]} {r['id']}: queued (the runner applies it within seconds)")


def git_worktree(job, wd, ccid, repo):
    """Give a helper its own git worktree (own branch) of the parent's repo, so parallel edits never collide."""
    import subprocess
    top = subprocess.run(['git', '-C', repo, 'rev-parse', '--show-toplevel'], capture_output=True, text=True)
    if top.returncode != 0:
        return None, None
    top = top.stdout.strip()
    branch = f'helper/{ccid[:8]}'
    dest = f'{wd}/repo'
    os.makedirs(wd, exist_ok=True)
    # A local clone (objects hard-linked, own .git) rather than `git worktree`: the helper's sandbox only lets it write
    # inside its own folder, and a worktree would write commits into the parent's .git.
    r = subprocess.run(['git', 'clone', '-q', '--local', top, dest], capture_output=True, text=True)
    if r.returncode == 0:
        r = subprocess.run(['git', '-C', dest, 'checkout', '-q', '-b', branch], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f'helper: could not make the helper repo copy: {r.stderr.strip()[:300]}')
    return dest, branch


def cmd_helper(argv):
    if argv and argv[0] in ('stop', 'send'):
        return helper_ctl(argv)
    if argv and argv[0] in ('status', 'result', 'list'):
        p = argparse.ArgumentParser(prog=f'helper {argv[0]}')
        p.add_argument('id', nargs='?' if argv[0] != 'result' else None)
        p.add_argument('--wait', type=int, default=0, help='seconds to wait for the result')
        args = p.parse_args(argv[1:])
        db = R.connect()
        if not args.id:
            cid, _ = me()
            rows = db.execute("SELECT * FROM runs WHERE source='helper' AND (parent_conversation_id=? OR ? IS NULL) "
                              'ORDER BY created_at DESC LIMIT 20', (cid, cid)).fetchall()
            for r in rows:
                print(f"{r['id']}  {r['status']:8} {r['title'] or r['prompt'][:80]}")
            if not rows:
                print('No helpers.')
            return
        deadline = time.time() + args.wait
        while True:
            r = db.execute('SELECT * FROM runs WHERE id=? OR conversation_id=?', (args.id, args.id)).fetchone()
            if not r:
                sys.exit(f'No helper {args.id}')
            if r['status'] in ('done', 'failed', 'stopped') or time.time() >= deadline:
                break
            time.sleep(5)
        if argv[0] == 'status':
            print(f"{r['id']}  status={r['status']}  folder={r['working_dir']}" +
                  (f"\nlast checkpoint: {r['last_checkpoint']}" if r['last_checkpoint'] else ''))
        else:
            print(r['result'] if r['result'] else f"(no result yet; status={r['status']})")
        return
    p = argparse.ArgumentParser(prog='helper', description='Start a background helper: a fresh agent run in a subfolder '
                                'of your job folder. Returns its id at once; its result is sent back to this conversation '
                                'when it finishes. Also: helper status [id], helper result <id> [--wait N], helper list, '
                                'helper send <id> "message" (steer a running helper), helper stop <id>.')
    p.add_argument('task')
    p.add_argument('--name')
    p.add_argument('--vision', action='store_true', help='vision-actor helper: a cheap vision model that sees screenshots/images '
                   'and does the clicking/typing/file work itself, then returns the outcome + evidence (final screenshot). '
                   'For Opus visual create/judge, use --model opus instead (not --vision).')
    p.add_argument('--model', help='Model/profile for this helper: opus, haiku, lab-opus, ... Default: same as the parent. '
                   'Use opus for visual create/judge and hard engineering (minimal sub-step, then back to Haiku). '
                   'With --vision, this is the vision-actor model (default $VISION_ACTOR_MODEL or deepseek-flash) unless it is opus/haiku.')
    p.add_argument('--max-steps', type=int, default=200)
    p.add_argument('--worktree', nargs='?', const='.', metavar='REPO',
                   help='give the helper its own git worktree + branch of REPO (default: the git repo you are in); '
                        'merge its branch when it reports back')
    args = p.parse_args(argv)
    cid, job = me()
    if not cid:
        sys.exit('Run helper from inside your job folder (cd to /workspace/jobs/<your conversation id>).')
    db = R.connect()
    if args.vision and R.resolve_profile(args.model) in ('lab-opus', 'lab-anthropic'):
        print('Note: --model opus/haiku starts an agent helper on that LLM (it can see images). Dropping --vision.')
        args.vision = False
    if args.vision:
        import uuid, subprocess
        ccid = str(uuid.uuid4())
        wd = f'{job}/helpers/{ccid}'
        os.makedirs(f'{wd}/log', exist_ok=True)
        model = args.model or os.environ.get('VISION_ACTOR_MODEL') or 'deepseek-flash'
        rid, _ = R.enqueue(db, args.task, 'helper', title=args.name or ('[vision] ' + args.task[:70]), parent_conversation_id=cid,
                           created_by=cid, conversation_id=ccid, working_dir=wd, model=model)
        ts = R.iso(R.now())
        db.execute("UPDATE runs SET kind='vision', model=?, status='running', attempts=1, started_at=?, heartbeat_at=?, "
                   'last_event_at=?, resumed_at=? WHERE id=?', (model, ts, ts, ts, ts, rid))
        with open(f'{wd}/log/vision.log', 'ab') as log:
            subprocess.Popen(['/opt/tools/vision-act', '--run-id', rid, '--model', model, '--max-steps', str(args.max_steps)],
                             cwd=wd, stdout=log, stderr=log, stdin=subprocess.DEVNULL, start_new_session=True)
        print(f'Vision helper {rid} started with {model} (folder {wd}). Its outcome + evidence will arrive here as a message; '
              f'or check `helper status {rid}` / `helper result {rid} --wait 300`.')
        return
    import uuid
    ccid = str(uuid.uuid4())
    wt = ''
    if args.worktree:
        dest, branch = git_worktree(job, f'{job}/helpers/{ccid}', ccid, os.path.abspath(args.worktree))
        if not dest:
            sys.exit(f'helper: {args.worktree} is not inside a git repo (drop --worktree, or point it at the repo)')
        wt = (f' Your own git copy of the repo is {dest} on branch {branch} (from the parent\'s last commit): edit and commit '
              'there only; the parent merges it.')
        print(f'Helper repo: {dest} (branch {branch}). Merge later with: git fetch {dest} {branch} && git merge FETCH_HEAD '
              '(uncommitted changes in your repo are not in the helper copy: commit first if it needs them).')
    task = (args.task + '\n\n(You are a background helper for another conversation. Work only in your own folder.' + wt +
            ' ' + R.WORKER_AUTONOMY +
            ' When done, reply with a concise result: what you found or made, full paths of any files'
            + (', and your branch and last commit' if wt else '') + '.)')
    model = args.model
    if model and not R.resolve_profile(model) and model.lower() not in ('parent', 'default', 'auto'):
        sys.exit(f'helper: unknown --model {model!r}. Use haiku or a profile name (opus/fable are unused).')
    if model and R.resolve_profile(model) is None:
        model = None
    want = R.resolve_profile(model) if model else None
    pinned = R.scheduled_profile(model) if model else None
    if want and pinned and pinned != want:
        print(f'Note: {want} is defined but unused (allow_opus is false); this helper runs on {pinned}.')
        model = pinned
    twin = R.failed_twin(db, cid, args.name or args.task[:80])
    if twin:  # a crashed helper already had its one automatic retry
        sys.exit(f'helper: {twin["id"]} ({twin["title"]!r}) already failed. ' + R.CRASH_STOP_NOTE)
    rid, _ = R.enqueue(db, task, 'helper', title=args.name or args.task[:80], parent_conversation_id=cid, created_by=cid,
                       conversation_id=ccid, working_dir=f'{job}/helpers/{ccid}', model=model)
    prof = R.resolve_profile(model)
    on = f' on {prof or model}' if model else ' (same model as this conversation)'
    print(f'Helper {rid} queued{on} (folder {job}/helpers/{ccid}' + (f', worktree {job}/helpers/{ccid}/repo' if wt else '') + '). Its result will arrive here as a message; '
          f'or check `helper status {rid}` / `helper result {rid}`.')


def cmd_checkpoint(argv):
    p = argparse.ArgumentParser(prog='checkpoint', description='Record progress after each major step so a crashed run '
                                'can resume from here. Saved to the run record and log/checkpoints.md.')
    p.add_argument('note', nargs='?')
    p.add_argument('--list', action='store_true')
    args = p.parse_args(argv)
    cid, job = me()
    if not cid:
        sys.exit('Run checkpoint from inside your job folder.')
    db = R.connect()
    run = db.execute('SELECT id FROM runs WHERE conversation_id=?', (cid,)).fetchone()
    if args.list or not args.note:
        for r in db.execute('SELECT * FROM checkpoints WHERE conversation_id=? ORDER BY id', (cid,)):
            print(f"{R.local(r['created_at'])}  {r['note']}")
        return
    ts = R.iso(R.now())
    db.execute('INSERT INTO checkpoints(run_id, conversation_id, note, created_at) VALUES (?,?,?,?)',
               (run['id'] if run else None, cid, args.note, ts))
    if run:
        db.execute('UPDATE runs SET last_checkpoint=? WHERE id=?', (args.note[:2000], run['id']))
    os.makedirs(f'{job}/log', exist_ok=True)
    with open(f'{job}/log/checkpoints.md', 'a') as f:
        f.write(f'- {R.local(ts)}: {args.note}\n')
    print('Checkpoint saved.')


def cmd_notify(argv):
    p = argparse.ArgumentParser(prog='notify', description="Post a notification to Rick's Agent Lab notifications feed.")
    p.add_argument('text')
    p.add_argument('--title')
    p.add_argument('--file', action='append', default=[], help='attach a file path (repeatable)')
    args = p.parse_args(argv)
    cid, _ = me()
    db = R.connect()
    run = db.execute('SELECT id FROM runs WHERE conversation_id=?', (cid,)).fetchone() if cid else None
    files = [os.path.abspath(f) for f in args.file]
    R.notify(db, 'info', args.title or args.text[:120], args.text, run_id=run['id'] if run else None, conversation_id=cid,
             files=files)
    print('Notification posted.')


def cmd_runs(argv):
    p = argparse.ArgumentParser(prog='runs', description='Recent runs and the queue.')
    p.add_argument('-n', type=int, default=15)
    args = p.parse_args(argv)
    db = R.connect()
    for r in db.execute('SELECT * FROM runs WHERE bot_id=? ORDER BY created_at DESC LIMIT ?', (R.BOT, args.n)):
        print(f"{r['id']}  {r['status']:8} {r['source']:8} {R.local(r['created_at'])}  {(r['title'] or r['prompt'])[:70]!r}")


def cmd_visual_owner(argv):
    """Hand the visual piece of a job to the visual owner: a separate conversation on the configured owner model
    (model_owners.json, default lab-opus), started from a written brief, that builds and renders the visuals itself."""
    p = argparse.ArgumentParser(prog='visual-owner', description='Start the visual owner (Opus, its own conversation) '
                                'for this job\'s visual piece: motion graphics, scene/composition code, pages, drawn '
                                'graphics. It designs, writes the code, renders, checks and returns final file paths. '
                                'Also: visual-owner status|result [id] [--wait N].')
    p.add_argument('brief', nargs='?', help='the complete brief (goal, duration, size, style, script/timeline, asset paths)')
    p.add_argument('--brief-file', help='read the brief from this file (preferred for long briefs)')
    p.add_argument('--name')
    if argv[:1] and argv[0] in ('status', 'result', 'list'):
        return cmd_helper(argv)
    args = p.parse_args(argv)
    brief = open(args.brief_file).read() if args.brief_file else (args.brief or '')
    if len(brief.strip()) < 40:
        sys.exit('visual-owner: give the exact paths of the files you prepared (and anything the original request '
                 'does not say), as text or --brief-file. The runner passes the original request to the owner itself.')
    cid, job = me()
    if not cid:
        sys.exit('Run visual-owner from inside your job folder.')
    db = R.connect()
    mine = db.execute('SELECT kind, model FROM runs WHERE conversation_id=?', (cid,)).fetchone()
    if mine and mine['kind'] == 'visual-owner':
        sys.exit('visual-owner: you ARE the visual owner for this job. Build and render the visuals yourself.')
    prev = R.existing_owner(db, job)
    if prev:  # one owner per job: never a second fresh owner, also not after a crash
        sys.exit({'queued': f'visual-owner: {prev["id"]} is already queued for this job. Wait for its result.',
                  'running': f'visual-owner: {prev["id"]} is already working on this job. Wait for its result '
                             f'(`visual-owner result {prev["id"]} --wait 600`); do not start another.',
                  'done': f'visual-owner: {prev["id"]} already delivered for this job (`visual-owner result {prev["id"]}`). '
                          f'For changes, message it: `helper send {prev["id"]} "<what to change>"`.',
                  }.get(prev['status'], f'visual-owner: {prev["id"]} for this job ended {prev["status"]}. '
                        + R.CRASH_STOP_NOTE))
    import uuid
    ccid = str(uuid.uuid4())
    wd = f'{job}/helpers/{ccid}'
    host = wd  # container path; the folder is created by the runner when it starts the conversation
    try:
        os.makedirs(f'{host}/log', exist_ok=True)
        open(f'{host}/brief.md', 'w').write(brief.strip() + '\n')
    except OSError:
        pass
    model = R.visual_owner_profile()
    name = args.name or ('[visual owner] ' + brief.strip().split('\n')[0][:60])
    task = None
    try:  # pass the job's original request through untouched so the helper cannot shrink it
        row = db.execute('SELECT prompt FROM runs WHERE conversation_id=?', (cid,)).fetchone()
        task = R.original_task(row['prompt']) if row else None
    except Exception:
        pass
    rid, _ = R.enqueue(db, R.visual_owner_prompt(brief, wd, name, task), 'helper', title=name, parent_conversation_id=cid,
                       created_by=cid, conversation_id=ccid, working_dir=wd, model=model)
    db.execute("UPDATE runs SET kind='visual-owner' WHERE id=?", (rid,))
    print(f'Visual owner {rid} queued on {model} as its own conversation (folder {wd}, brief saved to {wd}/brief.md). '
          'Its result (final file paths) will arrive here as a message; meanwhile do not make visuals yourself. '
          f'Check with `visual-owner status {rid}` or `visual-owner result {rid} --wait 600`.')


QSCHEMA = """CREATE TABLE IF NOT EXISTS questions(id TEXT PRIMARY KEY, run_id TEXT, conversation_id TEXT, bot_id TEXT,
  title TEXT, question TEXT NOT NULL, choices TEXT, status TEXT NOT NULL DEFAULT 'open', answer TEXT, created_at TEXT NOT NULL,
  expires_at TEXT, answered_at TEXT)"""


def cmd_ask(argv):
    p = argparse.ArgumentParser(prog='ask-user', description='Pause a background job with ONE clear question for Rick. '
                                'He is notified; when he answers, this conversation resumes with his answer. Only for a real '
                                'ambiguity or decision that changes the result; otherwise pick the sensible default and go on.')
    p.add_argument('question')
    p.add_argument('--choice', action='append', default=[], help='an answer option (repeatable, max 6)')
    p.add_argument('--hours', type=float, default=24, help='if unanswered after this, resume with "no answer" (default 24)')
    a = p.parse_args(argv)
    if os.path.exists('/opt/tools/flags/ASK_USER_OFF'):
        sys.exit('ask-user is switched off: choose the most reasonable default, say which one in your reply, and continue.')
    db = R.connect()
    db.execute(QSCHEMA)
    cid, _ = me()
    run = db.execute("SELECT * FROM runs WHERE conversation_id=? ORDER BY created_at DESC LIMIT 1", (cid,)).fetchone() if cid else None
    if not run or (run['source'] == 'user' and not run['parent_conversation_id']):
        print('You are in Rick\'s own chat: just ask him the question in your reply and end your turn (no tool needed).')
        return
    from datetime import timedelta
    qid = R.new_id('q')
    now = R.now()
    choices = [c.strip() for c in a.choice if c.strip()][:6]
    db.execute('INSERT INTO questions(id, run_id, conversation_id, bot_id, title, question, choices, status, created_at, expires_at) '
               "VALUES (?,?,?,?,?,?,?, 'open', ?, ?)", (qid, run['id'], cid, run['bot_id'], run['title'], a.question[:1500],
                                                        json.dumps(choices), R.iso(now), R.iso(now + timedelta(hours=a.hours))))
    body = a.question[:1500] + ''.join(f'\n  {i + 1}. {c}' for i, c in enumerate(choices)) + \
        f'\n\nAnswer by telling the Agent Lab chat (e.g. "answer to {qid}: ..."). The job is paused until then (auto-continues in {a.hours:g} h).'
    R.notify(db, 'needs_rick', f"Question from job: {(run['title'] or run['prompt'] or '')[:70]}", body, run_id=run['id'],
             conversation_id=cid, bot_id=run['bot_id'])
    print(f'Question {qid} sent to Rick. Now END YOUR TURN with one line: "Waiting for Rick: <the question>". Do not do work '
          'that depends on the answer. The runner pauses this job and resumes this same conversation with his answer.')


def cmd_answer(argv):
    p = argparse.ArgumentParser(prog='answer', description="Record Rick's answer to a background job's question "
                                '(the job resumes within seconds). `answer --list` shows open questions.')
    p.add_argument('qid', nargs='?')
    p.add_argument('text', nargs='?')
    p.add_argument('--list', action='store_true')
    a = p.parse_args(argv)
    db = R.connect()
    db.execute(QSCHEMA)
    if a.list or not a.qid:
        rows = db.execute("SELECT * FROM questions WHERE status='open' ORDER BY created_at").fetchall()
        print('\n'.join(f"{r['id']}  [{(r['title'] or '')[:50]}] {r['question'][:300]}" + (f" choices={r['choices']}" if r['choices'] not in (None, '[]') else '')
                        for r in rows) or 'No open questions.')
        return
    if not a.text:
        p.error('give the answer text')
    n = db.execute("UPDATE questions SET status='answered', answer=?, answered_at=? WHERE id=? AND status='open'",
                   (a.text[:3000], R.iso(R.now()), a.qid)).rowcount
    print(f'Answer recorded for {a.qid}; the job resumes shortly.' if n else f'No open question {a.qid} (already answered or expired).')


def main(name):
    {'routine': cmd_routine, 'remind': cmd_remind, 'helper': cmd_helper, 'checkpoint': cmd_checkpoint,
     'notify': cmd_notify, 'runs': cmd_runs, 'visual-owner': cmd_visual_owner, 'ask-user': cmd_ask,
     'answer': cmd_answer}[name](sys.argv[1:])
