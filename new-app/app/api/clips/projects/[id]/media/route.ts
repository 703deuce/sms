import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { attachImportUrlToClipProject, attachUploadToClipProject } from '@/lib/server/clips/projects'
import { serializeProject } from '@/lib/server/clips/serialize'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.union([
  z.object({ uploadId: z.string().min(1) }),
  z.object({ sourceUrl: z.string().min(8).max(2000) }),
])

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const project =
      'sourceUrl' in body
        ? await attachImportUrlToClipProject(workspaceId, projectId, body.sourceUrl)
        : await attachUploadToClipProject(workspaceId, projectId, body.uploadId)
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: serializeProject(project) })
  } catch (err) {
    return jsonError(err, 400)
  }
}
