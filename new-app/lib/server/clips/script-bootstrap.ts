import { normalizeTranscriptJson } from '@/lib/server/clips/editor-words'
import { getPrisma } from '@/lib/server/db'
import { resolveSourceMediaId, toEditorWords, type EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { createId } from '@/lib/supabase/id'
import { ensureFullComposition } from '@/lib/server/clips/script-composition'
import {
  ensureClipComposition,
  surroundingContextWordIds,
  wordIdsInClipRange,
} from '@/lib/server/clips/clip-script-composition'
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

export async function getScriptBootstrap(
  workspaceId: string,
  projectId: string,
  opts?: { clipId?: string | null },
) {
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
  const proxyKey =
    project.proxyKey && !/^https?:\/\//i.test(project.proxyKey.trim()) ? project.proxyKey : null
  const driverHint = project.upload?.storageDriver ?? null
  const storage = project.transcriptKey
    ? await getClipStorageForObjectKey(project.transcriptKey, driverHint)
    : getClipStorage(driverHint)

  let transcript = await loadProjectTranscript(storage, project)
  const rangeSpanMs = Math.max(0, project.rangeEndMs - project.rangeStartMs)
  const uploadDurationMs = project.upload?.durationMs ?? 0
  let mediaAsset = project.scriptMediaAsset
  if (!mediaAsset && project.upload?.key) {
    const id = createId('sma')
    mediaAsset = await prisma.scriptMediaAsset.create({
      data: {
        id,
        projectId: project.id,
        workspaceId,
        durationMs: uploadDurationMs || rangeSpanMs || 1,
        sourceKey: project.upload.key,
      },
    })
  } else if (mediaAsset && uploadDurationMs > (mediaAsset.durationMs ?? 0)) {
    mediaAsset = await prisma.scriptMediaAsset.update({
      where: { id: mediaAsset.id },
      data: { durationMs: uploadDurationMs },
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
  let compositionKind: 'FULL' | 'CLIP' = 'FULL'
  let clipId: string | null = null
  let clipStartMs: number | null = null
  let clipEndMs: number | null = null

  const fullComposition = await ensureFullComposition(
    workspaceId,
    project.id,
    project.title,
    editorWords.map((w) => w.id),
  )
  let composition = fullComposition
  const fullCompositionId = fullComposition.id

  if (opts?.clipId) {
    const clip = await prisma.clip.findFirst({
      where: { id: opts.clipId, projectId: project.id, deletedAt: null },
    })
    if (clip) {
      compositionKind = 'CLIP'
      clipId = clip.id
      clipStartMs = clip.startMs
      clipEndMs = clip.endMs
      composition = await ensureClipComposition(workspaceId, project.id, clip, editorWords)
    }
  }

  const document = (composition.document ?? null) as ScriptDocumentV1 | null

  let sourceVideoUrl: string | null = null
  const playbackKey = proxyKey ?? sourceKey
  if (playbackKey && !/^https?:\/\//i.test(playbackKey.trim())) {
    try {
      const mediaStorage = await getClipStorageForObjectKey(playbackKey, driverHint)
      sourceVideoUrl = await createCachedSignedDownloadUrl(mediaStorage, playbackKey)
      if (/backblaze\.com\/user_signin/i.test(sourceVideoUrl)) {
        sourceVideoUrl = null
      }
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
    mediaDurationMs: Math.max(assetDurationMs, uploadDurationMs, durationMs),
    wordCount: editorWords.length,
    enrichedAt: mediaAsset?.enrichedAt?.toISOString() ?? null,
    sourceVideoUrl,
    editorWords,
    compositionId: composition.id,
    fullCompositionId,
    compositionRevision: composition.revision,
    compositionKind,
    clipId,
    clipStartMs,
    clipEndMs,
    surroundingContextIds:
      compositionKind === 'CLIP' && clipStartMs != null && clipEndMs != null
        ? surroundingContextWordIds(
            editorWords,
            new Set(wordIdsInClipRange(editorWords, clipStartMs, clipEndMs)),
            clipStartMs,
            clipEndMs,
          )
        : [],
    document,
    compositions: project.scriptCompositions,
    clips: project.clips,
    status: project.status,
  }
}
