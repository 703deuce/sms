import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { applyBrandTemplateToClipIds } from '@/lib/server/clips/apply-brand-template'
import { enqueueProjectExportAll } from '@/lib/server/clips/export-batch'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  clipIds: z.array(z.string().min(1)).min(1).max(20),
  action: z.enum(['apply-template', 'export']),
  templateId: z.string().optional(),
  projectId: z.string().optional(),
  aspect: z.enum(['9:16', '4:5', '1:1', '16:9']).optional(),
  resolution: z.enum(['720p', '1080p']).optional(),
})

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const prisma = getPrisma()

    if (body.action === 'apply-template') {
      if (!body.templateId) throw new Error('templateId required')
      const result = await applyBrandTemplateToClipIds(workspaceId, body.clipIds, body.templateId)
      return NextResponse.json({ data: result })
    }

    const clip = await prisma.clip.findFirst({
      where: { workspaceId, id: body.clipIds[0], deletedAt: null },
    })
    if (!clip) throw new Error('Clip not found')
    const projectId = body.projectId ?? clip.projectId
    const aspect = body.aspect ?? '9:16'
    const resolution = body.resolution ?? '1080p'
    const batch = await enqueueProjectExportAll(workspaceId, projectId, {
      clipIds: body.clipIds,
      aspect,
      resolution,
    })
    return NextResponse.json({ data: batch })
  } catch (err) {
    return jsonError(err, 400)
  }
}
