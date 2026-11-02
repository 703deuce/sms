import { PrismaClient } from '@prisma/client'
import { findRetakes, retakeCutRange } from './lib/clips/editor/retakes'
import { loadSourceWords, wordsInRange } from './lib/clips/source-words'
import { getClipStorage } from './lib/storage'

const clipIds = process.argv.slice(2)
if (!clipIds.length) {
  console.error('usage: tsx scripts/retakes-audit-clip-ids.ts <clipId>...')
  process.exit(1)
}

const prisma = new PrismaClient()
const storage = getClipStorage()

for (const clipId of clipIds) {
  const clip = await prisma.clip.findUnique({
    where: { id: clipId },
    include: { project: { select: { id: true, wordsKey: true } } },
  })
  if (!clip?.project?.wordsKey) {
    console.log(`\n=== ${clipId} ===\n(missing)`)
    continue
  }
  const raw = (await storage.getJson<Record<string, unknown>[]>(clip.project.wordsKey)) ?? []
  const projectWords = loadSourceWords(
    raw.map((w, i) => ({
      w: String(w.w ?? w.word ?? ''),
      s: Number(w.s ?? w.start ?? 0),
      e: Number(w.e ?? w.end ?? 0),
      i,
    })),
  )
  const scoped = wordsInRange(projectWords, clip.startMs, clip.endMs)
  const groups = findRetakes(
    scoped.map((w) => ({ w: w.w, s: w.s ?? 0, e: w.e ?? 0 })),
    [],
  )
  console.log(`\n=== ${clipId} project=${clip.project.id} (${groups.length} groups) ===`)
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!
    console.log(`group ${i + 1} cut=${JSON.stringify(retakeCutRange(g, []))}`)
    for (const a of g.attempts) {
      console.log(`  ${a.startMs}-${a.endMs} ${a.text.slice(0, 140)}`)
    }
  }
}

await prisma.$disconnect()
