#!/usr/bin/env python3
"""Container-side smoke tests (run as the agent user). Prints RESULT|name|PASS/FAIL|detail lines."""
import os, subprocess, json, sys, shutil, zipfile, time, re
JOB = '/workspace/jobs/00000000-0000-0000-0000-0000000a5e01'
R = []
def res(n, ok, d=''): R.append((n, ok, d)); print(f'RESULT|{n}|{"PASS" if ok else "FAIL"}|{d}', flush=True)
def sh(cmd, cwd=JOB, inp=None, timeout=120):
    p = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=timeout, input=inp)
    return p.returncode, (p.stdout + p.stderr)

shutil.rmtree(JOB, ignore_errors=True)
os.makedirs(JOB + '/log'); os.makedirs(JOB + '/docs')
D = JOB + '/docs'
# ---- fixtures
open(D + '/guide.md', 'w').write('# Gardening Guide\n\nIntro text.\n\n## Soil\n\nUse compost and loam. ' + 'Soil needs drainage. ' * 30 + '\n\n## Watering\n\nWater tomatoes early in the morning, never at night.\n\n### Drip lines\n\nDrip irrigation saves water.\n\n## Pests\n\nAphids are controlled with ladybugs.\n')
open(D + '/book.txt', 'w').write('CHAPTER 1\n\n' + 'The whale was seen at dawn. ' * 10 + '\n\nCHAPTER 2\n\n' + 'The harbor was empty and quiet. ' * 10 + '\n\nCHAPTER 3\n\n' + 'A storm arrived from the north. ' * 10 + '\n')
open(D + '/page.html', 'w').write('<html><body><h1>Manual</h1><p>intro</p><h2>Install</h2><p>Run the installer twice.</p><h2>Uninstall</h2><p>Delete the folder.</p></body></html>')
def mkdocx(p):
    body = ''.join(f'<w:p><w:pPr><w:pStyle w:val="{s}"/></w:pPr><w:r><w:t>{t}</w:t></w:r></w:p>' for s, t in
                   [('Heading1', 'Contract Terms'), ('Normal', 'General words here.'), ('Heading2', 'Termination Clause'), ('Normal', 'Either party may terminate with thirty days notice.'), ('Heading2', 'Payment Schedule'), ('Normal', 'Invoices are due net 45.')])
    z = zipfile.ZipFile(p, 'w')
    z.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    z.writestr('word/document.xml', f'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{body}</w:body></w:document>')
    z.close()
mkdocx(D + '/contract.docx')
def mkpdf(p):
    lines = ['REPORT TITLE', '', 'Chapter 1 Overview', 'The overview covers budgets.', '', 'Chapter 2 Findings', 'Findings show rising costs.']
    st = 'BT /F1 12 Tf 50 750 Td 16 TL ' + ' '.join(f'({l}) Tj T*' for l in lines) + ' ET'
    objs = ['<</Type/Catalog/Pages 2 0 R>>', '<</Type/Pages/Kids[3 0 R]/Count 1>>', '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
            f'<</Length {len(st)}>>\nstream\n{st}\nendstream', '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>']
    out = b'%PDF-1.4\n'; offs = []
    for i, o in enumerate(objs, 1): offs.append(len(out)); out += f'{i} 0 obj\n{o}\nendobj\n'.encode()
    x = len(out); out += f'xref\n0 {len(objs)+1}\n0000000000 65535 f \n'.encode() + ''.join(f'{o:010d} 00000 n \n' for o in offs).encode()
    out += f'trailer\n<</Size {len(objs)+1}/Root 1 0 R>>\nstartxref\n{x}\n%%EOF'.encode(); open(p, 'wb').write(out)
mkpdf(D + '/report.pdf')
open(D + '/big.txt', 'w').write('\n'.join(f'line {i} filler text' for i in range(1, 601)))
open(D + '/calc.py', 'w').write('''import math\n\ndef compute_orbital_period(radius_m, mass_kg):\n    """Kepler third law: period of a circular orbit around a body."""\n    G = 6.674e-11\n    return 2 * math.pi * math.sqrt(radius_m ** 3 / (G * mass_kg))\n\n\nclass InvoiceTotaler:\n    """Adds line items, applies sales tax, rounds to cents."""\n    def add(self, price, qty):\n        return price * qty\n\n    def with_tax(self, amount, rate):\n        return round(amount * (1 + rate), 2)\n''')

