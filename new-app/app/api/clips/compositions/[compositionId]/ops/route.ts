import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import {
  applyCompositionOpBatch,
  listCompositionOpsSince,
  type OpBatchInput,
} from '@/lib/server/clips/script-composition'
import type { ScriptCompositionOp } from '@/lib/clips/script-edl/ops'
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
  z.object({
    type: z.literal('patch_settings'),
    patch: z.record(z.string(), z.unknown()),
  }),
  z.object({ type: z.literal('ignore_words'), wordIds: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('restore_ignored'), wordIds: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('hide_transcript_words'), wordIds: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('show_transcript_words'), wordIds: z.array(z.string().min(1)).min(1) }),
  z.object({
    type: z.literal('shorten_gap_before'),
    wordId: z.string().min(1),
    prevWordId: z.string().min(1),
    gapMs: z.number().min(0),
    targetGapMs: z.number().min(0),
  }),
  z.object({
    type: z.literal('shorten_gaps_batch'),
    items: z
      .array(
        z.object({
          wordId: z.string().min(1),
          prevWordId: z.string().min(1),
          gapMs: z.number().min(0),
          targetGapMs: z.number().min(0),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal('set_reframe_keyframe'),
    srcMs: z.number().min(0),
    crop: z.object({
      cx: z.number(),
      cy: z.number(),
      w: z.number().min(1),
      h: z.number().min(1),
    }),
  }),
  z.object({
    type: z.literal('word_batch_action'),
    action: z.enum(['delete', 'ignore', 'replace_with_gap', 'hide_transcript']),
    wordIds: z.array(z.string().min(1)).min(1),
    gapAtOutMs: z.record(z.string(), z.number()).optional(),
    gapDurMs: z.number().min(1).optional(),
  }),
  z.object({
    type: z.literal('patch_word_source_adjust'),
    wordSourceAdjust: z
      .record(
        z.string(),
        z.object({
          headTrimMs: z.number().min(0).optional(),
          tailTrimMs: z.number().min(0).optional(),
        }),
      )
      .optional(),
  }),
  z.object({
    type: z.literal('include_context_words'),
    wordIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal('patch_reframe_keyframes'),
    reframeKeyframes: z
      .array(
        z.object({
          srcMs: z.number().min(0),
          crop: z.object({
            cx: z.number(),
            cy: z.number(),
            w: z.number().min(1),
            h: z.number().min(1),
          }),
        }),
      )
      .optional(),
  }),
  z.object({
    type: z.literal('add_scene_at_word'),
    wordId: z.string().min(1),
    sceneId: z.string().min(8).optional(),
    label: z.string().max(120).optional(),
  }),
  z.object({ type: z.literal('remove_scene'), sceneId: z.string().min(8) }),
  z.object({
    type: z.literal('reorder_scenes'),
    sceneIds: z.array(z.string().min(8)).min(1),
  }),
  z.object({
    type: z.literal('patch_broll'),
    broll: z.array(
      z.union([
        z.object({
          id: z.string().min(1),
          source: z.literal('stock'),
          assetId: z.string().min(1),
          startMs: z.number().min(0),
          endMs: z.number().min(0),
          placement: z.enum(['auto', 'manual']).optional(),
        }),
        z.object({
          id: z.string().min(1),
          source: z.literal('ai'),
          generationId: z.string().min(1),
          startMs: z.number().min(0),
          endMs: z.number().min(0),
          placement: z.enum(['auto', 'manual']).optional(),
        }),
      ]),
    ),
  }),
  z.object({ type: z.literal('patch_audio'), audio: z.record(z.string(), z.unknown()).nullable() }),
  z.object({
    type: z.literal('add_marker'),
    id: z.string().min(1).optional(),
    outMs: z.number().min(0),
    label: z.string().max(200).optional(),
    exportAsChapter: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('update_marker'),
    id: z.string().min(1),
    patch: z.object({
      label: z.string().max(200).optional(),
      outMs: z.number().min(0).optional(),
      exportAsChapter: z.boolean().optional(),
    }),
  }),
  z.object({ type: z.literal('delete_marker'), id: z.string().min(1) }),
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

export async function GET(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    const sinceRevision = Number(url.searchParams.get('sinceRevision') ?? '0')
    if (!Number.isFinite(sinceRevision) || sinceRevision < 0) {
      return NextResponse.json({ error: 'Invalid sinceRevision' }, { status: 400 })
    }
    const rows = await listCompositionOpsSince(workspaceId, compositionId, sinceRevision)
    if (rows === null) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: rows })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const json = await request.json()
    const body = bodySchema.parse(json)
    const batch: OpBatchInput = {
      baseRevision: body.baseRevision,
      ops: body.ops.map((item) => ({
        id: item.id,
        op: item.op as ScriptCompositionOp,
      })),
    }
    const result = await applyCompositionOpBatch(workspaceId, compositionId, batch)
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
