#!/usr/bin/env python3
"""Apply the 2026-11-25 isolation/history patches ON TOP of the live files (keeps anyone else's edits).
Each change is an exact anchored replacement; already-applied changes are skipped; a file whose anchor is
missing or ambiguous is left untouched and reported. Python files are compile-checked, restored on failure.
Live copies are saved to backups/2026-11-25-isolation-logs/pre-apply-<time>/ first."""
import json, os, py_compile, shutil, sys, time
B = '/opt/agent/backups/2026-11-25-isolation-logs'
P = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'patches.json')))
P['run.sh'] = [['docker run -d --name agent-lab --restart unless-stopped --network host \\\n',
                'docker run -d --name agent-lab --restart unless-stopped --network host \\\n  --log-opt max-size=20m --log-opt max-file=5 \\\n']]
snap = f"{B}/pre-apply-{time.strftime('%Y%m%d-%H%M%S')}"
rc = 0
for rel, pairs in P.items():
    path = '/opt/agent/' + rel
    s = open(path).read()
    orig = s
    status = []
    for old, new in pairs:
        if new in s and (old not in new or s.count(new) >= 1 and old not in s.replace(new, '')):
            status.append('already'); continue
        n = s.count(old)
        if n != 1:
            status.append(f'ANCHOR x{n}'); break
        s = s.replace(old, new); status.append('applied')
    if any(x.startswith('ANCHOR') for x in status):
        print(f'{rel}: NOT changed, anchor missing/ambiguous ({status}); merge by hand from staged new/{rel}'); rc = 1; continue
    if s == orig:
        print(f'{rel}: already up to date'); continue
    os.makedirs(os.path.dirname(f'{snap}/{rel}'), exist_ok=True)
    shutil.copy2(path, f'{snap}/{rel}')
    tmp = path + '.apply-tmp'
    open(tmp, 'w').write(s); shutil.copymode(path, tmp)
    st = os.stat(path); os.chown(tmp, st.st_uid, st.st_gid)
    if rel.endswith('.py'):
        try:
            py_compile.compile(tmp, doraise=True)
        except py_compile.PyCompileError as e:
            os.remove(tmp); print(f'{rel}: NOT changed, compile failed: {e}'); rc = 1; continue
    os.replace(tmp, path)
    print(f'{rel}: {status} (previous copy in {snap})')
sys.exit(rc)
