import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const MAX_BYTES = 80 * 1024 * 1024

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const kind = new URL(request.url).searchParams.get('kind')
    if (kind !== 'intro' && kind !== 'outro') {
      return NextResponse.json({ error: 'kind=intro|outro required' }, { status: 400 })
    }
    const prisma = getPrisma()
    const tpl = await prisma.clipBrandTemplate.findFirst({ where: { id, workspaceId } })
    if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Max 80MB' }, { status: 400 })

    const storage = getClipStorage()
    const key = `brand/${workspaceId}/templates/${id}/${kind}.mp4`
    const buf = Buffer.from(await file.arrayBuffer())
    await storage.putBytes(key, buf, file.type || 'video/mp4')

    const data =
      kind === 'intro'
        ? { introVideoKey: key }
        : { outroVideoKey: key }
    const updated = await prisma.clipBrandTemplate.update({ where: { id }, data })
    return NextResponse.json({ data: { template: updated, key } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
