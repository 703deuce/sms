/**
 * Read-only report of clips likely repaired by #929 on-open snap.
 * Run: cd new-app && node scripts/report-sentence-snap-repair-clips.mjs [sinceIso]
 */
import { PrismaClient } from '@prisma/client'

const sinceIso = process.argv[2] ?? '2026-11-02T00:30:00.000Z'
const since = new Date(sinceIso)
const prisma = new PrismaClient()

function trimIn(edits) {
  const t = edits?.trim
  if (t && typeof t === 'object' && typeof t.in === 'number') return t.in
  return 0
}

async function main() {
  const rows = await prisma.clip.findMany({
    where: { deletedAt: null, updatedAt: { gte: since } },
    select: { id: true, startMs: true, endMs: true, edits: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
  })
  const out = []
  for (const row of rows) {
    const edits = row.edits && typeof row.edits === 'object' && !Array.isArray(row.edits) ? row.edits : {}
    const ti = trimIn(edits)
    const shifted =
      row.startMs !== 0 ||
      (ti > 0 && ti !== row.startMs && Math.abs(ti - row.startMs) > 40) ||
      (ti >= 400 && row.startMs < ti - 400)
    if (!shifted) continue
    out.push({ id: row.id, startMs: row.startMs, endMs: row.endMs, trimIn: ti, updatedAt: row.updatedAt.toISOString() })
  }
  console.log(JSON.stringify({ sinceIso, count: out.length, clipIds: out.map((r) => r.id), rows: out }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
