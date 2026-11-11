import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import {
  saveTemplateAuthoringState,
  TemplateAssetUnavailable,
  TemplateInstanceConflict,
  TemplateInstanceNotFound,
  type TemplateAuthoringState,
} from '@/lib/server/clips/real-video-template-instances'

const bodySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  choices: z.unknown(),
}).strict()

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id: clipId } = await ctx.params
    const body = bodySchema.parse(await request.json())
    const result = await saveTemplateAuthoringState(
      workspaceId,
      clipId,
      body.expectedVersion,
      body.choices as TemplateAuthoringState,
    )
    return NextResponse.json({ data: result })
  } catch (error) {
    if (error instanceof TemplateAssetUnavailable || error instanceof TemplateInstanceNotFound)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (error instanceof TemplateInstanceConflict)
      return NextResponse.json({ error: 'Template authoring conflict' }, { status: 409 })
    return jsonError(error, 400)
  }
}
