/**
 * Enqueue MUSIC jobs for T2V library catalog (§5.6). After worker completes, tracks get generationId via params.t2vCatalogId.
 * Run: npx tsx scripts/seed-t2v-music.ts
 */
import { PrismaClient } from '@prisma/client'
import { T2V_MUSIC_LIBRARY } from '../lib/t2v/music-library-catalog'
import { createId } from '../lib/supabase/id'

const prisma = new PrismaClient()

async function main() {
  const workspaceId = process.env.T2V_MUSIC_SEED_WORKSPACE_ID?.trim()
  if (!workspaceId) {
    console.error('Set T2V_MUSIC_SEED_WORKSPACE_ID to a workspace that can run MUSIC jobs')
    process.exit(1)
  }
  const project = await prisma.clipProject.findFirst({
    where: { workspaceId, sourceKind: 't2v' },
    select: { id: true },
  })
  if (!project) {
    console.error('No T2V project in workspace — create one first')
    process.exit(1)
  }

  let n = 0
  for (const track of T2V_MUSIC_LIBRARY) {
    const existing = await prisma.aiGeneration.findFirst({
      where: {
        workspaceId,
        kind: 'MUSIC',
        params: { path: ['t2vCatalogId'], equals: track.id },
      },
    })
    if (existing?.status === 'READY') continue

    const lengthMs = track.durationSec * 1000
    const prompt = `Instrumental ${track.mood.toLowerCase()} background music for a short video, no vocals`
    const gen = await prisma.aiGeneration.create({
      data: {
        workspaceId,
        kind: 'MUSIC',
        status: 'PENDING',
        provider: 'elevenlabs',
        prompt,
        params: { instrumental: true, lengthMs, t2vCatalogId: track.id, t2vLibrary: true },
      },
    })
    const jobId = createId('job')
    await prisma.clipJob.create({
      data: {
        id: jobId,
        projectId: project.id,
        type: 'MUSIC',
        status: 'QUEUED',
        payload: { generationId: gen.id, lengthMs, instrumental: true, prompt },
      },
    })
    n++
  }
  console.log(`Queued ${n} music library jobs`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
