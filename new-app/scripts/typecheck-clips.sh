#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CLIPS_RE='^(components/clips|lib/clips|app/app/clips|app/api/clips|lib/server/clips)/'
OUT="$(mktemp)"
NODE_OPTIONS='--max-old-space-size=8192' npx tsc -p tsconfig.typecheck.json --noEmit --pretty false >"$OUT" 2>&1 || true

if rg -q "${CLIPS_RE}.* error TS(2304|2552):" "$OUT"; then
  rg "${CLIPS_RE}.* error TS(2304|2552):" "$OUT" || true
  rm -f "$OUT"
  echo "[typecheck:clips] FAILED — Cannot find name (TS2304/TS2552) under clips paths" >&2
  exit 1
fi

if rg -q "${CLIPS_RE}.* error TS(2300|2440):" "$OUT"; then
  rg "${CLIPS_RE}.* error TS(2300|2440):" "$OUT" || true
  rm -f "$OUT"
  echo "[typecheck:clips] FAILED — duplicate identifier (TS2300/TS2440) under clips paths" >&2
  exit 1
fi

SERVER_CLIPS_RE='^lib/server/clips/.* error TS(2353|2339):'
if rg -q "${SERVER_CLIPS_RE}" "$OUT"; then
  rg "${SERVER_CLIPS_RE}" "$OUT" || true
  rm -f "$OUT"
  echo "[typecheck:clips] FAILED — invalid Prisma select/property (TS2353/TS2339) under lib/server/clips" >&2
  exit 1
fi

# Turbopack: duplicate value imports of the same binding from one module.
node --input-type=module -e "
import fs from 'node:fs';
import path from 'node:path';
const roots = ['components/clips', 'lib/clips', 'app/api/clips', 'lib/server/clips'];
const files = [];
for (const r of roots) {
  const p = path.join(process.cwd(), r);
  if (!fs.existsSync(p)) continue;
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (/\\.(ts|tsx)$/.test(ent.name)) files.push(full);
    }
  };
  walk(p);
}
const importRe =
  /import\\s+(type\\s+)?(?:\\{([^}]+)\\}|([A-Za-z0-9_$]+))\\s+from\\s+['\"]([^'\"]+)['\"]/g;
let failed = false;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const byMod = new Map();
  let m;
  while ((m = importRe.exec(text)) !== null) {
    const isTypeOnly = Boolean(m[1]);
    const mod = m[4];
    const names = m[3]
      ? [m[3]]
      : m[2]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/^type\\s+/, '').split(/\\s+as\\s+/)[0].trim());
    if (!byMod.has(mod)) byMod.set(mod, new Set());
    const set = byMod.get(mod);
    for (const n of names) {
      if (set.has(n)) {
        console.error('[typecheck:clips] duplicate import', n, 'from', mod, 'in', file);
        failed = true;
      }
      if (!isTypeOnly) set.add(n);
    }
  }
}
process.exit(failed ? 1 : 0);
" || {
  rm -f "$OUT"
  exit 1
}

rm -f "$OUT"
echo "[typecheck:clips] ok"
