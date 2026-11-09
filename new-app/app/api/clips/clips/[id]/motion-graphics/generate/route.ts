import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getClipEditorPayload } from '@/lib/server/clips/clip-detail'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { editorPreviewDurationMs } from '@/lib/clips/editor-preview-edits'
import { suggestTextMotionGraphics } from '@/lib/clips/motion-graphics/suggest'

const Input = z.object({
  style: z.enum(['minimal', 'narrative', 'gaming', 'tech']),
  instruction: z.string().max(1000).optional(),
}).strict()

/** Creates a REVIEWABLE plan; does not mutate the clip or bypass existing editor save CAS. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id: clipId } = await ctx.params
    const body = Input.parse(await request.json())
    const data = await getClipEditorPayload(workspaceId, clipId)
    if (!data) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    const words = data.words.map((w, index) => ({ ...w, i: w.i ?? w.idx ?? index }))
    const durationMs = editorPreviewDurationMs(data.edits, words)
    // Unsupported project aspect formats must not silently generate mispositioned overlays.
    const aspect = data.edits.aspectRatio ?? '9:16'
    if (!['9:16', '16:9', '1:1'].includes(aspect))
      return NextResponse.json({ error: 'Select 9:16, 16:9, or 1:1 first' }, { status: 422 })
    const result = await suggestTextMotionGraphics({
      edits: data.edits,
      words: data.words,
      durationMs,
      format: aspect as '9:16' | '16:9' | '1:1',
      style: body.style,
      instruction: body.instruction,
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
