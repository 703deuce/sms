"""Skill gate: runner-enforced skill selection and proof of reading (COS-19; John t796u, t797u, t801u-t805u).

Selection: one small Haiku router call per run start (front desk first turn, workers, helpers, visual owners). It gets
the task/brief (runner boilerplate removed) plus the catalog of skill slugs and one-line when-to-use lines, and returns
0-3 skills as JSON (and a path for skills that declare paths). Only those are injected; the agent never sees the
catalog for this. Router errors -> nothing attached. Picks and cost go to the runner log and state.

SKILL.md frontmatter (single-line values) a skill may declare:
  when_to_use (or description)  the line the router sees
  paths:            e.g. film, byo_edit, clip_pack, revision; the router picks one
  must_read:        files (relative to the skill folder) required on every path
  must_read_<path>: extra files required on that path
  must_read_roles:  who is gated: owner, worker (default both); front desk is never gated
  attach_roles:     owner, worker, front (default all)
  checklist:        file added to the required list, and the run is told to check against it
  deliver_check:    "<file>[,<file>] => <regex> | <message>" (regex and message separated by space-pipe-space)
  attach:           full (default when short) or until:<heading line>
  gate_if_outputs:  globs in the job folder (e.g. out/*.mp4); if the router did not attach this skill but a gated
                    role delivers such files, the common must_read list is required anyway (router-miss backstop)
A new skill works by adding a SKILL.md with these lines; nothing here is skill-specific.

Backstop at delivery: required files are checked against conversation events + log/read-manifest.jsonl, and a
failed deliver_check counts too; the run is sent back once (visual_gate pattern), then passes and is flagged.
State: runner/state/skill-gate.json (per run) and <job>/log/skill-gate.json."""
import json, os, re, time

ROOTS = [os.environ.get('LAB_SKILLS_HOST', '/opt/agent/workspace/skills')]
CONTAINER_SKILLS = '/workspace/skills'
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'state', 'skill-gate.json')
FULL_MAX = 6000      # bodies up to this size are attached whole
GENERIC = {'readme.md', 'skill.md', 'index.md', 'notes.md'}


def _fm(text):
    meta, body = {}, text
    m = re.match(r'^---\n(.*?)\n---\n?(.*)$', text, re.S)
    if m:
        body = m.group(2)
        for line in m.group(1).splitlines():
            k, _, v = line.partition(':')
            if v and re.match(r'^[a-z_]+$', k.strip()):
                meta[k.strip()] = v.strip().strip('"\'')
    return meta, body


def _list(v):
    return [x.strip() for x in (v or '').split(',') if x.strip()]


def skills():
    out = []
    for root in ROOTS:
        if not os.path.isdir(root):
            continue
        for slug in sorted(os.listdir(root)):
            p = os.path.join(root, slug, 'SKILL.md')
            if not os.path.isfile(p):
                continue
            meta, body = _fm(open(p, encoding='utf-8', errors='replace').read())
            ck = meta.get('checklist', '').strip()
            paths = _list(meta.get('paths'))
            out.append({'slug': slug, 'dir': os.path.dirname(p), 'meta': meta, 'body': body,
                        'when': meta.get('when_to_use') or meta.get('description') or '',
                        'must_common': _list(meta.get('must_read')), 'paths': paths,
                        'must_by_path': {pa: _list(meta.get('must_read_' + pa)) for pa in paths},
                        'checklist': ck,
                        'must_roles': _list(meta.get('must_read_roles')) or ['owner', 'worker'],
                        'attach_roles': _list(meta.get('attach_roles')) or ['owner', 'worker', 'front'],
                        'deliver_check': meta.get('deliver_check', '').strip(),
                        'gate_rows': meta.get('gate_rows', '').strip(), 'gate_cmd': meta.get('gate_cmd', '').strip(),
                        'gate_if_outputs': _list(meta.get('gate_if_outputs'))})
    return out


