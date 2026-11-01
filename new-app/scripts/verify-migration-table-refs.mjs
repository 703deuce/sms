/**
 * Fail when a migration REFERENCES a quoted table name that is not a Prisma @@map
 * (or model name when @@map is absent).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const schemaPath = path.join(repoRoot, 'prisma/schema.prisma')
const migrationsDir = path.join(repoRoot, 'prisma/migrations')

/** Pre-existing migrations with wrong refs; do not extend this list. */
const LEGACY_MIGRATION_EXCEPTIONS = new Set([
  '20260907210000_mctb_handoff_notifications/migration.sql',
  '20260915020000_voice_v2_offer_sets/migration.sql',
])

function collectSchemaTableNames(schemaSrc) {
  const names = new Set()
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g
  let m
  while ((m = modelRe.exec(schemaSrc)) !== null) {
    const body = m[2]
    const mapMatch = body.match(/@@map\(\s*"([^"]+)"\s*\)/)
    names.add(mapMatch ? mapMatch[1] : m[1])
  }
  return names
}

function migrationFiles() {
  if (!fs.existsSync(migrationsDir)) return []
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(migrationsDir, d.name, 'migration.sql'))
    .filter((p) => fs.existsSync(p))
}

function relMigrationPath(absPath) {
  return path.relative(migrationsDir, absPath).replace(/\\/g, '/')
}

const schemaSrc = fs.readFileSync(schemaPath, 'utf8')
const validTables = collectSchemaTableNames(schemaSrc)
const refRe = /REFERENCES\s+"([^"]+)"/gi

const violations = []

for (const file of migrationFiles()) {
  const rel = relMigrationPath(file)
  const sql = fs.readFileSync(file, 'utf8')
  let match
  while ((match = refRe.exec(sql)) !== null) {
    const table = match[1]
    if (validTables.has(table)) continue
    if (LEGACY_MIGRATION_EXCEPTIONS.has(rel)) continue
    violations.push({ rel, table })
  }
}

if (violations.length) {
  console.error('[verify-migration-table-refs] invalid REFERENCES targets (not in schema @@map / model names):')
  for (const v of violations) {
    console.error(`  ${v.rel}: "${v.table}"`)
  }
  console.error(`[verify-migration-table-refs] valid table count=${validTables.size}`)
  process.exit(1)
}

console.log('[verify-migration-table-refs] ok')
