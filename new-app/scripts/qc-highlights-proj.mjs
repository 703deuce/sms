#!/usr/bin/env node
/** QC: getFullVideoHighlights shape (no secrets). Usage: DATABASE_URL=... node scripts/qc-highlights-proj.mjs <projectId> */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const Module = require('module')
const load = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') return {}
  return load.apply(this, arguments)
}

const projectId = process.argv[2]
if (!projectId) {
  console.error('usage: node scripts/qc-highlights-proj.mjs <projectId>')
  process.exit(1)
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

await import('tsx/esm/api').then(({ register }) => register({ tsconfig: './tsconfig.json' }))

const { getPrisma } = await import('../lib/server/db.ts')
const { getFullVideoHighlights } = await import('../lib/server/clips/clip-highlights.ts')

const prisma = getPrisma()
const row = await prisma.clipProject.findFirst({
  where: { id: projectId, deletedAt: null },
  select: { workspaceId: true },
})
if (!row) {
  console.log(JSON.stringify({ error: 'project_not_found' }))
  process.exit(0)
}

const r = await getFullVideoHighlights(row.workspaceId, projectId)
console.log(
  JSON.stringify({
    source: r?.source ?? null,
    status: r?.status ?? null,
    picksLength: r?.picks?.length ?? 0,
    firstStartMs: r?.picks?.[0]?.startMs ?? null,
    firstEndMs: r?.picks?.[0]?.endMs ?? null,
  }),
)