def must_for(sk, path):
    """Full required list for the job's path: the skill's common list plus that path's files (plus checklist)."""
    must = list(sk['must_common'])
    for f in sk['must_by_path'].get(path or '', []):
        if f not in must:
            must.append(f)
    if sk['checklist'] and sk['checklist'] not in must and must:
        must.append(sk['checklist'])
    return must


def role(r):
    kind = r['kind'] if 'kind' in r.keys() else 'agent'
    if kind == 'vision':
        return None
    if r['source'] == 'user':
        return 'front'
    return 'owner' if kind == 'visual-owner' else 'worker'


_BOILER = None


def _boiler():
    """Sentences of the runner's own prompt templates (runlib/jobs string constants, the owner template). They mention
    video, render, voiceover etc. on every run, so they are removed before matching: only the task/brief counts."""
    global _BOILER
    if _BOILER is None:
        texts = []
        for modname in ('runlib', 'jobs'):
            try:
                mod = __import__(modname)
            except Exception:
                continue
            texts += [v for k, v in vars(mod).items() if k.isupper() and isinstance(v, str) and len(v) > 80]
            if hasattr(mod, 'visual_owner_prompt'):
                try:
                    texts.append(mod.visual_owner_prompt('', '\x00', job_name='\x00', task=None))
                except Exception:
                    pass
        sents = set()
        for t in texts:
            for piece in re.split(r'\x00|\n|(?<=[.:;])\s+', t):
                piece = piece.strip()
                if len(piece) >= 30:
                    sents.add(piece)
        _BOILER = sorted(sents, key=len, reverse=True)
    return _BOILER


def task_text(prompt):
    t = prompt or ''
    for piece in _boiler():
        if piece in t:
            t = t.replace(piece, ' ')
    return t


ROUTER_SYSTEM = (
    'You route tasks for an agent runner. Do these three things, in this order, and nothing else. '
    '1. Decide what the person is really asking. People are often indirect but mean the same thing. '
    'Judge by meaning, not by words that merely appear. State that intent in one plain-words line. '
    '2. Based on that intent, pick the skills the agent clearly needs from the catalog (slug: when to use it), '
    'usually 0 to 2, never more than 3. Pick none when the intent does not clearly need one. '
    'Respect each skill\'s "Not for" clause: never pick a skill for a task its "Not for" list names. '
    'For a skill that lists paths, also choose the one path that fits. '
    '3. If you cannot tell what they mean, and the meaning could materially change the result, set ambiguous to true '
    'and write one short clarify_question that would resolve it. If the request is clear enough to act, set ambiguous '
    'to false and clarify_question to null. Do not flag a clear request as ambiguous, even when a detail has a '
    'reasonable default or is implied. '
    'Reply with JSON only: {"intent": "one plain-words line", "skills": [{"slug": "...", "path": "..." or null}], '
    '"why": "at most 15 words", "ambiguous": false, "clarify_question": null}')


def _profile_model():
    try:
        m = json.load(open('/opt/agent/oh-home/profiles/lab-anthropic.json')).get('model') or ''
    except Exception:
        m = ''
    return (m.split('/', 1)[1] if m.startswith('anthropic/') else m) or 'claude-haiku-5-5'


HAIKU = (0.10, 0.50, 0.01, 0.125)  # $/M in, out, cache read, cache write (John's rates)


def parse_router_reply(txt):
    """Parse the router MODEL's reply (not user text). Tolerates code fences, text before/after the object,
    null paths, unescaped quotes in "why", and a reply cut off by max_tokens. None only if no skill slug is found."""
    t = (txt or '').strip()
    i = t.find('{')
    if i >= 0:
        try:
            obj, _ = json.JSONDecoder().raw_decode(t[i:])
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass
    # Salvage: pull the slug/path pairs out of the (model-written) text.
    pairs = re.findall(r'"slug"\s*:\s*"([A-Za-z0-9_.-]+)"(?:\s*,\s*"path"\s*:\s*(?:"([^"]*)"|null))?', t)
    if not pairs:
        return None if t else {}
    return {'skills': [{'slug': sl, 'path': pa or None} for sl, pa in pairs], 'why': '', '_salvaged': True}


