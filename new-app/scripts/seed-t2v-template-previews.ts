/**
 * Upload short lavfi preview MP4s for system T2vTemplate rows.
 * Requires ffmpeg on PATH and clip storage env (same as app).
 * Run: npx tsx scripts/seed-t2v-template-previews.ts
 */
import { execSync } from 'child_process'
import { readFileSync, unlinkSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { getClipStorage } from '@/lib/storage'

const prisma = new PrismaClient()

const ASPECT_DIMS: Record<string, [number, number]> = {
  '16:9': [640, 360],
  '9:16': [360, 640],
  '1:1': [480, 480],
  '4:5': [480, 600],
}

function renderPreview(aspect: string, outPath: string) {
  const [w, h] = ASPECT_DIMS[aspect] ?? ASPECT_DIMS['16:9']
  execSync(
    `ffmpeg -y -v error -f lavfi -i color=c=0x1a1a2e:s=${w}x${h}:d=3 -f lavfi -i sine=f=440:d=3 ` +
      `-shortest -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 64k "${outPath}"`,
    { stdio: 'inherit' },
  )
}

async function main() {
  const rows = await prisma.t2vTemplate.findMany({
    where: { workspaceId: null, isPublished: true },
    select: { id: true, aspect: true, previewKey: true, thumbKey: true },
  })
  const storage = getClipStorage()
  const dir = mkdtempSync(join(tmpdir(), 't2v-tmpl-'))
  let n = 0
  for (const row of rows) {
    const previewKey = row.previewKey ?? `stock/t2v-templates/${row.id}-preview.mp4`
    const thumbKey = row.thumbKey ?? `stock/t2v-templates/${row.id}-thumb.jpg`
    const mp4 = join(dir, `${row.id}.mp4`)
    renderPreview(row.aspect, mp4)
    const body = readFileSync(mp4)
    await storage.putBytes(previewKey, body, 'video/mp4')
    execSync(`ffmpeg -y -v error -i "${mp4}" -vframes 1 -q:v 4 "${mp4}.jpg"`)
    await storage.putBytes(thumbKey, readFileSync(`${mp4}.jpg`), 'image/jpeg')
    unlinkSync(mp4)
    unlinkSync(`${mp4}.jpg`)
    await prisma.t2vTemplate.update({
      where: { id: row.id },
      data: { previewKey, thumbKey },
    })
    n++
  }
  console.log(`Seeded previews for ${n} templates`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
