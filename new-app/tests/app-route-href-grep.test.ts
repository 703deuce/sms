// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'tests',
  'e2e',
  'scripts',
  'docs',
  'prisma',
])
const ALLOW_FILES = new Set([
  path.join('lib', 'app-route-redirects.mjs'),
])
const ALLOW_LINE = /(startsWith\(|endsWith\(|includes\(|===|!==|\.test\(|source:\s*|destination:\s*|replace\(\/)/
const OLD = /\/app\/clips\/[^"'`\s]*\/(?:edit|studio|script|video)(?:\/|\?|'|"|`|$)|\/app\/clips\/video(?:\/|\?|'|"|`|$)|(?:['"`])\/app\/editor(?:\/|\?|'|"|`|$)|intent=full/

function walk(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(ent.name)) out.push(full)
  }
  return out
}

describe('production hrefs do not point at retired /app routes', () => {
  it('has no first-party href leftovers at old editor, studio, script, /app/editor, or intent=full', () => {
    const hits: string[] = []
    for (const file of walk(ROOT)) {
      const rel = path.relative(ROOT, file)
      if (ALLOW_FILES.has(rel)) continue
      // Marketing /video-editor is not a SaaS editor path and is out of scope.
      const text = fs.readFileSync(file, 'utf8')
      text.split(/\n/).forEach((line, i) => {
        if (!OLD.test(line)) return
        if (ALLOW_LINE.test(line)) return
        if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) return
        hits.push(`${rel}:${i + 1}: ${line.trim()}`)
      })
    }
    expect(hits, hits.join('\n')).toEqual([])
  })
})