def route(text, rl, timeout=25):
    """One small Haiku call. Returns (picks [(skill, path)], info dict). Any error -> no picks."""
    import urllib.request
    cat = [sk for sk in skills() if rl in sk['attach_roles'] and sk['when']]
    lines = []
    for sk in cat:
        ln = f"- {sk['slug']}: {sk['when'][:220]}"
        if sk['paths']:
            ln += f" [paths: {', '.join(sk['paths'])}]"
        lines.append(ln)
    task = task_text(text).strip()
    if len(task) > 6000:
        task = task[:4500] + '\n...\n' + task[-1500:]
    body = {'model': _profile_model(), 'max_tokens': 1000, 'system': ROUTER_SYSTEM,
            'messages': [{'role': 'user', 'content': 'Skill catalog:\n' + '\n'.join(lines) + '\n\nTask:\n' + task}]}
    key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
    info = {'model': body['model'], 'catalog': len(cat)}
    if not key:
        info['error'] = 'no ANTHROPIC_API_KEY in runner env'
        return [], info
    req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=json.dumps(body).encode(), method='POST',
                                 headers={'content-type': 'application/json', 'x-api-key': key,
                                          'anthropic-version': '2023-06-01'})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            res = json.loads(resp.read() or b'{}')
    except Exception as e:
        info['error'] = f'{type(e).__name__}: {str(e)[:200]}'
        return [], info
    u = res.get('usage') or {}
    i, o, cr, cw = HAIKU
    info['usage'] = {k: u.get(k) for k in ('input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens')}
    info['cost'] = round(((u.get('input_tokens') or 0) * i + (u.get('output_tokens') or 0) * o
                          + (u.get('cache_read_input_tokens') or 0) * cr + (u.get('cache_creation_input_tokens') or 0) * cw) / 1e6, 6)
    info['secs'] = round(time.time() - t0, 1)
    txt = ''.join(b.get('text', '') for b in res.get('content') or [] if b.get('type') == 'text')
    data = parse_router_reply(txt)
    if data is None:
        info['error'] = 'bad JSON: ' + txt[:200]
        return [], info
    if data.get('_salvaged'):
        info['note'] = 'router reply salvaged (invalid or truncated JSON)'
    info['why'] = str(data.get('why') or '')[:200]
    info['intent'] = str(data.get('intent') or '').strip()[:400]
    amb = data.get('ambiguous')
    if isinstance(amb, str):
        info['ambiguous'] = amb.strip().lower() in ('true', 'yes', '1')
    else:
        info['ambiguous'] = bool(amb)
    q = '' if data.get('clarify_question') is None else str(data.get('clarify_question')).strip()
    if q.lower() in ('null', 'none'):
        q = ''
    info['clarify_question'] = q[:300] if info['ambiguous'] else ''
    by = {sk['slug']: sk for sk in cat}
    picks = []
    for x in (data.get('skills') or [])[:3]:
        slug = x.get('slug') if isinstance(x, dict) else x
        path = x.get('path') if isinstance(x, dict) else None
        if slug in by:
            sk = by[slug]
            if sk['paths'] and path not in sk['paths']:
                path = sk['paths'][0]
            picks.append((sk, path))
    info['picks'] = [f"{sk['slug']}" + (f':{pa}' if pa else '') for sk, pa in picks]
    return picks, info


def _core(sk):
    body = sk['body'].strip()
    a = sk['meta'].get('attach', '')
    if a.startswith('until:'):
        stop = a[6:].strip()
        i = body.find('\n' + stop)
        if i > 0:
            return body[:i].strip(), True
    if a == 'full' or len(body) <= FULL_MAX:
        return body, False
    hs = [m.start() for m in re.finditer(r'^## ', body, re.M)]
    return (body[:hs[1]].strip(), True) if len(hs) > 1 else (body[:FULL_MAX], True)


