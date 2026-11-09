import { NextResponse } from 'next/server'
import { z } from 'zod'
import { MotionModeSchema } from '@/lib/clips/motion-graphics/contract'
import { jsonError } from '@/lib/server/api-error'
import { reserveMotionRequest } from '@/lib/server/clips/motion-request-limit'
import { recordOpenAiJsonUsage } from '@/lib/server/clips/ai-usage'
import { GPT_6_LUNA_MODEL_ID } from '@/lib/server/ai/gpt-6-luna-chat'
import { getClipEditorPayload } from '@/lib/server/clips/clip-detail'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getMotionStyle } from '@/lib/server/clips/motion-styles'
import { editorPreviewDurationMs } from '@/lib/clips/editor-preview-edits'
import type { ClipWord } from '@/lib/clips/edits'
import { suggestTextMotionGraphics } from '@/lib/clips/motion-graphics/suggest'

const Input = z.object({
  style: z.enum(['minimal', 'narrative', 'gaming', 'tech']),
  instruction: z.string().max(1000).optional(),
  profileId: z.string().min(1).max(128).optional(),
  mode: MotionModeSchema.optional(),
  rangeMs: z.tuple([z.number().int().min(0), z.number().int().positive()]).optional(),
}).strict()

/** Creates a REVIEWABLE plan; does not mutate the clip or bypass existing editor save CAS. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id: clipId } = await ctx.params
    const body = Input.parse(await request.json())
    const profile = body.profileId ? await getMotionStyle(workspaceId, body.profileId) : null
    if (body.profileId && !profile) return NextResponse.json({ error: 'Style profile not found' }, { status: 404 })
    const data = await getClipEditorPayload(workspaceId, clipId)
    if (!data) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    const words = data.words.map((w: ClipWord, index: number) => ({ ...w, i: w.i ?? w.idx ?? index }))
    const durationMs = editorPreviewDurationMs(data.edits, words)
    // Unsupported project aspect formats must not silently generate mispositioned overlays.
    const aspect = data.edits.aspectRatio ?? '9:16'
    if (!['9:16', '16:9', '1:1'].includes(aspect))
      return NextResponse.json({ error: 'Select 9:16, 16:9, or 1:1 first' }, { status: 422 })
    const budget = await reserveMotionRequest(workspaceId, 'generate')
    if (!budget.ok) return NextResponse.json({ error: 'motion_hourly_limit', retryAfterSec: budget.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(budget.retryAfterSec) } })
    if (durationMs > 600000 && !body.rangeMs)
      return NextResponse.json({ error: 'motion_generation_requires_window_for_long_clip' }, { status: 422 })
    const result = await suggestTextMotionGraphics({
      edits: data.edits,
      words: data.words,
      durationMs,
      rangeMs: body.rangeMs,
      format: aspect as '9:16' | '16:9' | '1:1',
      style: body.style,
      profile,
      mode: body.mode,
      instruction: body.instruction,
    })
    await recordOpenAiJsonUsage({ workspaceId, clipId,
      model: GPT_6_LUNA_MODEL_ID,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
    })
    return NextResponse.json({
      data: {
        plan: result.plan, evidenceCount: result.evidenceCount,
        usage: result.usage, basedOnEditsSaveVersion: data.clip.editsSaveVersion,
      },
    })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid motion request' }, { status: 400 })
    // Return an actionable bounded error, without transcript/remote-model response bodies.
    const message = (err as Error)?.message ?? 'Motion planning failed'
    const publicCode = /^(motion_|OPENAI_API_KEY)/.test(message) ? message.slice(0, 250) : 'motion_planning_failed'
    if (/motion_generation_requires_transcript|motion_generation_evidence_incomplete|motion_generation_duration_out_of_range/.test(publicCode))
      return NextResponse.json({ error: publicCode }, { status: 422 })
    if (publicCode === 'OPENAI_API_KEY is not configured')
      return NextResponse.json({ error: 'motion_model_unavailable' }, { status: 503 })
    return jsonError(new Error('motion_planning_failed'), 500)
  }
}
