import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { applyCompositionOpBatch } from '@/lib/server/clips/script-composition'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const opSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delete_words'), wordIds: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('restore_words'), wordIds: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('add_split'), outMs: z.number().min(0) }),
  z.object({ type: z.literal('insert_gap'), atOutMs: z.number().min(0), durMs: z.number().min(1) }),
  z.object({ type: z.literal('remove_gap_at'), atOutMs: z.number().min(0) }),
  z.object({
    type: z.literal('replace_with_gap'),
    wordIds: z.array(z.string().min(1)).min(1),
    atOutMs: z.number().min(0),
    durMs: z.number().min(1),
  }),
  z.object({ type: z.literal('set_pad_before'), wordId: z.string().min(1), padMs: z.number().min(0) }),
])

const bodySchema = z.object({
  baseRevision: z.number().int().min(0),
  ops: z
    .array(
      z.object({
        id: z.string().min(8).max(64),
        op: opSchema,
      }),
    )
    .min(1)
    .max(50),
})

export async function POST(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const json = await request.json()
    const body = bodySchema.parse(json)
    const result = await applyCompositionOpBatch(workspaceId, compositionId, body)
    if (!result.ok) {
      if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (result.code === 'STALE_REVISION') {
        return NextResponse.json({ error: 'Stale revision', revision: result.revision }, { status: 409 })
      }
      return NextResponse.json({ error: 'Invalid' }, { status: 400 })
    }
    return NextResponse.json({
      data: {
        revision: result.revision,
        document: result.document,
        ackedOpIds: result.ackedOpIds,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
