"""tslib: tree-sitter helpers shared by repomap (container) and the code chunker (seclib, host search service).
Free and local: py-tree-sitter + tree-sitter-language-pack, grammars bundled in pylib/ts/grammars (no downloads at run time).
Everything degrades to None when tree-sitter is unavailable, so callers keep their old behaviour."""
import os, re, sys

HERE = os.path.dirname(os.path.realpath(__file__))
TS_DIR = os.path.join(HERE, 'pylib', 'ts')
GRAMMARS = os.path.join(TS_DIR, 'grammars')

LANG_BY_EXT = {
    '.py': 'python', '.pyi': 'python', '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.jsx': 'javascript',
    '.ts': 'typescript', '.mts': 'typescript', '.cts': 'typescript', '.tsx': 'tsx', '.go': 'go', '.rs': 'rust', '.java': 'java',
    '.c': 'c', '.h': 'c', '.cc': 'cpp', '.cpp': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp', '.hh': 'cpp', '.rb': 'ruby', '.php': 'php',
    '.cs': 'csharp', '.kt': 'kotlin', '.kts': 'kotlin', '.swift': 'swift', '.scala': 'scala', '.sh': 'bash', '.bash': 'bash',
}

# Node types that define a named symbol, per family (union is fine: names don't collide across grammars in harmful ways).
DEF_TYPES = {
    'function_definition', 'class_definition', 'decorated_definition',                      # python (decorated unwrapped below)
    'function_declaration', 'generator_function_declaration', 'class_declaration', 'method_definition',
    'interface_declaration', 'type_alias_declaration', 'enum_declaration', 'abstract_class_declaration',
    'module', 'internal_module',                                                             # ts namespaces / ruby module
    'method_declaration', 'constructor_declaration', 'record_declaration', 'annotation_type_declaration',  # java / c#
    'type_declaration', 'type_spec',                                                         # go
    'function_item', 'struct_item', 'enum_item', 'trait_item', 'impl_item', 'mod_item', 'macro_definition', 'type_item',  # rust
    'struct_specifier', 'class_specifier', 'enum_specifier', 'namespace_definition',          # c / c++
    'method', 'singleton_method', 'class',                                                   # ruby
    'struct_declaration', 'protocol_declaration', 'object_declaration', 'object_definition', 'trait_definition',
    'function_signature', 'abstract_method_signature',
}
CONTAINER_TYPES = {'class_definition', 'class_declaration', 'abstract_class_declaration', 'interface_declaration', 'impl_item',
                   'trait_item', 'class_specifier', 'struct_specifier', 'class', 'module', 'internal_module', 'mod_item',
                   'namespace_definition', 'object_declaration', 'object_definition', 'trait_definition', 'protocol_declaration',
                   'struct_declaration', 'record_declaration', 'enum_declaration', 'enum_item'}
IDENT_TYPES = {'identifier', 'type_identifier', 'field_identifier', 'property_identifier', 'constant',
               'shorthand_property_identifier', 'simple_identifier', 'name'}

_pack = None
_parsers = {}


def pack():
    """The tree_sitter_language_pack module, configured to the bundled grammars, or None."""
    global _pack
    if _pack is not None:
        return _pack or None
    try:
        try:
            import tree_sitter_language_pack as p  # host venv has its own install
        except ImportError:
            if sys.version_info[:2] == (3, 13) and os.path.isdir(TS_DIR):   # container: bundled cp313 build
                sys.path.append(TS_DIR)
            import tree_sitter_language_pack as p
        if os.path.isdir(GRAMMARS):
            p.configure(p.PackConfig(cache_dir=GRAMMARS))
        _pack = p
    except Exception:
        _pack = False
    return _pack or None


def parser_for(path):
    lang = LANG_BY_EXT.get(os.path.splitext(path)[1].lower())
    if not lang:
        return None, None
    if lang in _parsers:
        return _parsers[lang], lang
    p = pack()
    ps = None
    if p:
        try:
            ps = p.get_parser(lang)
        except Exception:
            ps = None
    _parsers[lang] = ps
    return ps, lang


def _name(node, src):
    n = node.child_by_field_name('name')
    if n is None and node.type == 'type_declaration':        # go: type_declaration > type_spec > name
        for c in node.named_children:
            if c.type == 'type_spec':
                n = c.child_by_field_name('name'); break
    if n is None and node.type in ('function_definition', 'function_declaration', 'struct_specifier', 'class_specifier'):
        d = node.child_by_field_name('declarator')            # c/c++: function_definition > declarator > ... identifier
        while d is not None and d.type not in IDENT_TYPES and d.type not in ('qualified_identifier', 'destructor_name', 'operator_name'):
            d = d.child_by_field_name('declarator') or (d.named_children[0] if d.named_children else None)
        n = d
    if n is None:
        return None
    return src[n.start_byte:n.end_byte].decode('utf-8', 'replace').strip()[:80] or None


