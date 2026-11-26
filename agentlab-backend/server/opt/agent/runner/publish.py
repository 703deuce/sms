"""Publish a finished helper's deliverables (helpers/<id>/out/**) into its parent job's out/.

Runs inside the runner (user agentlab, uid 10001, the same uid as the sandbox user), so it can write the parent's
out/ even though the helper's own sandbox cannot. Rules:
 - relative paths and filenames are preserved;
 - an existing parent file is never overwritten: identical content is skipped, different content gets the name
   `<stem>.helper-<shortid><ext>`; every collision is recorded;
 - the helper's originals stay where they are;
 - result.md (written by the runner), dot-files and a few scratch folders are not published;
 - a manifest `<helper>/out/.published.json` makes repeated calls idempotent.
Returns a short plain-text note for the parent agent (empty string when there is nothing to say).
"""
import hashlib, json, os, re, shutil, subprocess

HOST_WS = '/opt/agent/workspace'
SKIP_DIRS = {'node_modules', '.git', '__pycache__', '.browser', 'frames'}
SKIP_FILES = {'result.md'}          # the runner's own copy of the helper's report (top level of out/ only)
MAX_TOTAL = 800 * 1024 * 1024
MAX_LIST = 40
HELPER_RE = re.compile(r'^(?P<parent>.+)/helpers/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/?$')


def _host(p):
    return str(p or '').replace('/workspace/', HOST_WS + '/', 1)


def _cont(p):
    return str(p).replace(HOST_WS + '/', '/workspace/', 1)


def _sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def parent_dir(working_dir):
    m = HELPER_RE.match(str(working_dir or '').rstrip('/'))
    return m.group('parent') if m else None


def _mkdirs(path, root):
    """makedirs with sane modes under root."""
    os.makedirs(path, exist_ok=True)
    cur = path
    while cur.startswith(root) and cur != root:
        try:
            os.chmod(cur, 0o755)
        except OSError:
            pass
        cur = os.path.dirname(cur)


REPO_SKIP = SKIP_DIRS | {'out', '.venv', 'venv', 'env', 'helpers', 'log', 'site-packages', 'dist', 'build'}
MAX_REPO_FILES = 200
MAX_REPO_FILE = 5 * 1024 * 1024


def _git(repo, *args, ok=(0,)):
    p = subprocess.run(['git', '-c', 'safe.directory=*', '-C', repo, *args], capture_output=True, timeout=60)
    if p.returncode not in ok:
        raise RuntimeError((p.stderr or b'').decode('utf-8', 'replace')[:200])
    return p.stdout


def find_repos(hdir, max_depth=4):
    found = []
    for root, dirs, files in os.walk(hdir):
        depth = os.path.relpath(root, hdir).count(os.sep)
        if root != hdir and (os.path.isdir(os.path.join(root, '.git')) or os.path.isfile(os.path.join(root, '.git'))):
            found.append(root)
            dirs[:] = []
            continue
        dirs[:] = [] if depth >= max_depth else sorted(d for d in dirs if d not in REPO_SKIP and not d.startswith('.'))
    return found


def export_repos(hdir):
    """Code jobs (2026-11-25): a helper's fixed repo used to stay in the helper folder (K3 delivered no diff). For every
    git repo in the helper folder, write out/code/<repo>.patch (all changes against the upstream base: commits plus
    uncommitted plus new files) and copies of the changed files under out/code/<repo>/, so publish() delivers them."""
    notes = []
    for repo in find_repos(hdir):
        name = os.path.relpath(repo, hdir).replace(os.sep, '__')
        try:
            base = None
            for ref in ('@{upstream}', 'origin/HEAD', 'origin/main', 'origin/master'):
                try:
                    base = _git(repo, 'merge-base', 'HEAD', ref).decode().strip() or None
                except Exception:
                    base = None
                if base:
                    break
            base = base or 'HEAD'
            patch = _git(repo, 'diff', '--binary', base)
            changed = [x for x in _git(repo, 'diff', '--name-only', base).decode('utf-8', 'replace').splitlines() if x]
            untracked = [x for x in _git(repo, 'ls-files', '--others', '--exclude-standard').decode('utf-8', 'replace').splitlines()
                         if x and not any(part in REPO_SKIP or part.endswith('.egg-info') for part in x.split('/')[:-1])]
            for u in untracked[:MAX_REPO_FILES]:
                fp = os.path.join(repo, u)
                if os.path.isfile(fp) and os.path.getsize(fp) <= MAX_REPO_FILE:
                    patch += _git(repo, 'diff', '--no-index', '--binary', '/dev/null', u, ok=(0, 1))
            files = (changed + untracked)[:MAX_REPO_FILES]
            if not patch.strip():
                continue
            out = os.path.join(hdir, 'out', 'code')
            os.makedirs(out, exist_ok=True)
            with open(os.path.join(out, name + '.patch'), 'wb') as fh:
                fh.write(patch)
            for f in files:
                src = os.path.join(repo, f)
                if os.path.isfile(src) and not os.path.islink(src) and os.path.getsize(src) <= MAX_REPO_FILE:
                    dst = os.path.join(out, name, f)
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    shutil.copyfile(src, dst)
            notes.append(f'{name}: {len(files)} changed file(s), patch against {base[:12]}')
        except Exception as e:
            notes.append(f'{name}: patch export failed ({str(e)[:120]})')
    return notes


