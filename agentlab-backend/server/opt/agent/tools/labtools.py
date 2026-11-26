"""labtools: Agent Lab tools callable from ONE Python script (run it with `run-script`), so a bulk job (20 searches,
50 page reads, a CSV of lookups) costs one agent step and only what you print() comes back. Borrowed idea: Hermes
execute_code (MIT). Every helper shells out to the same CLI the agent already uses (same egress, same limits).

    from labtools import search, read_page, fetch, read_file, write_file, sh
    hits = search("best pizza Lisbon", n=5)          # list of {title, url, content}
    text = read_page(hits[0]["url"], max_chars=8000)  # clean page text ('' on failure)
    status, body = fetch("https://api.example.com/x") # raw fetch with direct -> residential fallback
Max 60 tool calls per script (LABTOOLS_MAX_CALLS); each call has its own timeout."""
import json, os, subprocess

_MAX = int(os.environ.get('LABTOOLS_MAX_CALLS', '60'))
_n = 0


class ToolLimit(RuntimeError):
    pass


def _run(args, timeout, stdin=None):
    global _n
    _n += 1
    if _n > _MAX:
        raise ToolLimit(f'labtools: more than {_MAX} tool calls in one script; split the work or print what you have')
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, input=stdin)
    return p.returncode, p.stdout, p.stderr


def search(query, n=8, time_range=None):
    args = ['/opt/tools/search', str(query), '-n', str(int(n)), '--json'] + (['--time', time_range] if time_range else [])
    try:
        rc, out, err = _run(args, 60)
    except subprocess.TimeoutExpired:
        return []
    try:
        d = json.loads(out)
    except Exception:
        return []
    items = d.get('results', d) if isinstance(d, dict) else d
    return [{'title': x.get('title', ''), 'url': x.get('url', ''), 'content': x.get('content', '')}
            for x in (items or []) if isinstance(x, dict)][:int(n)]


def read_page(url, max_chars=12000, js=False):
    args = ['/opt/tools/readpage', str(url), '--max', str(int(max_chars))] + (['--js'] if js else [])
    try:
        rc, out, err = _run(args, 120)
    except subprocess.TimeoutExpired:
        return ''
    return out if rc == 0 else ''


def fetch(url, max_bytes=65536):
    try:
        rc, out, err = _run(['/opt/tools/egress-fetch', str(url)], 90)
    except subprocess.TimeoutExpired:
        return 0, ''
    status = 0
    for line in err.splitlines():
        if line.startswith('status:'):
            try:
                status = int(line.split()[1])
            except Exception:
                pass
    return status, out[:max_bytes]


def read_file(path, max_chars=200000):
    with open(path, errors='replace') as f:
        return f.read(max_chars)


def write_file(path, text):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        f.write(text)
    os.replace(tmp, path)
    return path


def sh(cmd, timeout=120):
    """Run a shell command (same sandbox as the script). Returns (exit_code, output)."""
    rc, out, err = _run(['bash', '-c', cmd], timeout)
    return rc, out + err


def calls_used():
    return _n
