#!/usr/bin/env npx tsx
/** T4.1 export queue report for browser-test clips. */
import { getPrisma } from '../new-app/lib/server/db'

const CLIPS = [
  { label: 'A', id: 'clip_227bcc257bc9488a9fd3118baee57b19' },
  { label: 'B', id: 'clip_6e5be08c847b46e3b98d42190c9d6437' },
]

async function main() {
  const prisma = getPrisma()
  for (const { label, id } of CLIPS) {
    const renders = await prisma.clipRender.findMany({
      where: { clipId: id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    const clip = await prisma.clip.findUnique({ where: { id }, select: { edits: true } })
    const edits = (clip?.edits ?? {}) as Record<string, unknown>
    console.log(`\n=== Clip ${label} (${id}) ===`)
    console.log(
      `edits: speed=${edits.speed ?? 'none'} speechLeveling=${edits.speechLevelingEnabled === true} loudnessLufs=${edits.loudnessLufs ?? 'none'}`,
    )
    if (!renders.length) {
      console.log('No renders found')
      continue
    }
    for (const r of renders) {
      const ms =
        r.completedAt && r.createdAt
          ? r.completedAt.getTime() - r.createdAt.getTime()
          : null
      console.log(
        JSON.stringify({
          renderId: r.id,
          status: r.status,
          progress: r.progress,
          createdAt: r.createdAt.toISOString(),
          completedAt: r.completedAt?.toISOString() ?? null,
          durationMs: r.durationMs,
          elapsedMs: ms,
          meta: r.meta,
        }),
      )
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
