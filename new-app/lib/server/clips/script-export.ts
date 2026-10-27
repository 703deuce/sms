import { clipEditsFromComposition } from '@/lib/clips/composition-to-edits'
import { normalizeEdits } from '@/lib/clips/edits'
import { normalizeTranscriptJson } from '@/lib/server/clips/editor-words'
import { enqueueRenderClip } from '@/lib/server/clips/renders'
import { getCompositionForWorkspace } from '@/lib/server/clips/script-composition'
import { toEditorWords, resolveSourceMediaId } from '@/lib/clips/script-editor/to-editor-words'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'
import type { ExportAspect, ExportResolution } from '@/lib/clips/export-aspect'

const EXPORT_CLIP_TITLE = '__script_full_export__'

function parseDocument(raw: unknown): ScriptDocumentV1 {
  if (!raw || typeof raw !== 'object') return { v: 1, keptWordIds: [], deletedWordIds: [] }
  const d = raw as ScriptDocumentV1
  return {
    v: 1,
    keptWordIds: Array.isArray(d.keptWordIds) ? d.keptWordIds.map(String) : [],
    deletedWordIds: Array.isArray(d.deletedWordIds) ? d.deletedWordIds.map(String) : [],
    wordOrder: Array.isArray(d.wordOrder) ? d.wordOrder.map(String) : undefined,
  }
}

async function loadTranscript(project: { transcriptKey: string | null; transcriptWords: unknown }) {
  const driverHint = null
  const storage = project.transcriptKey
    ? await getClipStorageForObjectKey(project.transcriptKey, driverHint)
    : getClipStorage(driverHint)
  if (project.transcriptKey) {
    try {
      const raw = await storage.getJson<unknown>(project.transcriptKey)
      const normalized = normalizeTranscriptJson(raw)
      if (normalized.length) return normalized
    } catch {
      /* fall through */
    }
  }
  if (Array.isArray(project.transcriptWords)) return normalizeTranscriptJson(project.transcriptWords)
  return []
}

export async function enqueueScriptCompositionExport(
  workspaceId: string,
  compositionId: string,
  opts: { resolution?: ExportResolution; aspect?: ExportAspect; watermark?: boolean },
) {
  const prisma = getPrisma()
  const composition = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!composition || composition.kind !== 'FULL') return null

  const project = await prisma.clipProject.findFirst({
    where: { id: composition.projectId, workspaceId },
    include: { upload: true },
  })
  if (!project) return null

  const words = await loadTranscript(project)
  const sourceMediaId = resolveSourceMediaId(project)
  const editorWords = toEditorWords(sourceMediaId, words)
  const wordsById = new Map(editorWords.map((w) => [w.id, w]))
  const document = parseDocument(composition.document)
  const rangeStartMs = project.rangeStartMs
  const rangeEndMs = project.rangeEndMs
  const edits = clipEditsFromComposition({
    document,
    wordsById,
    rangeStartMs,
    rangeEndMs,
  })

  let clip = await prisma.clip.findFirst({
    where: { projectId: project.id, workspaceId, title: EXPORT_CLIP_TITLE, deletedAt: null },
  })

  const seedClip = await prisma.clip.findFirst({
    where: { projectId: project.id, workspaceId, deletedAt: null },
    orderBy: { score: 'desc' },
  })

  if (!clip) {
    const clipId = createId('clip')
    const workspaceIdStr = workspaceId
    const previewKey =
      seedClip?.previewKey ??
      (project.upload?.key
        ? `ws/${workspaceIdStr}/projects/${project.id}/clips/${clipId}/preview.mp4`
        : '')
    clip = await prisma.clip.create({
      data: {
        id: clipId,
        projectId: project.id,
        workspaceId,
        title: EXPORT_CLIP_TITLE,
        startMs: rangeStartMs,
        endMs: rangeEndMs,
        score: 0,
        previewKey,
        posterKey: seedClip?.posterKey ?? previewKey.replace('.mp4', '.jpg'),
        wordsKey: seedClip?.wordsKey ?? `ws/${workspaceIdStr}/projects/${project.id}/clips/${clipId}/words.json`,
        edits: edits as object,
      },
    })
  } else {
    clip = await prisma.clip.update({
      where: { id: clip.id },
      data: { edits: edits as object, startMs: rangeStartMs, endMs: rangeEndMs },
    })
  }

  const normalized = normalizeEdits(clip.edits, { clipStartMs: rangeStartMs, clipEndMs: rangeEndMs })
  const resolution = opts.resolution ?? '720p'
  const aspect = opts.aspect ?? '9:16'
  const watermark = opts.watermark ?? false

  const result = await enqueueRenderClip(workspaceId, clip.id, {
    resolution,
    aspect,
    watermark,
    edits: normalized,
    clipStartMs: rangeStartMs,
    clipEndMs: rangeEndMs,
    previewKey: clip.previewKey,
    title: `${project.title} (script export)`,
  })

  const idempotencyKey = `${composition.revision}:${result.render.editsVersionHash ?? 'v0'}`
  try {
    await prisma.scriptCompositionRender.create({
      data: {
        id: createId('scrn'),
        compositionId,
        workspaceId,
        status: result.render.status,
        idempotencyKey,
        resolution,
        aspectRatio: aspect,
        settings: { watermark, clipId: clip.id, renderId: result.render.id },
      },
    })
  } catch {
    /* duplicate idempotency — render row already tracked */
  }

  return {
    renderId: result.render.id,
    clipId: clip.id,
    status: result.render.status,
    downloadUrl: result.downloadUrl,
    filename: result.filename,
    jobId: result.jobId ?? null,
  }
}