def _files(sk):
    out = []
    for dp, dn, fn in os.walk(sk['dir']):
        dn[:] = [d for d in dn if not d.startswith('.') and d not in ('node_modules', '__pycache__')]
        for f in fn:
            if f.endswith('.md') and not (dp == sk['dir'] and f == 'SKILL.md'):
                out.append(os.path.relpath(os.path.join(dp, f), sk['dir']))
    out.sort(key=lambda x: (x.count('/'), x))
    return out


def _st_load():
    try:
        return json.load(open(STATE))
    except Exception:
        return {}


def _st_save(st):
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    tmp = STATE + '.tmp'
    json.dump(st, open(tmp, 'w'), indent=1)
    os.replace(tmp, STATE)


def _intent_prefix(info):
    """Per-task lines prepended to this run's user prompt (dynamic; after any cached system prefix)."""
    parts = []
    intent = (info.get('intent') or '').strip()
    if intent:
        parts.append('[Intent] ' + intent)
    q = (info.get('clarify_question') or '').strip()
    if info.get('ambiguous') and q:
        parts.append(
            '[Ask first] This request is ambiguous. Before you act, ask the user this one question '
            'in your normal reply (or `ask-user` if this is a background job) and wait for their answer: ' + q)
    return ('\n'.join(parts) + '\n\n') if parts else ''


def attach(r, prompt, log=None):
    """Return prompt with the router's picks injected; records what was attached (and the router's cost)."""
    rl = role(r)
    if not rl:
        return prompt
    picks, info = route(r['prompt'] or '', rl)
    if log:
        log.info('skill router %s role=%s picks=%s cost=$%s secs=%s%s', r['id'], rl, info.get('picks', []),
                 info.get('cost'), info.get('secs'), (' error=' + info['error']) if info.get('error') else '')
    st = _st_load()
    prefix = _intent_prefix(info)
    if not picks:
        st[r['id']] = {'role': rl, 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'skills': [], 'router': info,
                       'sent_back': False, 'chars': len(prefix)}
        _st_save(st)
        return prefix + prompt
    parts, rec = [], []
    host = str(r['working_dir'] or '').replace('/workspace/', '/opt/agent/workspace/', 1)
    done_hay = job_reads(host) if host else ''
    for sk, path in picks:
        full = must_for(sk, path) if rl in sk['must_roles'] else []
        # once per job: files already read anywhere in this job (earlier runs, crash resumes) are not required again
        already = [f for f in full if _key(f) in done_hay]
        must = [f for f in full if f not in already]
        core, partial = _core(sk)
        cdir = f"{CONTAINER_SKILLS}/{sk['slug']}"
        others = [f for f in _files(sk) if f not in must]
        block = (f"### Skill `{sk['slug']}`" + (f" (path: {path})" if path else '') + ' (attached by the runner)\n'
                 f"Folder: {cdir}/ (load more with `agent_skill_file`).\n")
        if must:
            block += ('**Required before you plan or build, and checked by the runner at delivery:** open each of these '
                      'in full with `agent_skill_file`, then apply them:\n' + ''.join(f'- `{f}`\n' for f in must))
        if already:
            block += ('Already read in this job (no need to re-read; open only the sections you need): '
                      + ', '.join(f'`{f}`' for f in already) + '\n')
        if sk['checklist'] and must:
            block += (f"**Checklist:** before you deliver, go through `{sk['checklist']}` item by item and say in your "
                      'final message which items pass.\n')
        dc = sk['deliver_check'] if ((full or sk['deliver_check']) and rl in sk['must_roles']) else ''  # stage-split: a plan check needs no required reads
        if dc and ' | ' in dc:
            block += f"**Delivery check:** {dc.rpartition(' | ')[2].strip()}\n"
        block += ('\n' + core + '\n' + (f'\n(Core section only; the full SKILL.md is at {cdir}/SKILL.md.)\n' if partial else ''))
        if others:
            block += 'Other files in this skill: ' + ', '.join(f'`{f}`' for f in others[:40]) + \
                     (f' (+{len(others) - 40} more)' if len(others) > 40 else '') + '\n'
            big = []
            for f in others:
                try:
                    n = os.path.getsize(os.path.join(sk['dir'], f))
                except OSError:
                    continue
                if n > 12000:
                    big.append(f'`{f}` ({n // 1000}K)')
            if big:
                block += ('Big files (look up, do not load whole): ' + ', '.join(big[:20]) + '. Search first: `read_section --find "words"`; '
                          'then `read_section FILE --list` or `read_section FILE "heading words"` returns one section.\n')
        parts.append(block)
        rec.append({'slug': sk['slug'], 'path': path, 'must': must, 'already_read': already,
                    'attached': 'core' if partial else 'full', 'deliver_check': dc})
    text = ('\n\n## Skills attached for this task (by the runner)\n'
            'These skills fit your task. Follow them; files marked required are checked before your result is accepted.\n\n'
            + '\n---\n'.join(parts))
    req = [(x['slug'], f) for x in rec for f in x['must']]
    head = ''
    if req:
        head = ('[Required first, checked by the runner] Before you plan, research or build anything, open each of these '
                'skill files in full with `agent_skill_file` and apply them; your result is not accepted until they are '
                'read:\n' + ''.join(f'- `{a}` → `{b}`\n' for a, b in req) + '\n')
    for x in rec:
        if x.get('deliver_check'):
            dc = x['deliver_check']
            if ' | ' in dc:
                head += f"[Delivery check, `{x['slug']}`] {dc.rpartition(' | ')[2].strip()}\n"
    if head:
        head += '\n'
    st[r['id']] = {'role': rl, 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'skills': rec, 'router': info,
                   'sent_back': False, 'chars': len(text)}
    _st_save(st)
    return prefix + head + prompt + text


