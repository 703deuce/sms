import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { TemplateInstanceConflict, TemplateInstanceNotFound } from '@/lib/server/clips/real-video-template-instances'
import { getVideoTemplateDraft, saveVideoTemplateDraft, discardVideoTemplateDraft } from '@/lib/server/clips/video-template-studio-projects'

const saveSchema = z.object({ expectedVersion: z.number().int().nonnegative(), draft: z.unknown() }).strict()
type Ctx = { params: Promise<{ id: string }> }
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const state = await getVideoTemplateDraft(workspaceId, (await ctx.params).id)
    if (!state) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: state })
  } catch (e) { return jsonError(e, 500) }
}
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = saveSchema.parse(await req.json())
    return NextResponse.json({ data: await saveVideoTemplateDraft(workspaceId, (await ctx.params).id,
      body.expectedVersion, body.draft) })
  } catch (e) {
    if (e instanceof TemplateInstanceNotFound) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (e instanceof TemplateInstanceConflict) return NextResponse.json({ error: 'Draft conflict. Reload before saving.' }, { status: 409 })
    return jsonError(e, 400)
  }
}
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await discardVideoTemplateDraft(await resolveWorkspaceId(), (await ctx.params).id)
    return NextResponse.json({ data: { discarded: true } })
  } catch (e) {
    if (e instanceof TemplateInstanceNotFound) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (e instanceof TemplateInstanceConflict) return NextResponse.json({ error: 'Published projects cannot be discarded as drafts' }, { status: 409 })
    return jsonError(e, 400)
  }
}
