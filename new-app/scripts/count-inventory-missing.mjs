// Dev helper: approximate missing inventory (run after vitest pattern)
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const inv = JSON.parse(readFileSync(join(root, 'lib/clips/editor/layout-control-inventory.generated.json'), 'utf8'))
const byKind = {}
for (const e of inv.entries) {
  byKind[e.discover.kind] = (byKind[e.discover.kind] ?? 0) + 1
}
console.log(byKind)
