"""seclib: shared loader/chunker for read_section (container) and the search service (host). Stdlib only."""
import ast, hashlib, html.parser, os, re, subprocess, zipfile
import xml.etree.ElementTree as ET

CACHE = os.environ.get('SECLIB_CACHE') or next((d for d in ('/workspace/tools/section-index', '/tmp/section-index') if os.access(os.path.dirname(d), os.W_OK)), '/tmp/section-index')
DOC_EXTS = ('.md', '.markdown', '.txt', '.rst', '.html', '.htm', '.pdf', '.docx')
CODE_EXTS = ('.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.sh',
             '.go', '.rs', '.java', '.c', '.h', '.cc', '.cpp', '.hpp', '.rb', '.php', '.cs', '.kt', '.swift', '.scala',
             '.css', '.scss', '.vue', '.svelte', '.sql', '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg')


# ---------- loading any supported document into lines (+ pseudo markdown headings) ----------
class _H(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(); self.out = []; self.cur = []; self.lv = 0; self.skip = 0
    def handle_starttag(self, t, a):
        if t in ('script', 'style'): self.skip += 1
        if re.fullmatch(r'h[1-6]', t): self.flush(); self.lv = int(t[1])
        elif t in ('p', 'div', 'li', 'br', 'tr', 'section'): self.flush()
    def handle_endtag(self, t):
        if t in ('script', 'style'): self.skip = max(0, self.skip - 1)
        if re.fullmatch(r'h[1-6]', t): self.flush()
    def handle_data(self, d):
        if not self.skip: self.cur.append(d)
    def flush(self):
        s = re.sub(r'\s+', ' ', ''.join(self.cur)).strip()
        if s: self.out.append(('#' * self.lv + ' ' if self.lv else '') + s)
        self.cur = []; self.lv = 0


def _cached(path, ext, make):
    os.makedirs(CACHE, exist_ok=True)
    st = os.stat(path)
    key = hashlib.md5(f'{os.path.abspath(path)}|{st.st_mtime_ns}|{st.st_size}'.encode()).hexdigest()
    cp = os.path.join(CACHE, key + ext)
    if not os.path.exists(cp):
        txt = make()
        open(cp + '.tmp', 'w').write(txt); os.replace(cp + '.tmp', cp)
    return open(cp, errors='replace').read()


def plain_headings(lines):
    """Fallback for text with no markdown headings: Chapter/Part lines, numbered titles, ALL-CAPS lines, underlined titles."""
    out = []
    for i, l in enumerate(lines):
        s = l.strip()
        if not s or len(s) > 90:
            continue
        nxt = lines[i + 1].strip() if i + 1 < len(lines) else ''
        if re.match(r'^(chapter|part|section|appendix|article)\b', s, re.I) or \
           re.match(r'^\d+(\.\d+){0,3}[.)]?\s+[A-Z][^.!?]{2,80}$', s) or \
           (s.isupper() and 3 <= len(s) <= 70 and re.search(r'[A-Z]{3}', s)) or \
           (nxt and re.fullmatch(r'[=\-~]{3,}', nxt) and not re.fullmatch(r'[=\-~]{3,}', s)):
            lv = 1 + (s.count('.') if re.match(r'^\d', s) else 0)
            out.append((i, min(lv, 4), s))
    return out


def load(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.pdf':
        txt = _cached(path, '.txt', lambda: subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True, timeout=120).stdout)
        pages = txt.split('\f')
        lines = []
        for n, p in enumerate(pages, 1):
            if p.strip():
                lines.append(f'## Page {n}')
            lines += p.split('\n')
    elif ext == '.docx':
        def mk():
            z = zipfile.ZipFile(path); root = ET.fromstring(z.read('word/document.xml')); ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            out = []
            for p in root.iter(ns + 'p'):
                st = p.find(f'{ns}pPr/{ns}pStyle'); name = (st.get(ns + 'val') if st is not None else '') or ''
                t = ''.join(x.text or '' for x in p.iter(ns + 't')).strip()
                if not t: continue
                m = re.match(r'(?i)heading\s*(\d)', name)
                out.append(('#' * int(m.group(1)) + ' ' if m else '') + t if m else t)
            return '\n'.join(out)
        lines = _cached(path, '.txt', mk).split('\n')
    elif ext in ('.html', '.htm'):
        def mk():
            h = _H(); h.feed(open(path, errors='replace').read()); h.flush(); return '\n'.join(h.out)
        lines = _cached(path, '.txt', mk).split('\n')
    else:
        lines = open(path, errors='replace').read().split('\n')
    hs, fence = [], False
    for i, l in enumerate(lines):
        if l.startswith('```'): fence = not fence
        m = None if fence else re.match(r'^(#{1,6}) +(.*\S)\s*$', l)
        if m: hs.append((i, len(m.group(1)), m.group(2).strip()))
    if len([h for h in hs if not h[2].startswith('Page ')]) < 2 and ext in ('.txt', '.rst', '.pdf', '.md', '.markdown', '.docx'):
        extra = plain_headings(lines)
        hs = sorted(hs + extra, key=lambda x: x[0])
    return lines, hs


def span(lines, hs, k):
    i, lv, _ = hs[k]; j = len(lines)
    for i2, lv2, _ in hs[k + 1:]:
        if lv2 <= lv: j = i2; break
    return i, j




def heading_paths(lines, hs):
    """For each heading index: 'A > B > C' path."""
    st, out = [], []
    for i, lv, t in hs:
        while st and st[-1][0] >= lv:
            st.pop()
        st.append((lv, t))
        out.append(' > '.join(x[1][:60] for x in st))
    return out


def chunk_doc(path, maxc=1400):
    """Chunks of a document: (line_a, line_b, heading_path, text). Paragraph-aligned pieces within each heading."""
    lines, hs = load(path)
    hp = heading_paths(lines, hs)
    bounds = [(0, 'top')] + [(h[0], hp[k]) for k, h in enumerate(hs)]
    if hs and hs[0][0] == 0:
        bounds = [(h[0], hp[k]) for k, h in enumerate(hs)]
    out = []
    for n, (start, hpath) in enumerate(bounds):
        end = bounds[n + 1][0] if n + 1 < len(bounds) else len(lines)
        buf, a = [], start
        for i in range(start, end):
            l = lines[i]
            buf.append(l)
            if sum(len(x) + 1 for x in buf) >= maxc and (not l.strip() or sum(len(x) + 1 for x in buf) > maxc * 1.5):
                t = '\n'.join(buf).strip()
                if t: out.append((a + 1, i + 1, hpath, t))
                buf, a = [], i + 1
        t = '\n'.join(buf).strip()
        if t and len(t) > 20: out.append((a + 1, end, hpath, t))
    return out


def chunk_code(path, maxc=1800):
    """Code by function/class (python via ast; js/ts/sh by top-level declarations); others in line windows."""
    txt = open(path, errors='replace').read(); lines = txt.split('\n'); ext = os.path.splitext(path)[1].lower()
    spans = []
    try:   # tree-sitter spans (many languages) when available; the old AST/regex path below is the fallback
        import tslib
        spans = tslib.spans(path) or []
    except Exception:
        spans = []
    if spans:
        pass
    elif ext == '.py':
        try:
            tree = ast.parse(txt)
            def walk(node, prefix=''):
                for ch in ast.iter_child_nodes(node):
                    if isinstance(ch, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                        name = prefix + ch.name
                        spans.append((ch.lineno, getattr(ch, 'end_lineno', ch.lineno), name))
                        if isinstance(ch, ast.ClassDef): walk(ch, name + '.')
            walk(tree)
            top = [s for s in spans if '.' not in s[2]]
            first = min([s[0] for s in top], default=len(lines) + 1)
            if first > 1: spans.insert(0, (1, first - 1, '(module header)'))
            # drop class spans that are huge when methods exist (keep header lines of the class only)
            fixed = []
            for a, b, nm in spans:
                if any(s[2].startswith(nm + '.') for s in spans):
                    nxt = min(s[0] for s in spans if s[2].startswith(nm + '.'))
                    fixed.append((a, max(a, nxt - 1), nm + ' (class header)'))
                else:
                    fixed.append((a, b, nm))
            spans = fixed
        except SyntaxError:
            spans = []
    elif ext in ('.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.sh'):
        pat = re.compile(r'^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s+([A-Za-z0-9_$]+)|class\s+([A-Za-z0-9_$]+)|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[A-Za-z0-9_$]+\s*=>))|^([A-Za-z0-9_]+)\(\)\s*\{')
        marks = []
        for i, l in enumerate(lines):
            m = pat.match(l)
            if m: marks.append((i + 1, next(g for g in m.groups() if g)))
        for k, (ln, nm) in enumerate(marks):
            spans.append((ln, (marks[k + 1][0] - 1) if k + 1 < len(marks) else len(lines), nm))
        if marks and marks[0][0] > 1: spans.insert(0, (1, marks[0][0] - 1, '(file header)'))
    if not spans:
        spans = [(i + 1, min(i + 60, len(lines)), f'lines {i + 1}') for i in range(0, len(lines), 60)]
    out = []
    for a, b, nm in spans:
        seg = lines[a - 1:b]
        while seg:   # split overlong symbols in windows
            t = '\n'.join(seg[:80]); take = 80
            if len(t) > maxc:
                take = max(10, int(len(seg[:80]) * maxc / len(t))); t = '\n'.join(seg[:take])
            if t.strip(): out.append((a, a + min(take, len(seg)) - 1, nm, t))
            seg = seg[take:]; a += take
    return out


def sha1(path):
    h = hashlib.sha1()
    with open(path, 'rb') as f:
        for blk in iter(lambda: f.read(1 << 20), b''):
            h.update(blk)
    return h.hexdigest()
