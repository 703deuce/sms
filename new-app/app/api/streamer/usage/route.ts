import { NextResponse } from 'next/server'
import { z } from 'zod'

import { jsonError } from '@/lib/server/api-error'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { mergeStreamerLimits } from '@/lib/server/streamer/limits'
import { getStreamUsage } from '@/lib/server/streamer/usage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    return NextResponse.json({ data: await getStreamUsage(workspaceId) })
  } catch (err) {
    return jsonError(err, 400)
  }
}

const patchSchema = z.object({
  monthlyHours: z.number().min(0).nullable().optional(),
  priority: z.number().int().min(-10).max(10).optional(),
})

export async function PATCH(request: Request) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = patchSchema.parse(await request.json())
    const limits = await mergeStreamerLimits(workspaceId, body)
    const usage = await getStreamUsage(workspaceId)
    return NextResponse.json({ limits, usage })
  } catch (err) {
    return jsonError(err, 400)
  }
}
