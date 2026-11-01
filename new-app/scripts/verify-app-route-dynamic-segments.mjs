/**
 * Next.js App Router requires the same dynamic segment name among sibling route folders.
 * e.g. renders/[id] and renders/[renderId] must not coexist.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.join(__dirname, '..', 'app')

const DYNAMIC_DIR = /^\[[^\]/]+\]$/

function listDirs(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

const violations = []

function walk(dir, relParts = []) {
  const names = listDirs(dir)
  const dynamic = names.filter((n) => DYNAMIC_DIR.test(n))
  if (dynamic.length > 1) {
    const slugs = dynamic.map((n) => n.slice(1, -1))
    const unique = new Set(slugs)
    if (unique.size > 1) {
      violations.push({
        dir: relParts.join('/') || '.',
        segments: dynamic,
        slugs: [...unique],
      })
    }
  }
  for (const name of names) {
    walk(path.join(dir, name), [...relParts, name])
  }
}

walk(appRoot)

if (violations.length) {
  console.error('[verify-app-route-dynamic-segments] sibling dynamic folders use different slug names:')
  for (const v of violations) {
    console.error(`  app/${v.dir}: ${v.segments.join(', ')} (${v.slugs.join(' vs ')})`)
  }
  process.exit(1)
}

console.log('[verify-app-route-dynamic-segments] ok')
