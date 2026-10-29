import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { mergeEditsThreeWay } from '@/lib/clips/edits-merge'
import { insertOriginalClipEditSnapshot } from '@/lib/server/clips/clip-edit-versions'
import { getClipEditorPayload, mergeEditsPatch } from '@/lib/server/clips/clip-detail'
import { clipBoundsForPatch } from '@/lib/server/clips/clip-patch-bounds'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { enqueueReplaceClip } from '@/lib/server/clips/replace-clip'
import { recordStreamClipFeedback } from '@/lib/server/clips/stream-feedback'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import type { ClipEditsV2 } from '@/lib/clips/edits'

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  favorite: z.boolean().optional(),
  edits: z.record(z.unknown()).optional(),
  hidden: z.boolean().optional(),
  disliked: z.boolean().optional(),
  baseVersion: z.number().int().min(0).optional(),
  expectedUpdatedAt: z.string().min(8).optional(),
})

type PatchRow = {
  id: string
  title: string
  updatedAt: Date
  editsSaveVersion: number
}

async function casUpdateEdits(
  prisma: ReturnType<typeof getPrisma>,
  id: string,
  mergedEdits: ClipEditsV2,
  versionForCas: number,
): Promise<{ ok: true; row: PatchRow } | { ok: false; conflict: boolean }> {
  try {
    const rows = await prisma.$queryRaw<PatchRow[]>(
      Prisma.sql`
        UPDATE clips SET
          edits = ${JSON.stringify(mergedEdits)}::jsonb,
          "editsSaveVersion" = "editsSaveVersion" + 1,
          "updatedAt" = NOW()
        WHERE id = ${id} AND "editsSaveVersion" = ${versionForCas}
        RETURNING id, title, "updatedAt", "editsSaveVersion"
      `,
    )
    if (rows.length > 0) {
      return { ok: true, row: rows[0]! }
    }
    return { ok: false, conflict: true }
  } catch (err) {
    console.warn(
      '[clipper:patch] raw_update_fail',
      err instanceof Error ? err.message : String(err),
    )
    const cas = await prisma.clip.updateMany({
      where: { id, editsSaveVersion: versionForCas },
      data: {
        edits: toPrismaJson(mergedEdits),
        editsSaveVersion: { increment: 1 },
      },
    })
    if (cas.count === 0) {
      return { ok: false, conflict: true }
    }
    const row = await prisma.clip.findUniqueOrThrow({
      where: { id },
      select: { id: true, title: true, updatedAt: true, editsSaveVersion: true },
    })
    return { ok: true, row }
  }
}

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
  const patchStartedAt = Date.now()
  let patchClipId: string | null = null
  let stageLog: Record<string, number | null> = {
    ws: null,
    load: null,
    write: null,
    cas: null,
    orig: null,
  }
  try {
    const { id } = await ctx.params
    patchClipId = id
    const ws0 = Date.now()
    const workspaceId = await resolveWorkspaceId()
    stageLog.ws = Date.now() - ws0
    const load0 = Date.now()
    const clip = await getClipForWorkspace(workspaceId, id)
    stageLog.load = Date.now() - load0
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = patchSchema.parse(await request.json())
    const bounds = await clipBoundsForPatch(clip)
    const { normalizeEdits } = await import('@/lib/clips/edits')
    const serverEdits = normalizeEdits(clip.edits, bounds)
    const baseVersion =
      body.baseVersion ??
      (body.expectedUpdatedAt && clip.updatedAt.toISOString() === body.expectedUpdatedAt
        ? clip.editsSaveVersion
        : undefined)

    const prisma = getPrisma()
    const nonEditData: Record<string, unknown> = {}
    if (body.title !== undefined) nonEditData.title = body.title
    if (body.favorite !== undefined) nonEditData.favorite = body.favorite
    if (body.hidden !== undefined || body.disliked !== undefined) {
      const prev = (clip.aiMeta && typeof clip.aiMeta === 'object' ? clip.aiMeta : {}) as Record<
        string,
        unknown
      >
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

    let editsResponse: {
      id: string
      title: string
      edits: unknown
      updatedAt: string
      editsSaveVersion: number
    } | null = null

    if (body.edits !== undefined) {
      const mergedEdits = mergeEditsPatch(serverEdits, body.edits, bounds)
      const versionForCas = baseVersion ?? clip.editsSaveVersion
      if (clip.editsSaveVersion === 0) {
        const orig0 = Date.now()
        await insertOriginalClipEditSnapshot(prisma, clip)
        stageLog.orig = Date.now() - orig0
      }
      const write0 = Date.now()
      const result = await casUpdateEdits(prisma, id, mergedEdits, versionForCas)
      stageLog.write = Date.now() - write0
      stageLog.cas = result.ok ? 1 : 0
      if (!result.ok && result.conflict) {
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
      if (result.ok) {
        editsResponse = {
          id: result.row.id,
          title: result.row.title,
          edits: mergedEdits,
          updatedAt: result.row.updatedAt.toISOString(),
          editsSaveVersion: result.row.editsSaveVersion,
        }
      }
    }

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

    if (editsResponse) {
      return NextResponse.json({ data: editsResponse })
    }

    const updated = await prisma.clip.findUniqueOrThrow({ where: { id } })
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
  } finally {
    if (patchClipId) {
      console.info('[clipper:patch] ms', {
        clipId: patchClipId,
        total: Date.now() - patchStartedAt,
        ws: stageLog.ws,
        load: stageLog.load,
        write: stageLog.write,
        cas: stageLog.cas,
        orig: stageLog.orig,
      })
    }
  }
}
