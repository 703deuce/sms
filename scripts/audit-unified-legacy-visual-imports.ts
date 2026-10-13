/**
 * Transitive legacy visual dependency audit for Unified Appointments.
 * Starts at each route page.tsx, follows @/ imports from the Opus branch of SchedulingPageGate
 * (or direct Opus imports), and fails if any file in the closure matches forbidden patterns.
 *
 * Run: npx tsx scripts/audit-unified-legacy-visual-imports.ts
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')

const ROUTE_ROOTS = [
  'src/app/(app)/appointments',
  'src/app/(app)/appointment-reminders',
]

const FORBIDDEN_MODULE_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: 'kimi-connected-shell', re: /features\/appointments\/kimi\/[^'"]+-connected/ },
  { id: 'kimi-ui-visual-tree', re: /components\/appointments\/kimi-ui\// },
  { id: 'scheduling-opus-body-wrapper', re: /SchedulingOpusBody/ },
  { id: 'scheduling-opus-embed', re: /SchedulingOpusEmbed/ },
  { id: 'scheduling-opus-scope-css', re: /scheduling-opus-scope/ },
  { id: 'kimi-pilot-css', re: /kimi-ui\/shared\/(appointments-pilot|bookable-workspace|workspace-pilot|reference\.css)/ },
  { id: 'pilot-shell-class', re: /appt-overview-pilot|bookable-workspace-pilot|ws-pilot/ },
  { id: 'legacy-workspace-connected', re: /WorkspaceConnected|team-booking-workspace-connected/ },
]

const FORBIDDEN_PATH_SUFFIXES = [
  'scheduling-opus-body.tsx',
  'scheduling-opus-embed.tsx',
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

function resolveImport(spec: string, fromFile: string): string | null {
  if (spec.startsWith('@/')) {
    const base = join(ROOT, 'src', spec.slice(2))
    const candidates = [
      base,
      `${base}.tsx`,
      `${base}.ts`,
      join(base, 'index.tsx'),
      join(base, 'index.ts'),
    ]
    for (const c of candidates) {
      if (existsSync(c) && statSync(c).isFile()) return c
    }
    return null
  }
  if (spec.startsWith('.')) {
    const base = join(dirname(fromFile), spec)
    const candidates = [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx')]
    for (const c of candidates) {
      if (existsSync(c) && statSync(c).isFile()) return c
    }
  }
  return null
}

function parseImports(filePath: string): string[] {
  const text = readFileSync(filePath, 'utf8')
  const specs: string[] = []
  const re = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) specs.push(m[1])
  return specs
}

function scanFileViolations(filePath: string): string[] {
  const rel = relative(ROOT, filePath)
  if (FORBIDDEN_PATH_SUFFIXES.some((s) => rel.endsWith(s))) {
    return ['forbidden-wrapper-module']
  }
  const text = readFileSync(filePath, 'utf8')
  const hits: string[] = []
  for (const { id, re } of FORBIDDEN_MODULE_PATTERNS) {
    if (re.test(text)) hits.push(id)
  }
  return hits
}

function extractOpusRootFromPage(pagePath: string): string[] {
  const text = readFileSync(pagePath, 'utf8')
  const roots: string[] = []

  const gateImport = text.match(
    /import\s+\{([^}]+)\}\s+from\s+['"]@\/newui-transplant\/connected\/scheduling\/scheduling-unified-gates['"]/,
  )
  if (gateImport) {
    const names = gateImport[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0])
    const used = names.filter((n) => text.includes(`<${n}`))
    for (const name of used) {
      const gateText = readFileSync(
        join(ROOT, 'src/newui-transplant/connected/scheduling/scheduling-unified-gates.tsx'),
        'utf8',
      )
      const compMatch = gateText.match(
        new RegExp(`export function ${name}[\\s\\S]*?opus=\\{<([A-Za-z0-9_]+)`),
      )
      if (compMatch) roots.push(compMatch[1])
    }
  }

  const inlineOpus = [...text.matchAll(/opus=\{\s*<([A-Za-z0-9_]+)/g)].map((x) => x[1])
  roots.push(...inlineOpus)

  const directOpus = [...text.matchAll(/from ['"]@\/newui-transplant\/connected\/[^'"]+['"]/g)]
  if (directOpus.length && roots.length === 0) {
    const imports = parseImports(pagePath).filter((s) => s.startsWith('@/newui-transplant/connected/'))
    for (const spec of imports) {
      const p = resolveImport(spec, pagePath)
      if (p) roots.push(relative(ROOT, p))
    }
  }

  return roots
}

function resolveComponentSymbol(pagePath: string, symbol: string): string | null {
  if (symbol.includes('/')) return join(ROOT, symbol)

  const searchRoots = [
    pagePath,
    join(ROOT, 'src/newui-transplant/connected/scheduling/scheduling-unified-gates.tsx'),
    join(ROOT, 'src/newui-transplant/connected/scheduling/scheduling-unified-gates.tsx'),
  ]

  for (const root of searchRoots) {
    const text = readFileSync(root, 'utf8')
    const re = new RegExp(
      `import\\s+\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s+from\\s+['"]([^'"]+)['"]`,
    )
    const m = text.match(re)
    if (m) {
      const resolved = resolveImport(m[1], root)
      if (resolved) return resolved
    }
  }
  return null
}

function transitiveClosure(entryFiles: string[]): Map<string, string[]> {
  const visited = new Set<string>()
  const violations = new Map<string, string[]>()
  const queue = [...entryFiles]

  while (queue.length) {
    const file = queue.shift()!
    if (visited.has(file)) continue
    visited.add(file)

    const fileViolations = scanFileViolations(file)
    if (fileViolations.length) {
      violations.set(relative(ROOT, file), fileViolations)
    }

    for (const spec of parseImports(file)) {
      const next = resolveImport(spec, file)
      if (next && !visited.has(next)) queue.push(next)
    }
  }

  return violations
}

function main() {
  const routeFiles = ROUTE_ROOTS.flatMap((r) => walk(join(ROOT, r))).filter((f) =>
    f.endsWith('page.tsx'),
  )

  const allViolations = new Map<string, string[]>()
  const routesWithIssues: string[] = []

  for (const page of routeFiles) {
    const symbols = extractOpusRootFromPage(page)
    const entryFiles: string[] = []
    for (const sym of symbols) {
      if (sym.includes('src/')) entryFiles.push(join(ROOT, sym))
      else {
        const f = resolveComponentSymbol(page, sym)
        if (f) entryFiles.push(f)
      }
    }
    if (entryFiles.length === 0) {
      const pageViolations = scanFileViolations(page)
      if (pageViolations.length) {
        const rel = relative(ROOT, page)
        allViolations.set(rel, pageViolations.map((v) => `page:${v}`))
        routesWithIssues.push(rel)
      }
      continue
    }

    const closure = transitiveClosure(entryFiles)
    if (closure.size > 0) {
      routesWithIssues.push(relative(ROOT, page))
      for (const [file, reasons] of closure) {
        const prev = allViolations.get(file) || []
        allViolations.set(file, [...new Set([...prev, ...reasons])])
      }
    }
  }

  console.log('Unified Appointments — transitive legacy visual audit')
  console.log('------------------------------------------------------')
  console.log(`Route pages: ${routeFiles.length}`)
  console.log(`Routes with transitive violations: ${routesWithIssues.length}`)
  console.log(`Unique files with violations: ${allViolations.size}`)
  console.log('')

  const byReason = new Map<string, number>()
  for (const reasons of allViolations.values()) {
    for (const r of reasons) byReason.set(r, (byReason.get(r) || 0) + 1)
  }
  console.log('By reason:')
  for (const [k, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n}\t${k}`)
  }
  console.log('')

  let shown = 0
  for (const [file, reasons] of allViolations) {
    if (shown++ >= 100) {
      console.log(`… and ${allViolations.size - 100} more files`)
      break
    }
    console.log(file)
    console.log(`  → ${reasons.join(', ')}`)
  }

  process.exit(allViolations.size > 0 ? 1 : 0)
}

main()
