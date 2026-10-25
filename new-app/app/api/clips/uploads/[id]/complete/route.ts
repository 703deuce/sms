import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { completeClipUpload } from '@/lib/server/clips/uploads'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  parts: z
    .array(z.object({ partNumber: z.number().int().min(1), etag: z.string().min(1) }))
    .optional(),
  durationMs: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const row = await completeClipUpload(workspaceId, id, body.parts, body)
    return NextResponse.json({ data: { id: row.id } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
