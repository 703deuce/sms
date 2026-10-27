/**
 * Read-only prod timing report from clip_projects + clip_jobs + clips.
 * Requires DATABASE_URL. Parses worker [clipper:speed] lines from job payload when present.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/clipper-prod-speed-report.ts [--limit 40]
 */
import { PrismaClient } from "@prisma/client"

const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 40)

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL not set — run on a host with prod DB access.")
    process.exit(2)
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  const projects = await prisma.clipProject.findMany({
    where: {
      status: "READY",
      NOT: { settings: { path: ["streamer"], equals: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      updatedAt: true,
      rangeStartMs: true,
      rangeEndMs: true,
      createdAt: true,
      jobs: {
        where: { type: "PROCESS_PROJECT", status: "DONE" },
        orderBy: { finishedAt: "desc" },
        take: 1,
        select: { id: true, createdAt: true, finishedAt: true, payload: true },
      },
      clips: { orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } },
    },
  })

  const rows: Array<Record<string, unknown>> = []
  for (const p of projects) {
    const job = p.jobs[0]
    if (!job?.finishedAt || !job.createdAt) continue
    const spanMs = Math.max(1, (p.rangeEndMs ?? 0) - (p.rangeStartMs ?? 0))
    const spanMin = spanMs / 60_000
    if (spanMin > 10.5 || spanMin < 0.5) continue
    const wallMs = job.finishedAt.getTime() - job.createdAt.getTime()
    const firstClip = p.clips[0]
    const firstClipMs = firstClip
      ? firstClip.createdAt.getTime() - job.createdAt.getTime()
      : null
    const payload = (job.payload ?? {}) as Record<string, unknown>
    rows.push({
      projectId: p.id,
      sourceSpanMin: Math.round(spanMin * 10) / 10,
      wallSec: Math.round(wallMs / 1000),
      firstClipCardSec: firstClipMs != null ? Math.round(firstClipMs / 1000) : null,
      speedLog: payload.clipperSpeed ?? null,
    })
  }

  const med = (vals: number[]) => {
    if (!vals.length) return null
    const s = [...vals].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  }
  const wall = rows.map((r) => r.wallSec as number)
  const first = rows.filter((r) => r.firstClipCardSec != null).map((r) => r.firstClipCardSec as number)

  console.log(
    JSON.stringify(
      {
        sample: rows.length,
        medianWallSec: med(wall),
        medianFirstClipCardSec: med(first),
        rows,
      },
      null,
      2,
    ),
  )
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
