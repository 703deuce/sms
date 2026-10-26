import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { enqueueProjectExportAll } from '@/lib/server/clips/export-batch'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import archiver from 'archiver'

const postSchema = z.object({
  clipIds: z.array(z.string().min(1)).max(10).optional(),
  aspect: z.enum(['9:16', '1:1', '16:9']),
  resolution: z.enum(['720p', '1080p']).default('720p'),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = postSchema.parse(await request.json())
    const data = await enqueueProjectExportAll(workspaceId, projectId, body)
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const batchId = new URL(request.url).searchParams.get('batchId')
    if (!batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 })

    const prisma = getPrisma()
    const rows = await prisma.clipRender.findMany({
      where: { workspaceId, batchId, status: 'READY', clip: { projectId } },
      include: { clip: { select: { title: true } } },
    })
    const ready = rows.filter((r) => r.outputKey)
    if (!ready.length) {
      return NextResponse.json({ error: 'No ready exports in this batch yet' }, { status: 409 })
    }

    const storage = getClipStorage()
    const archive = archiver('zip', { store: true })
    const chunks: Buffer[] = []
    archive.on('data', (c: Buffer) => chunks.push(c))
    const done = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
    })

    for (const r of ready) {
      const url = await storage.createSignedDownloadUrl(r.outputKey!, 600)
      const res = await fetch(url)
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      const name = r.filename || `${r.clip.title.replace(/[^\w\s-]+/g, '').trim() || 'clip'}.mp4`
      archive.append(buf, { name })
    }
    await archive.finalize()
    const zip = await done

    return new NextResponse(zip, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="clips-${batchId}.zip"`,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
