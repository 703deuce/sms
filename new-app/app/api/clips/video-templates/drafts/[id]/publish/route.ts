import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { jsonError } from '@/lib/server/api-error'
import { TemplateInstanceConflict, TemplateInstanceNotFound, TemplateAssetUnavailable } from '@/lib/server/clips/real-video-template-instances'
import { publishVideoTemplateDraft } from '@/lib/server/clips/video-template-studio-projects'
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ data: await publishVideoTemplateDraft(
      await resolveWorkspaceId(), (await ctx.params).id) }, { status: 201 })
  } catch (error) {
    if (error instanceof TemplateInstanceNotFound || error instanceof TemplateAssetUnavailable)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (error instanceof TemplateInstanceConflict)
      return NextResponse.json({ error: 'Template publish conflict' }, { status: 409 })
    return jsonError(error, 400)
  }
}