def _key(f):
    parts = f.lower().split('/')
    return '/'.join(parts[-2:]) if parts[-1] in GENERIC and len(parts) > 1 else parts[-1]


def reads(api, cid, host_dir):
    """Lowercased haystack of every file the conversation touched (actions) + read-manifest entries."""
    hay = []
    page = None
    for _ in range(60):
        q = f'/api/conversations/{cid}/events/search?kind=ActionEvent&limit=100' + (f'&page_id={page}' if page else '')
        d = api('GET', q, timeout=30)
        for e in d.get('items') or []:
            hay.append(json.dumps(e.get('action') or {}, ensure_ascii=False).lower())
        page = d.get('next_page_id')
        if not page:
            break
    hay.append(job_reads(host_dir))
    return '\n'.join(hay)


def job_root(host_dir):
    """/opt/agent/workspace/jobs/<uuid> for any folder inside a job tree (structured path, not user text)."""
    parts = os.path.normpath(host_dir or '').split(os.sep)
    if 'jobs' in parts:
        i = parts.index('jobs')
        if len(parts) > i + 1:
            return os.sep.join(parts[:i + 2])
    return host_dir


def job_reads(host_dir):
    """Every skill file read logged anywhere in this job's tree (all runs, resumes and helpers): read once per job."""
    hay = []
    import glob
    root = job_root(host_dir)
    for mf in glob.glob(os.path.join(root, 'log', 'read-manifest.jsonl')) + \
            glob.glob(os.path.join(root, '**', 'log', 'read-manifest.jsonl'), recursive=True):
        try:
            lines = open(mf, errors='replace').read().splitlines()
        except OSError:
            continue
        for line in lines:
            try:
                x = json.loads(line)
            except Exception:
                continue
            if x.get('kind') in ('file', 'skill'):
                hay.append(f"{x.get('skill', '')}/{x.get('file', '')} {x.get('path', '')}".lower())
    return '\n'.join(sorted(set(hay)))


