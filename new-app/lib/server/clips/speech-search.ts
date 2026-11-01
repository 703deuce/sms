import 'server-only'
import { normalizeTranscriptJson } from '@/lib/server/clips/editor-words'
import { listMediaTranscripts } from '@/lib/server/clips/media-transcripts'
import { listProjectMedia } from '@/lib/server/clips/project-media'
import { getPrisma } from '@/lib/server/db'
import type { SpeechSource } from '@/lib/clips/editor/speech-search'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'

async function loadMainWords(
  project: {
    transcriptKey: string | null
    transcriptWords: unknown
    upload: { filename: string } | null
  },
  storage: ReturnType<typeof getClipStorage>,
): Promise<{ label: string; words: SpeechSource['words'] }> {
  let clipWords = normalizeTranscriptJson(project.transcriptWords)
  if (project.transcriptKey) {
    try {
      const raw = await storage.getJson<unknown>(project.transcriptKey)
      const fromKey = normalizeTranscriptJson(raw)
      if (fromKey.length) clipWords = fromKey
    } catch {
      /* use transcriptWords fallback */
    }
  }
  const words = clipWords.map((w) => ({ w: w.w, s: w.s, e: w.e }))
  const label = project.upload?.filename?.trim() || 'Main source'
  return { label, words }
}

export async function loadSpeechSources(
  workspaceId: string,
  projectId: string,
): Promise<{ sources: SpeechSource[]; untranscribed: number } | null> {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: {
      id: true,
      transcriptKey: true,
      transcriptWords: true,
      upload: { select: { filename: true, storageDriver: true } },
    },
  })
  if (!project) return null

  const driverHint = project.upload?.storageDriver ?? null
  const storage = project.transcriptKey
    ? await getClipStorageForObjectKey(project.transcriptKey, driverHint)
    : getClipStorage(driverHint)

  const { label, words } = await loadMainWords(project, storage)
  const sources: SpeechSource[] = [{ id: 'main', kind: 'main', label, words }]

  const transcripts = (await listMediaTranscripts(workspaceId, projectId)) ?? []
  for (const tr of transcripts) {
    if (tr.status !== 'done' || !tr.words.length) continue
    sources.push({
      id: `${tr.ref}:${tr.refId}`,
      kind: tr.ref,
      label: tr.refId,
      words: tr.words.map((w) => ({ w: w.w, s: w.s, e: w.e })),
    })
  }

  const media = (await listProjectMedia(workspaceId, projectId)) ?? []
  const doneKeys = new Set(
    transcripts.filter((t) => t.status === 'done').map((t) => `${t.ref}:${t.refId}`),
  )
  let untranscribed = 0
  for (const item of media) {
    if (item.isMain || item.mediaType !== 'video') continue
    const key = `${item.ref}:${item.refId}`
    if (!doneKeys.has(key)) untranscribed++
  }

  for (const src of sources) {
    if (src.kind === 'main') continue
    const item = media.find((m) => `${m.ref}:${m.refId}` === src.id)
    if (item?.label) src.label = item.label
  }

  return { sources, untranscribed }
}
