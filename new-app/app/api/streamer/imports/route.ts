import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { createStreamerImport } from '@/lib/server/streamer/imports'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  url: z.string().min(8).max(2000).optional(),
  uploadId: z.string().optional(),
  rangeStartMs: z.number().int().min(0).optional(),
  rangeEndMs: z.number().int().min(0).optional(),
  settings: z.unknown().optional(),
  attest: z.boolean(),
})

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    if (!body.url && !body.uploadId) {
      return NextResponse.json({ error: 'url or uploadId required' }, { status: 400 })
    }
    const data = await createStreamerImport(workspaceId, body)
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 400)
  }
}
