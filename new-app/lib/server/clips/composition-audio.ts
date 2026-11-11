import 'server-only'

import { deriveEdl, sourceMsToOutputTime } from '@/lib/clips/script-edl/derive-edl'
import { outputDurationMs } from '@/lib/clips/script-edl/edl-playback'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import { toEditorWords, resolveSourceMediaId } from '@/lib/clips/script-editor/to-editor-words'
import { normalizeTranscriptJson } from '@/lib/server/clips/editor-words'
import { getCompositionForWorkspace } from '@/lib/server/clips/script-composition'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'

export async function getCompositionAudioContext(workspaceId: string, compositionId: string) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return null

  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: row.projectId, workspaceId },
    include: { upload: true },
  })
  if (!project) return null

  let transcript: ReturnType<typeof normalizeTranscriptJson> = []
  const driverHint = project.upload?.storageDriver ?? null
  const storage = project.transcriptKey
    ? await getClipStorageForObjectKey(project.transcriptKey, driverHint)
    : getClipStorage(driverHint)
  if (project.transcriptKey) {
    try {
      transcript = normalizeTranscriptJson(await storage.getJson(project.transcriptKey))
    } catch {
      transcript = Array.isArray(project.transcriptWords)
        ? normalizeTranscriptJson(project.transcriptWords)
        : []
    }
  } else if (Array.isArray(project.transcriptWords)) {
    transcript = normalizeTranscriptJson(project.transcriptWords)
  }

  const sourceMediaId = resolveSourceMediaId(project)
  const editorWords = toEditorWords(sourceMediaId, transcript)
  const wordsById = new Map(editorWords.map((w) => [w.id, w]))
  const document = (row.document ?? { v: 1, keptWordIds: [], deletedWordIds: [] }) as ScriptDocumentV1
  const edl = deriveEdl(document, wordsById, { padMs: 0 })
  const outputLengthMs = outputDurationMs(edl) || project.rangeEndMs - project.rangeStartMs
  const lengthMs = Math.max(3000, Math.min(300_000, outputLengthMs))

  const transcriptText = editorWords
    .filter((w) => document.keptWordIds.includes(w.id))
    .map((w) => w.text)
    .join(' ')
    .slice(0, 8000)

  const keptIds = new Set(document.keptWordIds)
  const keptWords = editorWords.filter((w) => keptIds.has(w.id))
  // The chapter model needs the edited OUTPUT clock, not un-timed source transcript text.
  const timedKeptWords = keptWords.flatMap((w) => {
    const mapped = sourceMsToOutputTime(w.t0Ms, edl)
    return mapped == null ? [] : [{ text: w.text, outMs: Math.round(mapped) }]
  }).sort((a, b) => a.outMs - b.outMs)

  return {
    composition: row,
    projectId: row.projectId,
    clipId: row.clipId,
    lengthMs,
    // Chapter generation uses the full edited output; audio processing keeps its existing 5-minute cap.
    chapterDurationMs: Math.max(0, outputLengthMs),
    transcriptText,
    keptWords,
    timedKeptWords,
  }
}
