import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { mergeEditsThreeWay } from '@/lib/clips/edits-merge'
import { getClipEditorPayload, mergeEditsPatch } from '@/lib/server/clips/clip-detail'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { enqueueReplaceClip } from '@/lib/server/clips/replace-clip'
import { recordStreamClipFeedback } from '@/lib/server/clips/stream-feedback'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  favorite: z.boolean().optional(),
  edits: z.record(z.unknown()).optional(),
  hidden: z.boolean().optional(),
  disliked: z.boolean().optional(),
  /** Optimistic concurrency — must match server editsSaveVersion from last successful save. */
  baseVersion: z.number().int().min(0).optional(),
  /** @deprecated use baseVersion */
  expectedUpdatedAt: z.string().min(8).optional(),
})

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const data = await getClipEditorPayload(workspaceId, id)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = patchSchema.parse(await request.json())
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const { normalizeEdits } = await import('@/lib/clips/edits')
    const serverEdits = normalizeEdits(clip.edits, bounds)
    const baseVersion =
      body.baseVersion ??
      (body.expectedUpdatedAt && clip.updatedAt.toISOString() === body.expectedUpdatedAt
        ? clip.editsSaveVersion
        : undefined)

    if (body.edits !== undefined && baseVersion === undefined) {
      /* legacy clients without version — still allow save */
    }

    const prisma = getPrisma()
    const nonEditData: Record<string, unknown> = {}
    if (body.title !== undefined) nonEditData.title = body.title
    if (body.favorite !== undefined) nonEditData.favorite = body.favorite
    if (body.hidden !== undefined || body.disliked !== undefined) {
      const prev = (clip.aiMeta && typeof clip.aiMeta === 'object' ? clip.aiMeta : {}) as Record<string, unknown>
      const meta = { ...prev }
      if (body.hidden !== undefined) meta.userHidden = body.hidden
      if (body.disliked !== undefined) {
        meta.userFeedback = body.disliked ? 'dislike' : null
      }
      nonEditData.aiMeta = meta
      console.info('[clipper:feedback]', {
        clipId: id,
        workspaceId,
        hidden: body.hidden ?? null,
        disliked: body.disliked ?? null,
      })
    }

    if (Object.keys(nonEditData).length) {
      await prisma.clip.update({ where: { id }, data: nonEditData })
    }

    if (body.edits !== undefined) {
      const mergedEdits = mergeEditsPatch(serverEdits, body.edits, bounds)
      const versionForCas = baseVersion ?? clip.editsSaveVersion
      const cas = await prisma.clip.updateMany({
        where: { id, editsSaveVersion: versionForCas },
        data: {
          edits: toPrismaJson(mergedEdits),
          editsSaveVersion: { increment: 1 },
        },
      })
      if (cas.count === 0) {
        const fresh = await prisma.clip.findUniqueOrThrow({ where: { id } })
        const freshEdits = normalizeEdits(fresh.edits, bounds)
        const clientFull = normalizeEdits(mergeEditsPatch(serverEdits, body.edits, bounds), bounds)
        const { merged, externalChange } = mergeEditsThreeWay(serverEdits, clientFull, freshEdits, bounds)
        console.info('[clipper:autosave] conflict_merge', {
          clipId: id,
          baseVersion: versionForCas,
          serverVersion: fresh.editsSaveVersion,
          externalChange,
        })
        return NextResponse.json(
          {
            error: externalChange
              ? 'Edits were updated elsewhere — merged latest changes.'
              : 'Save conflict — merged and retry.',
            code: 'EDITS_CONFLICT',
            data: {
              id: fresh.id,
              title: fresh.title,
              edits: merged,
              updatedAt: fresh.updatedAt.toISOString(),
              editsSaveVersion: fresh.editsSaveVersion,
              merged: true,
              externalChange,
            },
          },
          { status: 409 },
        )
      }
    }

    const updated = await prisma.clip.findUniqueOrThrow({ where: { id } })

    if (body.disliked === true) {
      await recordStreamClipFeedback(workspaceId, id, 'thumbs_down').catch(() => {})
    }

    if (body.hidden === true && body.disliked === true) {
      try {
        const enq = await enqueueReplaceClip(workspaceId, id)
        if (enq?.jobId) {
          console.info('[clipper:replace] queued from PATCH', { clipId: id, jobId: enq.jobId })
        }
      } catch (err) {
        console.error('[clipper:replace] enqueue failed', {
          clipId: id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return NextResponse.json({
      data: {
        id: updated.id,
        title: updated.title,
        edits: updated.edits,
        updatedAt: updated.updatedAt.toISOString(),
        editsSaveVersion: updated.editsSaveVersion,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
