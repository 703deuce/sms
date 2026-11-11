import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import {
  cancelTemplateProject,
  TemplateInstanceConflict,
  TemplateInstanceNotFound,
} from '@/lib/server/clips/real-video-template-instances'

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id: projectId } = await ctx.params
    await cancelTemplateProject(workspaceId, projectId)
    return NextResponse.json({ data: { canceled: true } })
  } catch (error) {
    if (error instanceof TemplateInstanceNotFound)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (error instanceof TemplateInstanceConflict)
      return NextResponse.json({ error: 'Template instance conflict' }, { status: 409 })
    return jsonError(error, 400)
  }
}
