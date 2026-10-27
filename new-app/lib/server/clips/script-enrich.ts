import type { ClipWord } from '@/lib/clips/edits'
import { enrichTranscriptWords } from '@/lib/clips/script-editor/enrich-transcript'
import { getPrisma } from '@/lib/server/db'
import type { getClipStorage } from '@/lib/storage'

export async function ensureProjectTranscriptEnriched(
  workspaceId: string,
  projectId: string,
  transcriptKey: string | null,
  words: ClipWord[],
  storage: ReturnType<typeof getClipStorage>,
  mediaAssetId: string | null,
): Promise<ClipWord[]> {
  const prisma = getPrisma()
  const asset = mediaAssetId
    ? await prisma.scriptMediaAsset.findUnique({ where: { id: mediaAssetId } })
    : await prisma.scriptMediaAsset.findUnique({ where: { projectId } })
  const enrichedPreview = enrichTranscriptWords(words)
  const previewFillers = enrichedPreview.some((w) => w.isFiller)
  const storedFillers = words.some((w) => (w as { isFiller?: boolean }).isFiller === true)
  if (asset?.enrichedAt && storedFillers) return words
  if (asset?.enrichedAt && !previewFillers) return words

  const enriched = enrichedPreview
  const now = new Date()

  await prisma.clipProject.update({
    where: { id: projectId, workspaceId },
    data: { transcriptWords: enriched as object[] },
  })

  if (transcriptKey) {
    try {
      await storage.putJson(transcriptKey, enriched)
    } catch {
      /* db is canonical */
    }
  }

  if (asset) {
    await prisma.scriptMediaAsset.update({
      where: { id: asset.id },
      data: { enrichedAt: now },
    })
  } else {
    await prisma.scriptMediaAsset.updateMany({
      where: { projectId },
      data: { enrichedAt: now },
    })
  }

  return enriched
}
