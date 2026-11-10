/**
 * Compare every new-app/app page route against a frozen inventory taken from
 * PR #1082 (ee8cb81e). Asserts that each old path still resolves to the same
 * page file or a redirect. The only allowed change is `/`, which used to
 * redirect to /app/home and now renders the public marketing home.
 *
 * Usage (from new-app/): node scripts/verify-marketing-home-routes.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.join(__dirname, '..', 'app')
const fixturePath = path.join(__dirname, '..', 'tests/fixtures/app-page-routes-before.json')

const PAGE_RE = /^page\.(tsx|ts|jsx|js)$/
const REDIRECT_RE = /redirect\(\s*(?:['"]([^'"]+)['"]|`([^`$]+))/g

const ALLOWED_CHANGES = {
  '/': {
    from: { file: 'new-app/app/page.tsx', redirectTo: '/app/home' },
    to: { file: 'new-app/app/(marketing)/page.tsx', redirectTo: null },
  },
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

const before = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
const after = sortRoutes(walkPages(appRoot))

const failures = []
const rows = []

for (const [url, prev] of Object.entries(before.routes).sort(([a], [b]) => a.localeCompare(b))) {
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

const newPaths = Object.keys(after).filter((u) => !(u in before.routes))
for (const url of newPaths.sort()) {
  rows.push({ url, before: '—', after: fmt(after[url]), status: 'NEW' })
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
out += '\nAllowed change: `/` from `app/page.tsx` redirect `/app/home` → `app/(marketing)/page.tsx` (public home).\n'
out += 'Log in target: `/app` still redirects to `/app/clips` (same as `/app/home`).\n\n'
out += '| Status  | Path | Before | After |\n'
out += '|---------|------|--------|-------|\n'
for (const r of rows) {
  out += `| ${r.status.padEnd(7)} | \`${r.url}\` | ${r.before} | ${r.after} |\n`
}
out += '\n'

const login = after['/app']
const homeAlias = after['/app/home']
const required = [
  '/',
  '/ai-clips',
  '/video-editing',
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
for (const p of required) {
  if (!after[p]) failures.push(`Required deep link missing after change: ${p}`)
}
if (!login || login.redirectTo !== '/app/clips') {
  failures.push(`Log in target /app should still redirect to /app/clips, got ${JSON.stringify(login)}`)
}
if (!homeAlias || homeAlias.redirectTo !== '/app/clips') {
  failures.push(`/app/home should still redirect to /app/clips, got ${JSON.stringify(homeAlias)}`)
}

out += `## Host policy for /

The same transovo-web app may be served on transovo.ai and voice.transovo.ai.
Marketing is allow-listed. Implemented in \`components/marketing/hosts.ts\`
and enforced in the marketing page server components via \`headers()\`
(\`x-forwarded-host\` or \`host\`), not middleware. \`/\` is \`force-dynamic\`
so it is never prerendered as marketing HTML for every host.

| Host | \`/\` resolves to | \`/ai-clips\` and \`/video-editing\` |
| --- | --- | --- |
| \`transovo.ai\` | marketing home (\`(marketing)/page.tsx\`) | render |
| \`www.transovo.ai\` | marketing home (\`(marketing)/page.tsx\`) | render |
| \`voice.transovo.ai\` | redirect \`/app/home\` (today's behavior) | not-found (those routes did not exist on this host) |
| \`www.voice.transovo.ai\` | redirect \`/app/home\` (today's behavior) | not-found |
| \`localhost\` / \`127.0.0.1\` / \`::1\` (any port) | marketing home (dev) | render |
| any other host | redirect \`/app/home\` (today's behavior) | not-found |

Live check (2026-11-09, America/New_York): \`https://transovo.ai/\` returns 307 \`/app/home\` then 307 \`/app/clips\` then 200. \`https://www.transovo.ai/\` 301s to \`https://transovo.ai\` then the same chain. \`https://voice.transovo.ai/\` and \`/app/home\`, \`/app/clips\`, \`/app\` currently return 502 "Bad Gateway" (11 bytes) — the host was not serving Next at probe time. \`https://www.voice.transovo.ai/\` failed TLS. new-app middleware has no host switch; today's *code* behavior for \`/\` on every host is \`redirect('/app/home')\`. This PR preserves that for every host except the marketing allow-list.

See \`tests/marketing-home-routes.test.ts\` for executable assertions of this table.

`

if (failures.length) {
  out += '## FAIL\n'
  for (const f of failures) out += `- ${f}\n`
  process.stdout.write(out)
  process.exit(1)
}

out += '## PASS\n'
out += `All ${Object.keys(before.routes).length} previously existing page paths still resolve to the same page or redirect, except the documented \`/\` home change.\n`
out += `${newPaths.length} new path(s) beyond the allowed \`/\` change.\n`
process.stdout.write(out)
