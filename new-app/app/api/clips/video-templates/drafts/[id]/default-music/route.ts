import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { TemplateInstanceConflict, TemplateInstanceNotFound } from '@/lib/server/clips/real-video-template-instances'
import { provisionVideoTemplateDefaultMusic } from '@/lib/server/clips/video-template-studio-projects'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const data = await provisionVideoTemplateDefaultMusic(workspaceId, (await ctx.params).id)
    return NextResponse.json({ data })
  } catch (e) {
    if (e instanceof TemplateInstanceNotFound) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (e instanceof TemplateInstanceConflict) return NextResponse.json({ error: 'Draft conflict. Reload before saving.' }, { status: 409 })
    return jsonError(e, 400)
  }
}