# ---- 1 heading index + read_section across formats
rc, o = sh('read_section docs/guide.md --list'); res('index: md headings list', rc == 0 and 'Watering' in o and 'Drip lines' in o and 'Pests' in o, o.strip().splitlines()[1][:60] if o.strip() else o[:80])
rc, o = sh('read_section docs/guide.md "Watering"'); res('read_section: one md section', 'early in the morning' in o and 'Aphids' not in o and 'Drip irrigation' in o, f'{len(o)} chars (includes subsection, excludes Pests)')
rc, o = sh('read_section docs/book.txt --list'); res('index: plain-text chapters', o.count('CHAPTER') >= 3, f'{o.count("CHAPTER")} chapters found')
rc, o = sh('read_section docs/book.txt "CHAPTER 2"'); res('read_section: txt chapter', 'harbor' in o and 'whale' not in o and 'storm' not in o, '')
rc, o = sh('read_section docs/page.html "Install"'); res('read_section: html', 'installer twice' in o and 'Delete the folder' not in o, '')
rc, o = sh('read_section docs/contract.docx "Termination"'); res('read_section: docx', 'thirty days' in o and 'net 45' not in o, o.strip()[:60].replace('\n', ' '))
rc, o = sh('read_section docs/report.pdf --list'); r2, o2 = sh('read_section docs/report.pdf "Findings"'); res('read_section: pdf', 'Findings' in o and 'rising costs' in o2 and 'budgets' not in o2, o.strip().splitlines()[-1][:60] if o.strip() else '')
# ---- 7 200-line cap
rc, o = sh('read_section docs/big.txt --lines 1:500'); n = sum(1 for l in o.splitlines() if l.startswith('line ')); res('200-line read cap', 0 < n <= 200 and 'line 201 ' not in o, f'{n} lines returned for a 500-line request; ' + (o.strip().splitlines()[-1][:70] if o.strip() else ''))
rc, o = sh('read_section docs/big.txt --lines 300:310'); res('line-range slice', 'line 300 ' in o and 'line 310 ' in o and 'line 311 ' not in o, '')
# ---- 5 manifest
mf = open(JOB + '/log/read-manifest.jsonl').read() if os.path.exists(JOB + '/log/read-manifest.jsonl') else ''
res('read manifest logged', mf.count('"section"') >= 3, f'{mf.count(chr(10))} lines')

# ---- search over docs + code (job folder reindex)
subprocess.run(f'curl -s -m 600 -XPOST 127.0.0.1:6075/reindex -d \'{{"job":"{JOB}"}}\'', shell=True, capture_output=True)
rc, o = sh('read_section --find "when should tomatoes get watered" docs'); res('hybrid search: doc, keyword-ish', 'guide.md' in o.split('\n\n')[0] + o[:600] and 'Watering' in o[:600], o.strip().splitlines()[0][:100] if o.strip() else o[:100])
rc, o = sh('read_section --find "how do I get rid of bugs eating my plants" docs'); res('hybrid search: doc, semantic (no shared words)', 'Pests' in o[:700], o.strip().splitlines()[0][:100] if o.strip() else o[:100])
rc, o = sh('read_section --find "who can end the agreement and how much notice" docs'); res('hybrid search: docx semantic', 'contract.docx' in o[:500] and 'Termination' in o[:500], o.strip().splitlines()[0][:100] if o.strip() else o[:100])
rc, o = sh('read_section --find "how long does one orbit take around a planet" docs'); res('hybrid search: code by function (semantic)', 'compute_orbital_period' in o[:500], o.strip().splitlines()[0][:100] if o.strip() else o[:100])
rc, o = sh('read_section --find "add sales tax to a total" docs'); res('hybrid search: code by class method', 'with_tax' in o[:700] or 'InvoiceTotaler' in o[:700], o.strip().splitlines()[0][:100] if o.strip() else o[:100])
rc, o = sh('read_section --find "which engine for a camera flying through 3D" lab-video-producer'); res('hybrid search: real skill refs', 'lab-video-producer' in o[:600], o.strip().splitlines()[0][:100] if o.strip() else o[:100])

# ---- 6 qrun filter
rc, o = sh("qrun 'for i in $(seq 1 5000); do echo \"filler line $i\"; done; echo \"ERROR: disk exploded at step 77\"; for i in $(seq 1 60); do echo tail $i; done; exit 3'")
logm = re.search(r'full output: (\S+)', o)
res('qrun: exit code + tail + error + full-output file', 'exit=3' in o and 'ERROR: disk exploded' in o and 'tail 60' in o and len(o) < 4500 and logm and os.path.exists(logm.group(1)) and 'filler line 2500' not in o,
    f'{len(o)} chars shown of ~{5000*17} produced; log {logm.group(1) if logm else None}')
