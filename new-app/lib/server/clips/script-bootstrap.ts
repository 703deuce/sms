import { normalizeTranscriptJson } from '@/lib/server/clips/editor-words'
import { getPrisma } from '@/lib/server/db'
import { resolveSourceMediaId, toEditorWords, type EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { createId } from '@/lib/supabase/id'
import { ensureFullComposition } from '@/lib/server/clips/script-composition'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import type { ClipWord } from '@/lib/clips/edits'
import { ensureProjectTranscriptEnriched } from '@/lib/server/clips/script-enrich'

async function loadProjectTranscript(
  storage: ReturnType<typeof getClipStorage>,
  project: { transcriptKey: string | null; transcriptWords: unknown },
): Promise<ClipWord[]> {
  if (project.transcriptKey) {
    try {
      const raw = await storage.getJson<unknown>(project.transcriptKey)
      const normalized = normalizeTranscriptJson(raw)
      if (normalized.length) return normalized
    } catch {
      /* fall through */
    }
  }
  if (Array.isArray(project.transcriptWords)) {
    return normalizeTranscriptJson(project.transcriptWords)
  }
  return []
}

export async function getScriptBootstrap(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId },
    include: {
      upload: true,
      scriptMediaAsset: true,
      scriptCompositions: { where: { deletedAt: null }, select: { id: true, kind: true, clipId: true, title: true, revision: true } },
      clips: { where: { deletedAt: null }, select: { id: true, title: true, startMs: true, endMs: true }, orderBy: { score: 'desc' }, take: 50 },
    },
  })
  if (!project) return null

  const sourceKey = project.upload?.key ?? null
  const driverHint = project.upload?.storageDriver ?? null
  const storage = project.transcriptKey
    ? await getClipStorageForObjectKey(project.transcriptKey, driverHint)
    : getClipStorage(driverHint)

  let transcript = await loadProjectTranscript(storage, project)
  const rangeSpanMs = Math.max(0, project.rangeEndMs - project.rangeStartMs)
  let mediaAsset = project.scriptMediaAsset
  if (!mediaAsset && project.upload?.key) {
    const id = createId('sma')
    mediaAsset = await prisma.scriptMediaAsset.create({
      data: {
        id,
        projectId: project.id,
        workspaceId,
        durationMs: rangeSpanMs || 1,
        sourceKey: project.upload.key,
      },
    })
  }
  transcript = await ensureProjectTranscriptEnriched(
    workspaceId,
    project.id,
    project.transcriptKey,
    transcript,
    storage,
    mediaAsset?.id ?? null,
  )
  if (mediaAsset?.id) {
    mediaAsset = await prisma.scriptMediaAsset.findUnique({ where: { id: mediaAsset.id } })
  }
  const sourceMediaId = resolveSourceMediaId(project)
  const editorWords: EditorWord[] = toEditorWords(sourceMediaId, transcript)
  const lastWordEndMs = editorWords.reduce((m, w) => Math.max(m, w.t1Ms), project.rangeStartMs)
  const assetDurationMs = mediaAsset?.durationMs ?? 0
  const durationMs = Math.max(rangeSpanMs, assetDurationMs, lastWordEndMs - project.rangeStartMs)
  const composition = await ensureFullComposition(
    workspaceId,
    project.id,
    project.title,
    editorWords.map((w) => w.id),
  )
  const document = (composition.document ?? null) as ScriptDocumentV1 | null

  let sourceVideoUrl: string | null = null
  if (sourceKey) {
    try {
      const mediaStorage = await getClipStorageForObjectKey(sourceKey, driverHint)
      sourceVideoUrl = await createCachedSignedDownloadUrl(mediaStorage, sourceKey)
    } catch {
      sourceVideoUrl = null
    }
  }

  return {
    projectId: project.id,
    title: project.title,
    sourceMediaId,
    rangeStartMs: project.rangeStartMs,
    rangeEndMs: project.rangeEndMs,
    durationMs,
    mediaDurationMs: assetDurationMs || durationMs,
    wordCount: editorWords.length,
    enrichedAt: mediaAsset?.enrichedAt?.toISOString() ?? null,
    sourceVideoUrl,
    editorWords,
    compositionId: composition.id,
    compositionRevision: composition.revision,
    document,
    compositions: project.scriptCompositions,
    clips: project.clips,
    status: project.status,
  }
}
