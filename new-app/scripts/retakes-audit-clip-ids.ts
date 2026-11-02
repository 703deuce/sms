import { PrismaClient } from '@prisma/client'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { findRetakes, retakeCutRange } from '@/lib/clips/editor/retakes'
import { loadSourceWords, wordsInRange } from '@/lib/clips/source-words'

const clipIds = process.argv.slice(2)
if (!clipIds.length) {
  console.error('usage: npx tsx scripts/retakes-audit-clip-ids.ts <clipId>...')
  process.exit(1)
}

function s3() {
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  })
}

async function loadProjectWords(transcriptKey: string) {
  const bucket = process.env.S3_BUCKET!
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: transcriptKey }))
  const body = await res.Body?.transformToString()
  const raw = JSON.parse(body || '[]') as Record<string, unknown>[]
  return loadSourceWords(
    raw.map((w, i) => ({
      w: String(w.w ?? w.word ?? ''),
      s: Number(w.s ?? w.start ?? 0),
      e: Number(w.e ?? w.end ?? 0),
      i,
    })),
  )
}

async function main() {
  const prisma = new PrismaClient()
  for (const clipId of clipIds) {
    const clip = await prisma.clip.findUnique({
      where: { id: clipId },
      include: { project: { select: { id: true, transcriptKey: true } } },
    })
    if (!clip?.project?.transcriptKey) {
      console.log(`\n=== ${clipId} ===\n(missing clip or transcriptKey)`)
      continue
    }
    const projectWords = await loadProjectWords(clip.project.transcriptKey)
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
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
