#!/usr/bin/env node
/** Compare full new-app tsc unique diagnostic triples against current master. */
import { readFileSync } from 'node:fs'

const [masterPath, headPath] = process.argv.slice(2)
if (!masterPath || !headPath) throw new Error('Usage: node b2b-compare-tsc.mjs master.log head.log')
function diagnostics(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  const out = new Map()
  for (const line of lines) {
    const found = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/)
    if (!found) continue
    // Compare file/code/message, not line numbers shifted by additive edits.
    const key = [found[1].replaceAll('\\','/'), found[2], found[3]].join('|')
    out.set(key, (out.get(key) ?? 0) + 1)
  }
  return out
}
const master = diagnostics(masterPath), head = diagnostics(headPath)
const total = m => [...m.values()].reduce((sum, n) => sum + n, 0)
const added = [...head].filter(([key, n]) => n > (master.get(key) ?? 0))
console.log('master errors=' + total(master) + ', head errors=' + total(head) + ', new triples=' + added.length)
if (total(master) !== 456) throw new Error('Master baseline changed: expected 456, got ' + total(master))
if (added.length || total(head) > total(master)) {
  console.error(added.slice(0, 30))
  throw new Error('B2B introduced new TypeScript diagnostics')
}
