/**
 * Print findRetakes groups for specific clip IDs (read-only prod audit).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/retakes-audit-clips.ts clip_9e3f8c03... proj_ac6bbb1f...
 */
import { PrismaClient } from '@prisma/client'
import { findRetakes, retakeCutRange } from '../new-app/lib/clips/editor/retakes'
import { loadSourceWords, wordsInRange } from '../new-app/lib/clips/source-words'
import { getClipStorage } from '../new-app/lib/storage'

const clipIds = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!clipIds.length) {
  console.error('Usage: DATABASE_URL=... npx tsx scripts/retakes-audit-clips.ts <clipId> ...')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(2)
}

type RawWord = { w?: string; word?: string; s?: number; start?: number; e?: number; end?: number }

async function main() {
  const prisma = new PrismaClient()
  const storage = getClipStorage()
  for (const clipId of clipIds) {
    const clip = await prisma.clip.findUnique({
      where: { id: clipId },
      include: { project: { select: { id: true, wordsKey: true } } },
    })
    if (!clip?.project?.wordsKey) {
      console.log(`\n=== ${clipId} ===\n(missing clip or project wordsKey)`)
      continue
    }
    const raw = (await storage.getJson<RawWord[]>(clip.project.wordsKey)) ?? []
    const projectWords = loadSourceWords(
      raw.map((w, i) => ({
        w: String(w.w ?? w.word ?? ''),
        s: Number(w.s ?? w.start ?? 0),
        e: Number(w.e ?? w.end ?? 0),
        i,
      })),
    )
    const scoped = wordsInRange(projectWords, clip.startMs, clip.endMs)
    const retakeWords = scoped.map((w) => ({ w: w.w, s: w.s ?? 0, e: w.e ?? 0 }))
    const groups = findRetakes(retakeWords, [])
    console.log(`\n=== ${clipId} project=${clip.project.id} (${groups.length} groups) ===`)
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]!
      const cut = retakeCutRange(g, [])
      console.log(`group ${i + 1} cut=${JSON.stringify(cut)} keep=${g.keepIndex}`)
      for (let j = 0; j < g.attempts.length; j++) {
        const a = g.attempts[j]!
        console.log(`  [${j}] ${a.startMs}-${a.endMs} ${a.text.slice(0, 140)}`)
      }
    }
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
