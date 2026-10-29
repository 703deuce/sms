#!/usr/bin/env npx tsx
/**
 * Audit clip edits JSON for speech leveling state (T4.1 report).
 * Usage: DATABASE_URL=... npx tsx scripts/t41-leveling-audit.ts
 */
import { getPrisma } from '../new-app/lib/server/db'

async function main() {
  const prisma = getPrisma()
  const clips = await prisma.clip.findMany({
    select: { id: true, edits: true },
    take: 50_000,
  })
  let legacyLufs = 0
  let explicitOn = 0
  let explicitOffWithLufs = 0
  for (const c of clips) {
    const edits = (c.edits ?? {}) as Record<string, unknown>
    if (edits.speechLevelingEnabled === true) explicitOn += 1
    if (edits.loudnessLufs != null && edits.speechLevelingEnabled !== true) {
      legacyLufs += 1
      if (edits.loudnessLufs === -14) explicitOffWithLufs += 1
    }
  }
  console.log(
    JSON.stringify(
      {
        totalClips: clips.length,
        speechLevelingEnabledTrue: explicitOn,
        loudnessWithoutOptIn: legacyLufs,
        loudnessMinus14WithoutOptIn: explicitOffWithLufs,
        note: 'Legacy loudness without speechLevelingEnabled is ignored for export/UI after T4.1',
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
