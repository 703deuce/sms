#!/usr/bin/env node
/**
 * Ensure proj_89c551 full composition has two deterministic test cuts (first two kept words).
 * Run inside prod web container with DATABASE_URL. Does not print secrets.
 */
import { PrismaClient } from '@prisma/client'

/** Prod fixture interview project (prefix proj_89c551…). */
const PROJECT_ID =
  process.env.SCRIPT_E2E_PROJECT_ID || 'proj_89c551443cb34a48a034a2260e9eeeca'

const prisma = new PrismaClient()

async function main() {
  const project = await prisma.clipProject.findFirst({
    where: { id: PROJECT_ID },
    include: { scriptCompositions: { where: { kind: 'FULL', deletedAt: null }, take: 1 } },
  })
  if (!project?.scriptCompositions[0]) {
    console.error('composition not found')
    process.exit(1)
  }
  const comp = project.scriptCompositions[0]
  const doc = comp.document
  if (!doc || typeof doc !== 'object') {
    console.error('missing document')
    process.exit(1)
  }
  const kept = Array.isArray(doc.keptWordIds) ? doc.keptWordIds : []
  const deleted = new Set(Array.isArray(doc.deletedWordIds) ? doc.deletedWordIds : [])
  const targets = kept.filter((id) => !deleted.has(id)).slice(0, 2)
  if (targets.length < 2) {
    console.log('[e2e] proj already has test cuts or insufficient words')
    await prisma.$disconnect()
    return
  }
  const next = {
    ...doc,
    deletedWordIds: [...deleted, ...targets],
    keptWordIds: kept.filter((id) => !targets.includes(id)),
  }
  await prisma.scriptComposition.update({
    where: { id: comp.id },
    data: { document: next, revision: comp.revision + 1 },
  })
  console.log(`[e2e] applied ${targets.length} test cuts on ${PROJECT_ID} comp=${comp.id}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
