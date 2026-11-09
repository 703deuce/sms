import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getClipEditorPayload } from '@/lib/server/clips/clip-detail'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { MotionPlanSchema } from '@/lib/clips/motion-graphics/contract'
import { reviseMotionPlan } from '@/lib/clips/motion-graphics/revise'
import { jsonError } from '@/lib/server/api-error'
import { recordOpenAiJsonUsage } from '@/lib/server/clips/ai-usage'
import { GPT_6_LUNA_MODEL_ID } from '@/lib/server/ai/gpt-6-luna-chat'

const Body = z.object({
  instruction: z.string().min(1).max(1000),
  plan: MotionPlanSchema,
}).strict()

/** Review only: returns a new validated plan, never writes edits or overwrites the timeline. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id } = await ctx.params
    const data = await getClipEditorPayload(workspaceId, id)
    if (!data) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    const body = Body.parse(await request.json())
    const result = await reviseMotionPlan(body.plan, body.instruction)
    await recordOpenAiJsonUsage({ workspaceId, clipId: id, model: GPT_6_LUNA_MODEL_ID,
      promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens })
    return NextResponse.json({ data: { plan: result.plan } })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid graphic revision' }, { status: 400 })
    return jsonError(new Error('motion_revision_failed'), 500)
  }
}
