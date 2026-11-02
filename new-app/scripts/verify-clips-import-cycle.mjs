#!/usr/bin/env node
/**
 * Fail fast when lib/clips or components/clips have circular imports (production TDZ risk).
 * Uses madge via npx — no repo install required.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targets = [
  path.join(root, 'lib/clips'),
  path.join(root, 'components/clips'),
]

const args = [
  '--yes',
  'madge@8.0.0',
  '--circular',
  '--extensions',
  'ts,tsx',
  '--ts-config',
  path.join(root, 'tsconfig.json'),
  ...targets,
]

console.log('[verify:clips-import-cycle]', args.slice(2).join(' '))
const r = spawnSync('npx', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
if (r.stdout) process.stdout.write(r.stdout)
if (r.stderr) process.stderr.write(r.stderr)

if (r.status !== 0) {
  console.error('[verify:clips-import-cycle] FAIL — madge exited', r.status)
  process.exit(r.status ?? 1)
}
const found = r.stdout?.match(/Found (\d+) circular dependencies/)
if (found && Number(found[1]) > 0) {
  console.error(`[verify:clips-import-cycle] FAIL — ${found[1]} circular dependencies (see above)`)
  process.exit(1)
}

console.log('[verify:clips-import-cycle] PASS — no cycles in lib/clips or components/clips')