if logm:
    rc, g = sh(f'grep -c "filler line" {logm.group(1)}'); res('qrun: full log searchable', g.strip() == '5000', f'grep found {g.strip()} lines')
rc, o = sh('qrun "echo hi"'); res('qrun: short ok command stays short', 'exit=0' in o and 'hi' in o and len(o) < 300, o.strip()[:80].replace('\n', ' | '))
rc, o = sh("qrun --digest 'for i in $(seq 1 400); do echo \"processing frame $i ok\"; done; echo \"WARNING: audio clipped at frame 391\"; echo done'", timeout=90)
res('qrun --digest (Haiku compresses long output)', rc == 0 and ('digest' in o.lower() or 'clipped' in o.lower()) and len(o) < 3500, f'{len(o)} chars; ' + o.strip().replace('\n', ' | ')[:160])

# ---- 12 git checkpoints
open(JOB + '/log/notes.md', 'w').write('v1'); open(JOB + '/x.mp4', 'wb').write(os.urandom(2000000)); open(JOB + '/work.py', 'w').write('print(1)\n')
rc, o = sh('gitckpt "first checkpoint"'); rc2, lg = sh('git log --oneline | head -3'); rc3, fl = sh('git ls-files')
res('gitckpt: commit small files, ignore media', rc == 0 and 'first checkpoint' in lg and 'work.py' in fl and 'x.mp4' not in fl, f'log: {lg.strip()[:60]}; tracked {len(fl.split())} files')
open(JOB + '/work.py', 'w').write('print("broken")\n'); sh('gitckpt "second"')
rc, o = sh('gitckpt --log'); res('gitckpt --log lists checkpoints', 'second' in o and 'first checkpoint' in o, o.strip().splitlines()[0][:60] if o.strip() else '')
first = re.search(r'([0-9a-f]{7,})\s+first checkpoint', o)
if first:
    rc, o = sh(f'gitckpt --restore work.py {first.group(1)}'); res('gitckpt --restore recovers earlier state', open(JOB + '/work.py').read() == 'print(1)\n', o.strip()[:80])
else: res('gitckpt --restore recovers earlier state', False, 'no first hash: ' + o[:80])

# ---- 13 plan-check
def pc(plan, state_reset=False):
    open(JOB + '/log/plan.md', 'w').write(plan)
    return sh('plan-check')
if os.path.exists(JOB + '/log/plan-check.json'): os.remove(JOB + '/log/plan-check.json')
good = '# Plan\n\n| Scene | Seconds | Engine | Why |\n|---|---|---|---|\n| 1 Hook | 0-5 | Remotion | text-heavy kinetic type with exact timing |\n| 2 Map | 5-15 | Blender | real 3D camera flythrough of terrain |\n'
rc, o = pc(good); res('plan-check: valid plan passes', rc == 0 and 'ok' in o.lower(), o.strip()[:90].replace('\n', ' '))
for f in ('log/plan-check.json',):
    if os.path.exists(JOB + '/' + f): os.remove(JOB + '/' + f)
for fn in os.listdir(JOB + '/log'):
    if fn.startswith('plan-check'): os.remove(JOB + '/log/' + fn)
bad = '# Plan\n\n| Scene | Seconds | Engine | Why |\n|---|---|---|---|\n| 1 Hook | 0-5 | Remotion | ok |\n| 2 Map | 5-15 | | 3D camera flythrough of terrain |\n'
rc, o = pc(bad); res('plan-check: missing engine/reason is sent back', rc != 0, o.strip()[:90].replace('\n', ' '))
rc, o = pc(bad); res('plan-check: second failure lets work continue (one send-back)', rc == 0 and ('flag' in o.lower() or 'proceed' in o.lower() or 'continue' in o.lower() or 'already' in o.lower()), 'rc=%s %s' % (rc, o.strip()[:90].replace('\n', ' ')))
for fn in os.listdir(JOB + '/log'):
    if fn.startswith('plan-check'): os.remove(JOB + '/log/' + fn)
rc, o = pc('# Plan\n\nJust vibes, make it good.\n'); res('plan-check: prose-only plan rejected', rc != 0, o.strip()[:90].replace('\n', ' '))

shutil.rmtree(JOB + '/x.mp4', ignore_errors=True)
print('SUMMARY', sum(1 for x in R if x[1]), '/', len(R))
