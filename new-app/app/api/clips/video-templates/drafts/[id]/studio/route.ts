import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { TemplateInstanceConflict, TemplateInstanceNotFound } from '@/lib/server/clips/real-video-template-instances'
import { savePublishedStudioDraft } from '@/lib/server/clips/video-template-studio-projects'
const schema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  expectedEditsSaveVersion: z.number().int().nonnegative(),
  draft: z.unknown(),
}).strict()
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const body = schema.parse(await req.json())
    return NextResponse.json({ data: await savePublishedStudioDraft(
      await resolveWorkspaceId(), (await ctx.params).id,
      body.expectedVersion, body.expectedEditsSaveVersion, body.draft,
    ) })
  } catch (e) {
    if (e instanceof TemplateInstanceNotFound) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (e instanceof TemplateInstanceConflict) return NextResponse.json({
      error: 'Changes conflict with another save or an editor update. Reload; no edits were overwritten.',
    }, { status: 409 })
    return jsonError(e, 400)
  }
}
