import { NextResponse } from 'next/server'
import { z } from 'zod'
import { costOf } from '@/lib/billing/entitlements'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { jsonError } from '@/lib/server/api-error'

const schema = z.object({
  durationMs: z.number().int().min(0),
  rangeStartMs: z.number().int().min(0),
  rangeEndMs: z.number().int().min(0),
  settings: z.unknown().optional(),
})

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = schema.parse(await request.json())
    const rangeMs = Math.max(0, (body.rangeEndMs || body.durationMs) - body.rangeStartMs)
    const minutes = Math.max(1, Math.ceil(rangeMs / 60_000))
    const credits = minutes * costOf(workspaceId, 'process_minute')
    return NextResponse.json({ data: { credits, providerCostUsd: minutes * 0.004 } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
