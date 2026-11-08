import 'server-only'

import type { ClipWord } from '@/lib/clips/edits'
import { normalizeTranscriptJson } from '@/lib/server/clips/editor-words'
import { getClipEditorWords } from '@/lib/server/clips/clip-detail'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'
import type { AiProducerSourceRef } from '@/lib/ai-producer-agent/types'

/** Load the real transcript used by the editor, not a model-invented one. */
export async function loadRoughCutWords(
  workspaceId: string,
  source: AiProducerSourceRef,
  minimumWords = 30,
): Promise<ClipWord[]> {
  if (!source.rangeMs) throw new Error('rough_cut_range_missing')
  const [start, end] = source.rangeMs
  let words: ClipWord[] = []
  if (source.clipId) {
    const result = await getClipEditorWords(workspaceId, source.clipId, {
      trimInMs: start, trimOutMs: end, contextMs: 0,
    })
    words = result?.words ?? []
  } else if (source.projectId) {
    const project = await getPrisma().clipProject.findFirst({
      where: { id: source.projectId, workspaceId, deletedAt: null },
      select: {
        transcriptWords: true,
        transcriptKey: true,
        upload: { select: { storageDriver: true } },
      },
    })
    if (!project) throw new Error('rough_cut_source_not_found')
    words = normalizeTranscriptJson(project.transcriptWords)
    if (!words.length && project.transcriptKey) {
      const storage = project.upload?.storageDriver
        ? getClipStorage(project.upload.storageDriver)
        : await getClipStorageForObjectKey(project.transcriptKey)
      words = normalizeTranscriptJson(await storage.getJson(project.transcriptKey))
    }
  }
  const scoped = words.filter((w) => Number.isFinite(w.s) && Number.isFinite(w.e) &&
    w.e > w.s && w.e * 1000 > start && w.s * 1000 < end)
  if (scoped.length < minimumWords) throw new Error('rough_cut_requires_transcript_words')
  return scoped
}
