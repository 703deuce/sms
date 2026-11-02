#!/usr/bin/env node
/** Base UI Slider uses onValueCommitted, not Radix onValueCommit — catch typos in clips editor. */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(process.cwd(), 'components', 'clips')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

let failed = false
for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8')
  if (!text.includes('onValueCommit')) continue
  if (text.includes('onValueCommit=') && !text.includes('onValueCommitted')) {
    console.error('[verify-slider-props] use onValueCommitted (Base UI Slider):', file)
    failed = true
  }
}
if (failed) process.exit(1)
console.log('[verify-slider-props] ok')
