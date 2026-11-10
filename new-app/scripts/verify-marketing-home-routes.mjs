/**
 * Compare every new-app/app page route against a frozen inventory taken from
 * PR #1082 (ee8cb81e). Asserts that each old path still resolves to the same
 * page file or a redirect. Allowed changes:
 *   - `/` used to redirect to /app/home and now renders the public marketing home
 *   - `/ai-clips` is now a 308 permanentRedirect to `/ai-clipper`
 *   - `/video-editing` is now a 308 permanentRedirect to `/video-editor`
 * New paths `/ai-clipper` and `/video-editor` are the marketing pages.
 * `/app` now renders the authenticated Home dashboard (not a clips redirect).
 * `/app/home` remains the Home alias, redirecting through routes.app() to `/app`.
 * `/app/studio` is the AI Studio workspace (frontend/ai-studio).
 * `/app/youtube-video` is the YouTube Video workspace.
 *
 * Usage (from new-app/): node scripts/verify-marketing-home-routes.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.join(__dirname, '..', 'app')
const fixturePath = path.join(__dirname, '..', 'tests/fixtures/app-page-routes-before.json')

console.log('[marketing-home-routes] Step 1: initialize new-app route guard and fixture paths')

const PAGE_RE = /^page\.(tsx|ts|jsx|js)$/
const REDIRECT_RE = /(?:permanentRedirect|redirect)\(\s*(?:['"]([^'"]+)['"]|`([^`$]+))/g

const ALLOWED_CHANGES = {
  '/': {
    from: { file: 'new-app/app/page.tsx', redirectTo: '/app/home' },
    to: { file: 'new-app/app/(marketing)/page.tsx', redirectTo: null },
  },
  '/app': {
    from: { file: 'new-app/app/app/page.tsx', redirectTo: '/app/clips' },
    to: { file: 'new-app/app/app/page.tsx', redirectTo: null },
  },
  '/app/home': {
    from: { file: 'new-app/app/app/home/page.tsx', redirectTo: '/app/clips' },
    to: { file: 'new-app/app/app/home/page.tsx', redirectTo: null },
  },
  '/ai-clips': {
    from: { file: 'new-app/app/(marketing)/ai-clips/page.tsx', redirectTo: null },
    to: { file: 'new-app/app/(marketing)/ai-clips/page.tsx', redirectTo: '/ai-clipper' },
  },
  '/video-editing': {
    from: { file: 'new-app/app/(marketing)/video-editing/page.tsx', redirectTo: null },
    to: { file: 'new-app/app/(marketing)/video-editing/page.tsx', redirectTo: '/video-editor' },
  },
}

const ALLOWED_NEW = {
  '/ai-clipper': { file: 'new-app/app/(marketing)/ai-clipper/page.tsx', redirectTo: null },
  '/video-editor': { file: 'new-app/app/(marketing)/video-editor/page.tsx', redirectTo: null },
  '/app/studio': { file: 'new-app/app/app/studio/page.tsx', redirectTo: null },
  '/app/youtube-video': { file: 'new-app/app/app/youtube-video/page.tsx', redirectTo: null },
  '/app/captions': { file: 'new-app/app/app/captions/page.tsx', redirectTo: null },
}

const LEGACY_SLUG_REDIRECTS = {
  '/ai-clips': '/ai-clipper',
  '/video-editing': '/video-editor',
}

function isRouteGroup(name) {
  return name.startsWith('(') && name.endsWith(')')
}

function isIntercept(name) {
  return name.startsWith('@')
}

function fileToRoute(relFromApp) {
  const parts = relFromApp.split(/[\\/]/).slice(0, -1)
  const segs = parts.filter((p) => !isRouteGroup(p) && !isIntercept(p))
  return segs.length ? `/${segs.join('/')}` : '/'
}

function detectRedirect(text) {
  if (!text.includes('export default')) return null
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  if (/return\s*\(\s*</.test(stripped) || /return\s+</.test(stripped)) return null
  // Conditional redirects (feature flags, etc.) still "resolve" to this page file.
  if (/\bif\s*\(/.test(stripped)) return null
  const matches = [...text.matchAll(REDIRECT_RE)]
  if (matches.length !== 1) return null
  const m = matches[0]
  return m[1] || m[2] || null
}

function walkPages(root) {
  const routes = {}
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        stack.push(full)
        continue
      }
      if (!PAGE_RE.test(ent.name)) continue
      const rel = path.relative(root, full).split(path.sep).join('/')
      const url = fileToRoute(rel)
      const text = fs.readFileSync(full, 'utf8')
      const rec = { file: `new-app/app/${rel}`, redirectTo: detectRedirect(text) }
      if (routes[url]) {
        throw new Error(`Duplicate route ${url}: ${routes[url].file} vs ${rec.file}`)
      }
      routes[url] = rec
    }
  }
  return routes
}

function sameRecord(a, b) {
  return a.file === b.file && (a.redirectTo ?? null) === (b.redirectTo ?? null)
}

function sortRoutes(routes) {
  return Object.fromEntries(Object.entries(routes).sort(([a], [b]) => a.localeCompare(b)))
}

console.log('[marketing-home-routes] Step 2: load the frozen pre-home route inventory')
const before = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
console.log('[marketing-home-routes] Step 3: walk and inventory current new-app pages')
const after = sortRoutes(walkPages(appRoot))
console.log(`[marketing-home-routes] Inventoried ${Object.keys(before.routes).length} baseline routes and ${Object.keys(after).length} current routes`)

const failures = []
const rows = []

console.log('[marketing-home-routes] Step 4: verify each existing route and documented exception')
for (const [url, prev] of Object.entries(before.routes).sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`[marketing-home-routes] Checking existing route: ${url}`)
  const next = after[url]
  const allowed = ALLOWED_CHANGES[url]
  if (!next) {
    failures.push(`Missing after path ${url} (was ${prev.file}${prev.redirectTo ? ' → ' + prev.redirectTo : ''})`)
    rows.push({ url, before: fmt(prev), after: 'MISSING', status: 'FAIL' })
    continue
  }
  if (allowed) {
    const fromOk = sameRecord(prev, allowed.from)
    const toOk = sameRecord(next, allowed.to)
    if (!fromOk) {
      failures.push(`Allowed-change fixture mismatch for ${url}: before was ${JSON.stringify(prev)}, expected ${JSON.stringify(allowed.from)}`)
    }
    if (!toOk) {
      failures.push(`Allowed change for ${url} did not match expected home page. Got ${JSON.stringify(next)}, expected ${JSON.stringify(allowed.to)}`)
    }
    rows.push({
      url,
      before: fmt(prev),
      after: fmt(next),
      status: fromOk && toOk ? 'ALLOWED' : 'FAIL',
    })
    continue
  }
  if (!sameRecord(prev, next)) {
    failures.push(`Path ${url} changed: ${fmt(prev)} → ${fmt(next)}`)
    rows.push({ url, before: fmt(prev), after: fmt(next), status: 'FAIL' })
  } else {
    rows.push({ url, before: fmt(prev), after: fmt(next), status: 'SAME' })
  }
}

console.log('[marketing-home-routes] Step 5: verify every new route is explicitly allowed')
const newPaths = Object.keys(after).filter((u) => !(u in before.routes))
for (const url of newPaths.sort()) {
  console.log(`[marketing-home-routes] Checking new route: ${url}`)
  const expected = ALLOWED_NEW[url]
  if (expected) {
    const ok = sameRecord(after[url], expected)
    if (!ok) {
      failures.push(`Allowed new path ${url} did not match. Got ${JSON.stringify(after[url])}, expected ${JSON.stringify(expected)}`)
    }
    rows.push({ url, before: '—', after: fmt(after[url]), status: ok ? 'NEW' : 'FAIL' })
  } else {
    failures.push(`Unexpected new path ${url}: ${fmt(after[url])}`)
    rows.push({ url, before: '—', after: fmt(after[url]), status: 'FAIL' })
  }
}

function fmt(rec) {
  if (!rec) return '—'
  const short = rec.file.replace(/^new-app\/app\//, '')
  return rec.redirectTo ? `${short}  redirect→  ${rec.redirectTo}` : short
}

function col(s, n) {
  const t = String(s)
  return t.length >= n ? t.slice(0, n - 1) + '…' : t.padEnd(n)
}

let out = ''
out += '# Marketing home route check\n'
out += `\nBefore inventory: ${before.generatedFrom} (${Object.keys(before.routes).length} page routes)\n`
out += `After tree:      ${appRoot} (${Object.keys(after).length} page routes)\n`
out += '\nAllowed changes: `/` from `app/page.tsx` redirect `/app/home` → `app/(marketing)/page.tsx` (public home); `/ai-clips` → 308 `/ai-clipper`; `/video-editing` → 308 `/video-editor`.\n'
out += 'Authenticated home: `/app` renders the dashboard; `/app/home` is its alias and permanently redirects to `/app` through `routes.app()`.\n\n'
out += '| Status  | Path | Before | After |\n'
out += '|---------|------|--------|-------|\n'
for (const r of rows) {
  out += `| ${r.status.padEnd(7)} | \`${r.url}\` | ${r.before} | ${r.after} |\n`
}
out += '\n'

const appHome = after['/app']
const homeAlias = after['/app/home']
const required = [
  '/',
  '/ai-clips',
  '/video-editing',
  '/ai-clipper',
  '/video-editor',
  '/app',
  '/app/home',
  '/app/clips',
  '/app/clips/new',
  '/app/clips/[projectId]',
  '/app/clips/[projectId]/edit/[clipId]',
  '/app/clips/[projectId]/studio/[clipId]',
  '/app/clips/[projectId]/script',
  '/app/streamer',
  '/app/rooms',
  '/app/record',
  '/app/help',
  '/share/clips/[linkId]',
  '/share/p/[slug]',
  '/share/renders/[slug]',
  '/s/[token]',
  '/ai-producer-agent/clean-take',
  '/ai-producer-agent/multi-source',
]
console.log('[marketing-home-routes] Step 6: verify every required deep link')
for (const p of required) {
  console.log(`[marketing-home-routes] Checking required deep link: ${p}`)
  if (!after[p]) failures.push(`Required deep link missing after change: ${p}`)
}
console.log('[marketing-home-routes] Step 7: verify real Home dashboard and Home alias semantics')
if (!appHome || appHome.redirectTo !== null) {
  failures.push(`/app must render the Home dashboard without redirecting, got ${JSON.stringify(appHome)}`)
}
if (!homeAlias || homeAlias.redirectTo !== null) {
  failures.push(`/app/home must resolve to the Home page without redirecting to clips, got ${JSON.stringify(homeAlias)}`)
}
if (homeAlias) {
  const aliasSource = fs.readFileSync(path.join(appRoot, 'app/home/page.tsx'), 'utf8')
  const pointsToAppHome = /permanentRedirect\s*\(\s*withQuery\s*\(\s*routes\.app\s*\(\s*\)/.test(aliasSource)
  if (!pointsToAppHome) {
    failures.push('/app/home must permanently redirect through routes.app() to the Home dashboard')
  }
}

out += '## Legacy slug redirects (308)\n\n'
out += '| From | To | File | Detected target | Status |\n'
out += '| --- | --- | --- | --- | --- |\n'
console.log('[marketing-home-routes] Step 8: check legacy marketing slugs still use 308 redirects')
for (const [from, to] of Object.entries(LEGACY_SLUG_REDIRECTS)) {
  console.log(`[marketing-home-routes] Checking permanent redirect: ${from} -> ${to}`)
  const rec = after[from]
  const text = rec ? fs.readFileSync(path.join(appRoot, rec.file.replace(/^new-app\/app\//, '')), 'utf8') : ''
  const usesPermanent = /permanentRedirect\s*\(/.test(text)
  const ok = Boolean(rec) && rec.redirectTo === to && usesPermanent
  if (!ok) {
    failures.push(`Legacy slug ${from} should permanentRedirect to ${to}, got ${JSON.stringify(rec)} permanentRedirect=${usesPermanent}`)
  }
  out += `| \`${from}\` | \`${to}\` | ${rec ? rec.file.replace(/^new-app\/app\//, '') : 'MISSING'} | ${rec?.redirectTo ?? '—'} | ${ok ? 'PASS' : 'FAIL'} |\n`
}
out += '\n'

console.log(`[marketing-home-routes] Step 9: report ${failures.length} verification failures`)
if (failures.length) {
  out += '## FAIL\n'
  for (const f of failures) out += `- ${f}\n`
  process.stdout.write(out)
  process.exit(1)
}

out += '## PASS\n'
out += `All ${Object.keys(before.routes).length} previously existing page paths still resolve to the same page or a documented redirect (home at \`/\`, plus legacy slug 308s).\n`
out += `${newPaths.length} new path(s) (${Object.keys(ALLOWED_NEW).join(', ')} allowed).\n`
console.log('[marketing-home-routes] PASS: all preserved and documented routes verified')
process.stdout.write(out)
