#!/usr/bin/env node
/** Runs TDZ hook-order guard + optional eslint no-use-before-define on editor-shell.tsx */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = join(here, '..')
const repoRoot = join(appRoot, '..')

const order = spawnSync(process.execPath, [join(here, 'verify-editor-shell-hook-order.mjs')], {
  cwd: appRoot,
  stdio: 'inherit',
})
if (order.status !== 0) process.exit(order.status ?? 1)

const eslintBin = join(repoRoot, 'node_modules', 'eslint', 'bin', 'eslint.js')
const config = join(repoRoot, 'eslint.clips-editor-tdz.mjs')
const target = join(appRoot, 'components', 'clips', 'editor', 'editor-shell.tsx')

const eslint = spawnSync(
  process.execPath,
  [eslintBin, '--config', config, '--no-warn-ignored', '--max-warnings', '0', target],
  { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' },
)

const tdzOnly = (eslint.stdout || '') + (eslint.stderr || '')
const tdzHits = tdzOnly
  .split('\n')
  .filter((l) => l.includes('no-use-before-define') && !l.includes('outputMsRef'))

if (tdzHits.length) {
  console.error(tdzHits.join('\n'))
  process.exit(1)
}

console.log('verify-clips-editor-eslint: OK')
