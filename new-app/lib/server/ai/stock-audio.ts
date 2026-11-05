  const filtered = searchStockAudio(musicEntries, q, {
    kind: input.kind ?? 'music',
    mood: input.mood,
    genre: input.genre,
  })
  const filtered = searchStockAudio(musicEntries, q, {
    kind: 'music',
    mood: input.mood,
    genre: input.genre,
  })
  return {
    available: true,
    ...(!available ? { presets: MUSIC_PROMPTS as typeof MUSIC_PROMPTS } : {}),
    hits: filtered.map((e) => ({
      id: e.id,
      title: e.title,
      kind: e.kind,
      license: e.license,
      durationS: e.durationS,
      tags: e.tags,
      mood: e.mood,
      genre: e.genre,
      bpm: e.bpm,
      previewUrl: `/api/clips/stock-audio/${e.id}/file`,
    })),
  }
}

export async function ensureStockAudioFile(id: string): Promise<string> {
  const kenney = entryById(id)
  if (kenney) return ensureCatalogFile(kenney)
  return ensureMusicFile(id)
}

const STOCK_REF_PREFIX = 'stock-ref:'

export type StockAudioAttachMeta = {
  objectKey: string
  bytes: number
  mime: string
  durationMs: number
  label: string
  refMarker: string
}

async function resolveStockAudioAttachMeta(stockId: string): Promise<StockAudioAttachMeta> {
  const kenney = entryById(stockId)
  if (kenney) {
    await ensureCatalogFile(kenney)
    const prisma = getPrisma()
    const cc0Music = kenney.source === 'cc0-music'
    const row = await prisma.stockAsset.findUnique({
      where: { provider_providerId: { provider: cc0Music ? 'cc0-music' : 'kenney-sfx', providerId: kenney.id } },
    })
    if (!row?.storageKey) throw new Error('Stock ingest failed')
    const storage = getClipStorage()
    const bytes = (await storage.getObjectSizeBytes(row.storageKey)) ?? 0
    return {
      objectKey: row.storageKey,
      bytes,
      mime: cc0Music ? 'audio/ogg' : 'audio/wav',
      durationMs: cc0Music ? Math.round(row.durationS * 1000) : Math.round(kenney.durationS * 1000),
      label: kenney.title,
      refMarker: `${STOCK_REF_PREFIX}${kenney.id}`,
    }
  }
  const { manifest } = await loadMusicManifest()
  const track = manifest?.tracks.find((t) => t.id === stockId)
  if (!track?.storageKey) throw new Error('Unknown stock audio')
  const storage = getClipStorage()
  const bytes = (await storage.getObjectSizeBytes(track.storageKey)) ?? 0
  return {
    objectKey: track.storageKey,
    bytes,
    mime: 'audio/mpeg',
    durationMs: Math.round(track.durationS * 1000),
    label: track.title,
    refMarker: `${STOCK_REF_PREFIX}${track.id}`,
  }
}

/** Register stock audio in the project library without browser fetch (avoids B2 CORS on Add). */
export async function attachStockAudioToProject(
  workspaceId: string,
  projectId: string,
  stockId: string,
): Promise<{ uploadId: string }> {
  const meta = await resolveStockAudioAttachMeta(stockId)
  const prisma = getPrisma()
  let upload = await prisma.clipUpload.findFirst({
    where: { workspaceId, filename: meta.refMarker, status: 'COMPLETE' },
    select: { id: true },
  })
  if (!upload) {
    const uploadId = createId('upl')
    const ext = meta.mime.includes('wav') ? 'wav' : meta.mime.includes('ogg') ? 'ogg' : 'mp3'
    await prisma.clipUpload.create({
      data: {
        id: uploadId,
        workspaceId,
        key: meta.objectKey,
        filename: meta.refMarker,
        bytes: BigInt(Math.max(1, meta.bytes)),
        mime: meta.mime,
        status: 'COMPLETE',
        durationMs: meta.durationMs,
        storageDriver: storageDriverName(),
        uploadMode: 'reference',
      },
    })
    upload = { id: uploadId }
  }
  const ext = meta.mime.includes('wav') ? 'wav' : 'mp3'
  await registerProjectMedia(workspaceId, projectId, {
    uploadId: upload.id,
    label: `${meta.label}.${ext}`,
    durationMs: meta.durationMs,
    hasAudio: true,
  })
  return { uploadId: upload.id }
}