def _deliver_check(spec, host_dir):
    files, _, rest = spec.partition('=>')
    pat, _, msg = rest.rpartition(' | ') if ' | ' in rest else (rest, '', '')
    for f in _list(files):
        p = os.path.join(host_dir, f)
        if os.path.isfile(p):
            txt = open(p, errors='replace').read()
            try:
                ok = re.search(pat.strip(), txt, re.I | re.M) is not None
            except re.error:
                ok = True
            return ok, f, msg.strip()
    return False, None, msg.strip()


def gate_rows(spec, host_dir):
    """gate_rows: "out/*.csv >= 1" -> the newest matching CSV/TSV/JSON-list file has at least N data rows."""
    import glob, csv as _csv
    pat, _, n = spec.partition('>=')
    try:
        need = int(n.strip())
    except ValueError:
        return True, ''  # malformed gate: do not block
    files = sorted(glob.glob(os.path.join(host_dir, pat.strip())), key=os.path.getmtime, reverse=True)
    if not files:
        return False, f'gate_rows: no file matches {pat.strip()}'
    f = files[0]
    try:
        if f.endswith('.json'):
            d = json.load(open(f))
            have = len(d) if isinstance(d, list) else 0
        else:
            with open(f, newline='', errors='replace') as fh:
                have = max(sum(1 for row in _csv.reader(fh, delimiter='\t' if f.endswith('.tsv') else ',')
                               if any(c.strip() for c in row)) - 1, 0)
    except Exception as e:
        return False, f'gate_rows: cannot read {os.path.basename(f)} ({type(e).__name__})'
    return (have >= need), f'gate_rows: {os.path.relpath(f, host_dir)} has {have} data rows, needs >= {need}'


def gate_cmd(cmd, api, working_dir):
    """gate_cmd: a shell command run in the job folder inside the container (sandboxed, clean env, 60 s) that must
    exit 0 (e.g. "pytest -q"). The output tail is fed back on failure."""
    import shlex
    full = (f'env -i PATH=/workspace/tools/bin:/opt/tools:/usr/local/bin:/usr/bin:/bin HOME=/tmp LANG=C.UTF-8 '
            f'/opt/tools/job-sandbox --root {shlex.quote(working_dir)} -- timeout 60 bash -c {shlex.quote(cmd)}')
    try:
        res = api('POST', '/api/bash/execute_bash_command', {'command': full, 'cwd': working_dir, 'timeout': 75}, timeout=90)
    except Exception as e:
        return True, f'gate_cmd could not run ({str(e)[:100]}); not blocking'
    rc = res.get('exit_code')
    tail = ((res.get('stdout') or '') + (res.get('stderr') or ''))[-1200:]
    return rc == 0, f'gate_cmd `{cmd}` exited {rc}:\n```\n{tail}\n```'


ENGINE_RE = re.compile(r'\b(cinematic[ -]skill|remotion|hyperframes|dolly|open[ -]3d|three\.?js|theatre\.?js|motion canvas|'
                       r'revideo|pixi(?:js)?|gsap|p5(?:\.js)?|d3|maplibre|deck\.gl|rive|lottie|canvaskit|skia|manim|'
                       r'moderngl|opencv|mediapipe|rembg|ffmpeg)\b', re.I)


def engines_in(host_dir):
    for f in ('plan.md', 'out/plan.md', 'log/plan.md'):
        p = os.path.join(host_dir, f)
        if os.path.isfile(p):
            return sorted({m.group(1).lower() for m in ENGINE_RE.finditer(open(p, errors='replace').read())})
    return []


