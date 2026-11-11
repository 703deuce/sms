import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { jsonError } from '@/lib/server/api-error'
import { TemplateInstanceNotFound } from '@/lib/server/clips/real-video-template-instances'
const schema = z.object({
  releaseId: z.string().min(1).max(80),
  idempotencyKey: z.string().min(8).max(120),
}).strict()
export async function POST(req: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = schema.parse(await req.json())
    const { createVideoTemplateDraft: create } = await import('@/lib/server/clips/video-template-studio-projects')
    return NextResponse.json({ data: await create(workspaceId, body.releaseId, body.idempotencyKey) }, { status: 201 })
  } catch (error) {
    if (error instanceof TemplateInstanceNotFound) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return jsonError(error, 400)
  }
}
