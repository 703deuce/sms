/**
 * Writes docs/UNIFIED-APPOINTMENTS-MIGRATION-REMAINING-CHECKLIST.json
 * Run: npx tsx scripts/generate-unified-migration-remaining-checklist.ts
 */
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')

/** Routes verified native New UI2 + functional parity (grow as migration proceeds). */
const VERIFIED_NATIVE_ROUTES: string[] = [
  '/appointments/team-booking',
  '/appointments/staff',
  '/appointments/locations',
  '/appointments/resources',
  '/appointments/clients',
  '/appointments/scheduled',
  '/appointments/new',
  '/appointments/waitlist',
  '/appointments/workflows',
  '/appointment-reminders/responses',
  '/appointment-reminders/reminders',
  '/appointment-reminders/ai-rescheduler',
]

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (name === 'page.tsx') acc.push(p)
  }
  return acc
}

function routePathFromPage(pagePath: string): string {
  const rel = relative(join(ROOT, 'src/app/(app)'), pagePath).replace(/\/page\.tsx$/, '')
  return `/${rel}`
}

function main() {
  const appointmentPages = walk(join(ROOT, 'src/app/(app)/appointments'))
  const arPages = walk(join(ROOT, 'src/app/(app)/appointment-reminders'))
  const allPages = [...appointmentPages, ...arPages]
  const routePaths = allPages.map(routePathFromPage)

  const matrix = readFileSync(
    join(ROOT, 'docs/UNIFIED-APPOINTMENTS-FRONTEND-MIGRATION-MATRIX.md'),
    'utf8',
  )
  const partial = (matrix.match(/Opus partial/g) || []).length
  const legacy = (matrix.match(/Legacy Kimi/g) || []).length
  const complete = (matrix.match(/Opus complete/g) || []).length

  let auditExitCode = 0
  let auditSummary = 'not run'
  try {
    execSync('npx tsx scripts/audit-unified-legacy-visual-imports.ts', {
      cwd: ROOT,
      stdio: 'pipe',
    })
    auditSummary = 'PASS (0 transitive violations)'
  } catch (e: unknown) {
    auditExitCode = 1
    const out = (e as { stdout?: Buffer }).stdout?.toString() || ''
    const m = out.match(/Unique files with violations: (\d+)/)
    auditSummary = m ? `FAIL (${m[1]} files with violations)` : 'FAIL'
  }

  const routes = routePaths.map((href) => ({
    href,
    status:
      VERIFIED_NATIVE_ROUTES.includes(href) ? 'verified_native' : ('pending' as const),
  }))

  const checklist = {
    generatedAt: new Date().toISOString(),
    status: 'INCOMPLETE',
    contract: 'docs/UNIFIED-APPOINTMENTS-MIGRATION-EXECUTION-CONTRACT.md',
    retainedAdminRoutes: routePaths.length,
    verifiedNativeRoutes: VERIFIED_NATIVE_ROUTES.length,
    pendingRoutes: routePaths.length - VERIFIED_NATIVE_ROUTES.length,
    routePages: {
      appointments: appointmentPages.length,
      appointmentReminders: arPages.length,
      total: routePaths.length,
    },
    matrixNavRows: {
      opusComplete: complete,
      opusPartial: partial,
      legacyKimi: legacy,
    },
    verification: {
      transitiveLegacyVisualAudit: auditSummary,
      transitiveLegacyVisualAuditExitCode: auditExitCode,
      productionBuild: 'not run this generation',
      browserVerification: 'not run this generation',
      functionalParityPerRoute: 'only routes in verifiedNativeRoutes[] are claimed verified',
    },
    routes,
  }

  writeFileSync(
    join(ROOT, 'docs/UNIFIED-APPOINTMENTS-MIGRATION-REMAINING-CHECKLIST.json'),
    JSON.stringify(checklist, null, 2) + '\n',
  )
  console.log('Wrote docs/UNIFIED-APPOINTMENTS-MIGRATION-REMAINING-CHECKLIST.json')
}

main()
