/**
 * Detects legacy Kimi / wrapper visual dependencies on unified scheduling routes.
 * Run: npx tsx scripts/audit-unified-legacy-visual-imports.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')

const ROUTE_ROOTS = [
  'src/app/(app)/appointments',
  'src/app/(app)/appointment-reminders',
]

const OPUS_ENTRY_GLOB = 'src/newui-transplant/connected'

const FORBIDDEN_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: 'kimi-connected-shell', re: /features\/appointments\/kimi\/[^'"]+-connected/ },
  { id: 'kimi-pilot-css', re: /kimi-ui\/shared\/(appointments-pilot|bookable-workspace|workspace-pilot|reference\.css)/ },
  { id: 'scheduling-opus-body-wrapper', re: /SchedulingOpusBody/ },
  { id: 'scheduling-opus-embed', re: /SchedulingOpusEmbed/ },
  { id: 'scheduling-opus-scope-css', re: /scheduling-opus-scope/ },
  { id: 'pilot-shell-class', re: /appt-overview-pilot|bookable-workspace-pilot|ws-pilot/ },
]

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) acc.push(p)
  }
  return acc
}

function scanFile(path: string) {
  const text = readFileSync(path, 'utf8')
  const hits: string[] = []
  for (const { id, re } of FORBIDDEN_PATTERNS) {
    if (re.test(text)) hits.push(id)
  }
  return hits
}

function resolveOpusEntryFromPage(pagePath: string, text: string): string[] {
  const imports = [...text.matchAll(/from ['"](@\/[^'"]+)['"]/g)].map((m) => m[1])
  const gates = imports.filter((i) => i.includes('scheduling-unified-gates') || i.includes('-opus'))
  return gates.map((i) => i.replace(/^@\//, 'src/').replace(/\.tsx?$/, '') + '.tsx')
}

function main() {
  const routeFiles = ROUTE_ROOTS.flatMap((r) => walk(join(ROOT, r)))
  const opusFiles = walk(join(ROOT, OPUS_ENTRY_GLOB))

  const violations: Array<{ file: string; reasons: string[] }> = []

  for (const file of routeFiles) {
    if (!file.endsWith('page.tsx')) continue
    const rel = relative(ROOT, file)
    const text = readFileSync(file, 'utf8')
    const direct = scanFile(file)
    if (direct.length) violations.push({ file: rel, reasons: direct.map((d) => `page:${d}`) })
  }

  for (const file of opusFiles) {
    const rel = relative(ROOT, file)
    if (rel.includes('scheduling-opus-body') || rel.includes('scheduling-opus-embed')) {
      violations.push({ file: rel, reasons: ['forbidden-wrapper-module'] })
      continue
    }
    const hits = scanFile(file)
    if (hits.length) violations.push({ file: rel, reasons: hits })
  }

  const uniqueRoutes = routeFiles.filter((f) => f.endsWith('page.tsx')).length

  console.log('Unified Appointments legacy visual audit')
  console.log('----------------------------------------')
  console.log(`Route pages scanned: ${uniqueRoutes}`)
  console.log(`Opus connected files scanned: ${opusFiles.length}`)
  console.log(`Violations: ${violations.length}`)
  console.log('')

  const byReason = new Map<string, number>()
  for (const v of violations) {
    for (const r of v.reasons) byReason.set(r, (byReason.get(r) || 0) + 1)
  }
  console.log('By reason:')
  for (const [k, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n}\t${k}`)
  }
  console.log('')

  for (const v of violations.slice(0, 80)) {
    console.log(`${v.file}`)
    console.log(`  → ${v.reasons.join(', ')}`)
  }
  if (violations.length > 80) console.log(`… and ${violations.length - 80} more`)

  process.exit(violations.length > 0 ? 1 : 0)
}

main()