def publish(working_dir, short_id):
    """working_dir: the helper's folder (container or host path). Returns note text."""
    pdir = parent_dir(working_dir)
    if not pdir:
        return ''
    hdir, pdir_h = _host(working_dir).rstrip('/'), _host(pdir).rstrip('/')
    src_root, dst_root = hdir + '/out', pdir_h + '/out'
    try:
        repo_notes = export_repos(hdir) if os.path.isdir(pdir_h) else []
    except Exception as e:
        repo_notes = [f'patch export failed ({str(e)[:120]})']
    if not os.path.isdir(src_root) or not os.path.isdir(pdir_h):
        return ''
    manifest_p = src_root + '/.published.json'
    try:
        manifest = json.load(open(manifest_p))
    except Exception:
        manifest = {}
    short = (short_id or os.path.basename(hdir))[:8]
    new, same, renamed, skipped = [], [], [], []
    total = 0
    for root, dirs, files in os.walk(src_root):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith('.'))
        for f in sorted(files):
            if f.startswith('.'):
                continue
            src = os.path.join(root, f)
            rel = os.path.relpath(src, src_root)
            if rel in SKIP_FILES:
                continue
            if os.path.islink(src) or not os.path.isfile(src):
                continue
            size = os.path.getsize(src)
            if total + size > MAX_TOTAL:
                skipped.append(f'{rel} (too large: {size:,} bytes, over the {MAX_TOTAL // (1 << 20)} MB publish cap)')
                continue
            if rel in manifest and os.path.isfile(_host(manifest[rel])) and _sha(_host(manifest[rel])) == _sha(src):
                same.append(rel)
                continue
            dst = os.path.join(dst_root, rel)
            try:
                if os.path.exists(dst):
                    if _sha(dst) == _sha(src):
                        manifest[rel] = _cont(dst)
                        same.append(rel)
                        continue
                    stem, ext = os.path.splitext(rel)
                    dst = os.path.join(dst_root, f'{stem}.helper-{short}{ext}')
                    n = 2
                    while os.path.exists(dst):
                        if _sha(dst) == _sha(src):
                            break
                        dst = os.path.join(dst_root, f'{stem}.helper-{short}-{n}{ext}')
                        n += 1
                    if os.path.exists(dst):  # identical copy from an earlier publish
                        manifest[rel] = _cont(dst)
                        same.append(rel)
                        continue
                    renamed.append((rel, os.path.relpath(dst, dst_root)))
                else:
                    new.append(rel)
                _mkdirs(os.path.dirname(dst), pdir_h)
                shutil.copyfile(src, dst)
                try:
                    os.chmod(dst, 0o644)
                except OSError:
                    pass
                manifest[rel] = _cont(dst)
                total += size
            except OSError as e:
                skipped.append(f'{rel} ({type(e).__name__})')
    try:
        with open(manifest_p, 'w') as fh:
            json.dump(manifest, fh, indent=1)
    except OSError:
        pass
    if not (new or renamed or skipped or same):
        return ''
    pout = _cont(dst_root)
    lines = []
    if repo_notes:
        lines.append('Code changes exported from the helper\'s repo(s) into out/code/ (a .patch per repo plus the changed '
                     'files): ' + '; '.join(repo_notes) + '. Give the customer the patch path.')
    got = len(new) + len(renamed)
    if got:
        lines.append(f'Published {got} file(s) from the helper into your out/ folder ({pout}); deliver them from there, do not search the helper folder. '
                     'The helper\'s originals were left in place.')
    elif same:
        lines.append(f'The helper\'s {len(same)} output file(s) are already in your out/ folder ({pout}).')
    for rel in new[:MAX_LIST]:
        lines.append(f'  + out/{rel}')
    if len(new) > MAX_LIST:
        lines.append(f'  ... and {len(new) - MAX_LIST} more new files')
    for rel, dst in renamed[:MAX_LIST]:
        lines.append(f'  ~ out/{rel} already existed with different content, so the helper\'s version was saved as out/{dst}')
    for s in skipped[:MAX_LIST]:
        lines.append(f'  ! not published: {s}')
    return '\n'.join(lines)
