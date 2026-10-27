import { Prisma } from '@prisma/client'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { emptyDocument } from '@/lib/clips/script-edl/ops'
import { parseScriptCompositionDocument } from '@/lib/server/clips/script-composition'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { normalizeEdits } from '@/lib/clips/edits'

const SURROUNDING_MS = 60_000

export function wordIdsInClipRange(words: EditorWord[], startMs: number, endMs: number): string[] {
  return words
    .filter((w) => w.t0Ms < endMs && w.t1Ms > startMs)
    .sort((a, b) => a.t0Ms - b.t0Ms)
    .map((w) => w.id)
}

export function surroundingContextWordIds(
  words: EditorWord[],
  clipWordIds: Set<string>,
  startMs: number,
  endMs: number,
): string[] {
  const lo = startMs - SURROUNDING_MS
  const hi = endMs + SURROUNDING_MS
  return words
    .filter((w) => w.t0Ms >= lo && w.t1Ms <= hi && !clipWordIds.has(w.id))
    .map((w) => w.id)
}

export async function ensureClipComposition(
  workspaceId: string,
  projectId: string,
  clip: { id: string; title: string; startMs: number; endMs: number; edits: unknown; aspect?: string | null },
  editorWords: EditorWord[],
) {
  const prisma = getPrisma()
  const existing = await prisma.scriptComposition.findFirst({
    where: { projectId, kind: 'CLIP', clipId: clip.id, deletedAt: null },
  })
  const clipIds = wordIdsInClipRange(editorWords, clip.startMs, clip.endMs)
  const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
  const edits = normalizeEdits(clip.edits, bounds)
  const aspect = (edits.aspect as string) || clip.aspect || '9:16'

  if (existing) {
    const doc = parseScriptCompositionDocument(existing.document)
    if (!doc.keptWordIds.length && clipIds.length) {
      const seeded = emptyDocument(clipIds)
      return prisma.scriptComposition.update({
        where: { id: existing.id },
        data: {
          document: seeded as Prisma.InputJsonValue,
          aspect,
          reframe: (edits.cropKey ? {} : existing.reframe) as Prisma.InputJsonValue,
        },
      })
    }
    return existing
  }

  const doc = emptyDocument(clipIds)
  return prisma.scriptComposition.create({
    data: {
      id: createId('scmp'),
      projectId,
      workspaceId,
      kind: 'CLIP',
      clipId: clip.id,
      title: clip.title || 'Clip',
      document: doc as Prisma.InputJsonValue,
      revision: 0,
      aspect,
      reframe: {} as Prisma.InputJsonValue,
    },
  })
}

/** After clip composition edits, update Clip.startMs/endMs from kept words (grid thumbnail/duration). */
export async function syncClipBoundsFromComposition(
  compositionId: string,
  document: ReturnType<typeof parseScriptCompositionDocument>,
) {
  const prisma = getPrisma()
  const row = await prisma.scriptComposition.findUnique({
    where: { id: compositionId },
    select: {
      clipId: true,
      kind: true,
      projectId: true,
      project: { select: { id: true, uploadId: true, transcriptWords: true, transcriptKey: true, upload: true } },
    },
  })
  if (!row?.clipId || row.kind !== 'CLIP') return

  const { resolveSourceMediaId, toEditorWords } = await import('@/lib/clips/script-editor/to-editor-words')
  const { normalizeTranscriptJson } = await import('@/lib/server/clips/editor-words')
  const { getClipStorageForObjectKey, getClipStorage } = await import('@/lib/storage')
  let transcript: import('@/lib/clips/edits').ClipWord[] = []
  const project = row.project
  if (project?.transcriptKey) {
    try {
      const storage = await getClipStorageForObjectKey(project.transcriptKey, project.upload?.storageDriver ?? null)
      const raw = await storage.getJson<unknown>(project.transcriptKey)
      transcript = normalizeTranscriptJson(raw)
    } catch {
      /* fall through */
    }
  }
  if (!transcript.length && Array.isArray(project?.transcriptWords)) {
    transcript = normalizeTranscriptJson(project.transcriptWords)
  }
  const sourceMediaId = resolveSourceMediaId({ id: row.projectId, uploadId: project?.uploadId ?? null })
  const editorWords = toEditorWords(sourceMediaId, transcript)

  const byId = new Map(editorWords.map((w) => [w.id, w]))
  const deleted = new Set(document.deletedWordIds)
  const ignored = new Set(document.ignoredWordIds ?? [])
  const kept = document.keptWordIds
    .map((id) => byId.get(id))
    .filter((w): w is EditorWord => Boolean(w && !deleted.has(w.id) && !ignored.has(w.id)))
  if (!kept.length) return

  const startMs = Math.min(...kept.map((w) => w.t0Ms))
  const endMs = Math.max(...kept.map((w) => w.t1Ms))
  await prisma.clip.update({
    where: { id: row.clipId },
    data: { startMs, endMs, durationMs: Math.max(1, endMs - startMs) },
  })
}
