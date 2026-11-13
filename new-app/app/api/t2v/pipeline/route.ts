import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'
import { startT2vPipeline } from '@/lib/server/t2v/pipeline/t2v-orchestrator'
import { T2V_PIPELINE_DURATIONS } from '@/lib/t2v/pipeline/t2v-types'

const bodySchema = z.object({
  prompt: z.string().trim().min(8).max(4000),
  durationS: z
    .number()
    .int()
    .refine((n) => (T2V_PIPELINE_DURATIONS as readonly number[]).includes(n), 'unsupported_duration')
    .default(60),
  aspect: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
  style: z.enum(['documentary', 'educational', 'explainer', 'marketing', 'social']).default('documentary'),
  voiceId: z.string().max(64).optional(),
  captions: z.boolean().default(true),
  renderResolution: z.enum(['480p', '720p', '1080p']).default('720p'),
})

/** Prompt-to-Video: one click → script, scenes, verified stock, narration, edit, render. */
export async function POST(request: Request) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const data = await startT2vPipeline(workspaceId, {
      ...body,
      durationS: body.durationS as number,
    })
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 400)
  }
}