def check(r, api, host_dir):
    """At delivery. Returns (verdict, message): 'pass' | 'send_back' | 'flag' (passed after the one send-back)."""
    import glob
    st = _st_load()
    rec = st.get(r['id'])
    rl = role(r)
    if not rec:
        if not rl:
            return 'pass', ''
        rec = {'role': rl, 'skills': [], 'sent_back': False, 'router': {'note': 'no attach record'}}
    # router-miss backstop: structured check on the files the run produced (paths only, never the user's text)
    have = {x['slug'] for x in rec['skills']}
    for sk in skills():
        if sk['slug'] in have or not sk['gate_if_outputs'] or rl not in sk['must_roles']:
            continue
        if any(glob.glob(os.path.join(host_dir, g)) for g in sk['gate_if_outputs']):
            rec['skills'].append({'slug': sk['slug'], 'path': None, 'must': must_for(sk, None), 'attached': 'backstop',
                                  'deliver_check': sk['deliver_check']})
    bymeta = {sk['slug']: sk for sk in skills()}
    for s in rec['skills']:  # deterministic quality gates declared by the skill (2026-11-25 Hermes borrow)
        sk = bymeta.get(s['slug']) or {}
        s['gate_rows'], s['gate_cmd'] = sk.get('gate_rows', ''), sk.get('gate_cmd', '')
    gated = [s for s in rec['skills'] if s['must'] or s.get('deliver_check') or s.get('gate_rows') or s.get('gate_cmd')]
    if not gated:
        rec['final'] = 'pass'
        st[r['id']] = rec
        _st_save(st)
        return 'pass', ''
    hay = reads(api, r['conversation_id'], host_dir)
    missing, failed = [], []
    readmap = {}
    for s in gated:
        for f in s['must']:
            ok = _key(f) in hay
            readmap[f'{s["slug"]}/{f}'] = ok
            if not ok:
                missing.append((s['slug'], f))
        if s.get('deliver_check'):
            ok, f, msg = _deliver_check(s['deliver_check'], host_dir)
            if not ok:
                failed.append((s['slug'], msg or s['deliver_check']))
        if s.get('gate_rows'):
            ok, msg = gate_rows(s['gate_rows'], host_dir)
            if not ok:
                failed.append((s['slug'], msg))
        if s.get('gate_cmd') and api is not None:
            ok, msg = gate_cmd(s['gate_cmd'], api, r['working_dir'])
            if not ok:
                failed.append((s['slug'], msg))
    rec.setdefault('checks', []).append({'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'read': readmap,
                                         'missing': [f'{a}/{b}' for a, b in missing],
                                         'deliver_failed': [f'{a}: {b}' for a, b in failed]})
    rec['engines'] = engines_in(host_dir)
    if not missing and not failed:
        verdict, msg = 'pass', ''
    elif not rec.get('sent_back'):
        rec['sent_back'] = True
        lines = ['[Skill gate] Your result is not accepted yet.']
        if missing:
            lines.append('These required skill files were never opened in this conversation. Open each in full now with '
                         '`agent_skill_file` (or read the whole file), apply what they say to your work, and fix anything '
                         'that breaks their rules:')
            lines += [f'- `{a}` → `{b}`' for a, b in missing]
        if failed:
            lines.append('Delivery checks that failed:')
            lines += [f'- `{a}`: {b}' for a, b in failed]
        lines.append('Then deliver again with your complete final reply (every file path and detail from your earlier '
                     f'reply, updated), not only a note about this fix. Evidence: {r["working_dir"]}/log/skill-gate.json')
        verdict, msg = 'send_back', '\n'.join(lines)
    else:
        verdict, msg = 'flag', 'still missing after send-back: ' + ', '.join(
            [f'{a}/{b}' for a, b in missing] + [f'{a}: deliver_check' for a, _ in failed])
    rec['final'] = verdict if verdict != 'send_back' else 'sent_back'
    st[r['id']] = rec
    _st_save(st)
    try:
        os.makedirs(os.path.join(host_dir, 'log'), exist_ok=True)
        json.dump(rec, open(os.path.join(host_dir, 'log', 'skill-gate.json'), 'w'), indent=1)
    except OSError:
        pass
    return verdict, msg
