/**
 * Read-only audit: last N READY talking projects — clip boundaries vs transcript words.
 * Flags likely mid-sentence ends and long leading silence inside clip span.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/clipper-prod-boundary-audit.ts [--limit 30]
 */
import { PrismaClient } from "@prisma/client"
import { getClipStorage } from "../new-app/lib/storage"

const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 30)
const GAP_SENTENCE_END_S = 0.4
const LEADING_DEAD_AIR_S = 0.55

type Word = { w: string; s: number; e: number }

function wordAtEnd(words: Word[], endMs: number): Word | null {
  const t = endMs / 1000
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i].s <= t) return words[i]
  }
  return words[0] ?? null
}

function wordAtStart(words: Word[], startMs: number): Word | null {
  const t = startMs / 1000
  for (const w of words) {
    if (w.e >= t) return w
  }
  return words[words.length - 1] ?? null
}

function isSentenceFinal(w: Word, words: Word[], idx: number): boolean {
  const raw = w.w.trim()
  if (/[.?!]$/.test(raw)) return true
  const next = words[idx + 1]
  if (next && next.s - w.e >= GAP_SENTENCE_END_S) return true
  return idx === words.length - 1
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set")
    process.exit(2)
  }
  const prisma = new PrismaClient()
  const storage = getClipStorage()
  const projects = await prisma.clipProject.findMany({
    where: { status: "READY", NOT: { settings: { path: ["streamer"], equals: true } } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      clips: { take: 8, orderBy: { score: "desc" } },
    },
  })

  const issues: Array<Record<string, unknown>> = []
  for (const p of projects) {
    for (const c of p.clips) {
      if (!c.wordsKey) continue
      let words: Word[]
      try {
        words = (await storage.getJson<Word[]>(c.wordsKey)) as Word[]
      } catch {
        continue
      }
      if (!words?.length) continue
      const clipDurMs = c.endMs - c.startMs
      const endW = wordAtEnd(words, clipDurMs)
      if (!endW) continue
      const endIdx = words.indexOf(endW)
      if (!isSentenceFinal(endW, words, endIdx)) {
        issues.push({
          kind: "mid_sentence_end",
          projectId: p.id,
          clipId: c.id,
          title: c.title,
          lastWord: endW.w,
        })
      }
      const first = words[0]
      if (first && first.s >= LEADING_DEAD_AIR_S) {
        issues.push({
          kind: "leading_dead_air",
          projectId: p.id,
          clipId: c.id,
          title: c.title,
          gapSec: Math.round(first.s * 100) / 100,
        })
      }
    }
  }

  console.log(JSON.stringify({ projectsScanned: projects.length, issueCount: issues.length, issues }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
