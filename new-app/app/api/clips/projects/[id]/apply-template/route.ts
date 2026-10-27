import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { applyBrandTemplateToProject } from '@/lib/server/clips/apply-brand-template'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  templateId: z.string().min(1),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const result = await applyBrandTemplateToProject(workspaceId, projectId, body.templateId)
    return NextResponse.json({ data: result })
  } catch (err) {
    return jsonError(err, 400)
  }
}
