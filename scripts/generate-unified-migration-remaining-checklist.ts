/**
 * Writes docs/UNIFIED-APPOINTMENTS-MIGRATION-REMAINING-CHECKLIST.json from route tree + matrix.
 * Run: npx tsx scripts/generate-unified-migration-remaining-checklist.ts
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (name === 'page.tsx') acc.push(p)
  }
  return acc
}

function main() {
  const appointmentPages = walk(join(ROOT, 'src/app/(app)/appointments'))
  const arPages = walk(join(ROOT, 'src/app/(app)/appointment-reminders'))
  const matrix = readFileSync(
    join(ROOT, 'docs/UNIFIED-APPOINTMENTS-FRONTEND-MIGRATION-MATRIX.md'),
    'utf8',
  )
  const partial = (matrix.match(/Opus partial/g) || []).length
  const legacy = (matrix.match(/Legacy Kimi/g) || []).length
  const complete = (matrix.match(/Opus complete/g) || []).length

  const checklist = {
    generatedAt: new Date().toISOString(),
    status: 'INCOMPLETE',
    routePages: {
      appointments: appointmentPages.length,
      appointmentReminders: arPages.length,
      total: appointmentPages.length + arPages.length,
    },
    matrixNavRows: {
      opusComplete: complete,
      opusPartial: partial,
      legacyKimi: legacy,
    },
    retainedAdminRoutes: appointmentPages.length + arPages.length,
    fullyMigratedRoutes: null as number | null,
    remainingLegacyVisualRoutes: null as number | null,
    notes:
      'fullyMigratedRoutes and remainingLegacyVisualRoutes require audit-unified-legacy-visual-imports.ts exit 0 and manual matrix opus_complete for all retained routes.',
    appointmentRoutePaths: appointmentPages.map((p) =>
      '/' +
      relative(join(ROOT, 'src/app/(app)'), p)
        .replace(/\/page\.tsx$/, '')
        .replace(/^appointments\//, 'appointments/'),
    ),
  }

  writeFileSync(
    join(ROOT, 'docs/UNIFIED-APPOINTMENTS-MIGRATION-REMAINING-CHECKLIST.json'),
    JSON.stringify(checklist, null, 2) + '\n',
  )
  console.log('Wrote docs/UNIFIED-APPOINTMENTS-MIGRATION-REMAINING-CHECKLIST.json')
}

main()