def _arrow_defs(node, src):
    """JS/TS: const foo = (..) => {..} / function(){..} at statement level count as definitions."""
    out = []
    par = node.parent
    if par is None or par.type not in ('program', 'export_statement', 'module', 'statement_block') or \
            (par.type == 'statement_block' and (par.parent is None or par.parent.type not in ('internal_module', 'module'))):
        return out   # only module-level `const f = () => ...`, not locals inside test callbacks
    if node.type in ('lexical_declaration', 'variable_declaration'):
        for d in node.named_children:
            if d.type == 'variable_declarator':
                v = d.child_by_field_name('value')
                if v is not None and v.type in ('arrow_function', 'function_expression', 'function', 'class'):
                    nm = d.child_by_field_name('name')
                    if nm is not None:
                        out.append(src[nm.start_byte:nm.end_byte].decode('utf-8', 'replace'))
    return out


def outline(path, data=None):
    """Definitions and identifier references of one file.
    Returns None if the language is unsupported, else {'defs': [(name, kind, line_a, line_b, sig, depth, parent)], 'refs': {name: n}}."""
    ps, lang = parser_for(path)
    if ps is None:
        return None
    if data is None:
        with open(path, 'rb') as f:
            data = f.read()
    try:
        tree = ps.parse(data)
    except Exception:
        return None
    lines = data.split(b'\n')
    defs, refs = [], {}

    def sig(node):
        a = node.start_point[0]
        s = lines[a].decode('utf-8', 'replace').rstrip() if a < len(lines) else ''
        # include continuation lines of a multi-line signature, up to the body opener
        k = a
        while k + 1 < len(lines) and k - a < 4 and not s.rstrip().endswith((':', '{', ';', ')', '=>')) and k + 1 <= node.end_point[0]:
            k += 1
            s += ' ' + lines[k].decode('utf-8', 'replace').strip()
        s = re.sub(r'\s(//|#)\s.*$', '', s) if lang not in ('python', 'ruby', 'bash') else s
        return ' '.join(s.split())[:160]

    seen_targets = set()
    stack = [(tree.root_node, 0, '')]
    while stack:
        node, depth, parent = stack.pop()
        t = node.type
        kids_parent, kids_depth = parent, depth
        if t in IDENT_TYPES:
            nm = data[node.start_byte:node.end_byte].decode('utf-8', 'replace')
            if 1 < len(nm) < 80:
                refs[nm] = refs.get(nm, 0) + 1
        target = node
        if t == 'decorated_definition':
            target = node.child_by_field_name('definition') or node
            seen_targets.add((target.start_byte, target.end_byte))
        elif (node.start_byte, node.end_byte) in seen_targets:
            target = None   # already recorded through its decorator
        if target is not None and target.type == 'method_definition' and (not parent or parent.endswith('()')):
            target = None   # object-literal methods/getters are not API definitions
        if target is not None and target.type in DEF_TYPES and target.type != 'decorated_definition':
            nm = _name(target, data)
            if nm:
                defs.append((nm, target.type, node.start_point[0] + 1, node.end_point[0] + 1, sig(target), depth,
                             parent))
                if target.type in CONTAINER_TYPES:
                    kids_parent, kids_depth = (parent + '.' if parent else '') + nm, depth + 1
                else:   # definitions inside a function are local helpers: marked with '()' in their parent
                    kids_parent, kids_depth = (parent + '.' if parent else '') + nm + '()', depth + 1
        for nm in _arrow_defs(node, data):
            defs.append((nm, 'function', node.start_point[0] + 1, node.end_point[0] + 1, sig(node), depth, parent))
        for c in reversed(node.children):
            stack.append((c, kids_depth, kids_parent))
    # a definition's own name is not a reference to it
    for d in defs:
        if refs.get(d[0]):
            refs[d[0]] -= 1
            if not refs[d[0]]:
                del refs[d[0]]
    defs.sort(key=lambda d: (d[2], -d[3]))
    return {'lang': lang, 'defs': defs, 'refs': refs, 'nlines': len(lines)}


def spans(path, data=None):
    """Chunk spans for the search index: [(line_a, line_b, label)] by function/class (class header separate from methods),
    plus the file header before the first definition. None if unsupported."""
    o = outline(path, data)
    if o is None or not o['defs']:
        return None
    defs = o['defs']
    out = []
    top = [d for d in defs if d[5] == 0]
    first = min((d[2] for d in top), default=o['nlines'] + 1)
    if first > 1:
        out.append((1, first - 1, '(file header)'))
    whole = []   # function-like spans already emitted (local functions inside them are not split out)
    for nm, kind, a, b, s, depth, parent in defs:
        label = (parent + '.' if parent else '') + nm
        inner = [d for d in defs if d[2] > a and d[3] <= b and d[5] == depth + 1]
        if kind in CONTAINER_TYPES and inner:
            out.append((a, max(a, inner[0][2] - 1), label + ' (header)'))
        elif depth <= 2 and not any(x <= a and b <= y for x, y in whole):
            out.append((a, b, label)); whole.append((a, b))
    out.sort()
    return out
