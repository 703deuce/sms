import { normalizeTranscriptJson } from '@/lib/server/clips/editor-words'
import { getPrisma } from '@/lib/server/db'
import { resolveSourceMediaId, toEditorWords, type EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { createId } from '@/lib/supabase/id'
import type { ClipWord } from '@/lib/clips/edits'

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

  const transcript = await loadProjectTranscript(storage, project)
  const sourceMediaId = resolveSourceMediaId(project)
  const editorWords: EditorWord[] = toEditorWords(sourceMediaId, transcript)

  let sourceVideoUrl: string | null = null
  if (sourceKey) {
    try {
      const mediaStorage = await getClipStorageForObjectKey(sourceKey, driverHint)
      sourceVideoUrl = await createCachedSignedDownloadUrl(mediaStorage, sourceKey)
    } catch {
      sourceVideoUrl = null
    }
  }

  const durationMs = Math.max(0, project.rangeEndMs - project.rangeStartMs)
  let mediaAsset = project.scriptMediaAsset
  if (!mediaAsset && sourceKey) {
    const id = createId('sma')
    mediaAsset = await prisma.scriptMediaAsset.create({
      data: {
        id,
        projectId: project.id,
        workspaceId,
        durationMs: durationMs || 1,
        sourceKey,
      },
    })
  }

  return {
    projectId: project.id,
    title: project.title,
    sourceMediaId,
    durationMs,
    wordCount: editorWords.length,
    enrichedAt: mediaAsset?.enrichedAt?.toISOString() ?? null,
    sourceVideoUrl,
    editorWords,
    compositions: project.scriptCompositions,
    clips: project.clips,
    status: project.status,
  }
}
