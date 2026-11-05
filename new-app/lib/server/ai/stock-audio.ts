import 'server-only'

import { getPrisma } from '@/lib/server/db'
import { getClipStorage, storageDriverName } from '@/lib/storage'
import { allStockAudioEntries, type StockAudioEntry } from '@/lib/clips/stock-audio-catalog'
import MUSIC_PROMPTS from '@/lib/clips/music-library-prompts.json'
import { shareBaseUrl } from '@/lib/server/clips/composition-share'
import { registerProjectMedia } from '@/lib/server/clips/project-media'
import { createId } from '@/lib/supabase/id'
import { vorbisDurationMs } from '@/lib/clips/editor/vorbis-duration'

const MANIFEST_KEY = 'stock-audio/music/manifest.json'
const MANIFEST_TTL_MS = 10 * 60 * 1000

type MusicManifest = {
  version: number
  tracks: { id: string; title: string; mood?: string; genre?: string; durationS: number; storageKey: string; bpm?: number }[]
}

let manifestCache: { at: number; manifest: MusicManifest | null; available: boolean } | null = null

async function loadMusicManifest(): Promise<{ available: boolean; manifest: MusicManifest | null }> {
  const now = Date.now()
  if (manifestCache && now - manifestCache.at < MANIFEST_TTL_MS) {
    return { available: manifestCache.available, manifest: manifestCache.manifest }
  }
  const storage = getClipStorage()
  try {
    const raw = await storage.getJson<MusicManifest>(MANIFEST_KEY)
    if (raw?.tracks?.length) {
      manifestCache = { at: now, manifest: raw, available: true }
      return { available: true, manifest: raw }
    }
  } catch {
    /* missing */
  }
  manifestCache = { at: now, manifest: null, available: false }
  return { available: false, manifest: null }
}

export type StockAudioSearchHit = {
  id: string
  title: string
  kind: 'music' | 'sfx'
  license: 'elevenlabs' | 'cc0'
  durationS: number
  tags: string[]
  mood?: string
  genre?: string
  bpm?: number
  previewUrl: string
}

function entryById(id: string): StockAudioEntry | null {
  return allStockAudioEntries().find((e) => e.id === id) ?? null
}

async function ensureCatalogFile(entry: StockAudioEntry): Promise<string> {
  const prisma = getPrisma()
  const storage = getClipStorage()
  const providerId = entry.id
  const cc0Music = entry.source === 'cc0-music'
  const provider = cc0Music ? 'cc0-music' : 'kenney-sfx'
  const existing = await prisma.stockAsset.findUnique({
    where: { provider_providerId: { provider, providerId } },
  })
  const objectKey = cc0Music
    ? `stock-audio/cc0-music/${providerId}.ogg`
    : `stock-audio/kenney/${providerId}.wav`
  if (existing?.storageKey) {
    try {
      const size = await storage.getObjectSizeBytes(existing.storageKey)
      if (size && size > 0) return storage.createSignedDownloadUrl(existing.storageKey, 3600)
    } catch {
      /* re-ingest */
    }
  }
  // Only fixed, commit-pinned catalog paths are fetched, never user URLs.
  const publicUrl = cc0Music ? entry.src! : `${shareBaseUrl()}${entry.src}`
  const res = await fetch(publicUrl, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error('Stock asset unavailable')
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 128 || buf.length > 12_000_000) throw new Error('Invalid stock audio payload')
  const durationS = cc0Music ? vorbisDurationMs(buf) / 1000 : entry.durationS
  if (cc0Music && durationS <= 0) throw new Error('Invalid CC0 music duration')
  await storage.putBytes(objectKey, buf, cc0Music ? 'audio/ogg' : 'audio/wav')
  const row =
    existing ??
    (await prisma.stockAsset.create({
      data: {
        provider,
        providerId,
        pageUrl: cc0Music ? 'https://opengameart.org/' : 'https://kenney.nl/',
        author: cc0Music ? (entry.id === 'cc0-boss-battle' ? 'Juhani Junkala' : entry.id === 'cc0-dungeon-theme' ? 'Memoraphile' : 'qubodup') : 'Kenney',
        authorId: 'cc0',
        tags: entry.tags.join(','),
        width: 0,
        height: 0,
        durationS,
        thumbUrl: '',
        storageKey: objectKey,
      },
    }))
  if (!row.storageKey) {
    await prisma.stockAsset.update({ where: { id: row.id }, data: { storageKey: objectKey } })
  }
  return storage.createSignedDownloadUrl(objectKey, 3600)
}

async function ensureMusicFile(trackId: string): Promise<string> {
  const { manifest } = await loadMusicManifest()
  const track = manifest?.tracks.find((t) => t.id === trackId)
  if (!track?.storageKey) throw new Error('Unknown music track')
  const storage = getClipStorage()
  return storage.createSignedDownloadUrl(track.storageKey, 3600)
}

export async function searchStockAudioServer(input: {
  q: string
  kind?: 'music' | 'sfx'
  mood?: string
  genre?: string
}): Promise<{ available: boolean; hits: StockAudioSearchHit[]; presets?: typeof MUSIC_PROMPTS }> {
  const { available, manifest } = await loadMusicManifest()
  const q = input.q.trim()
  if (input.kind === 'sfx' || !input.kind) {
    const { searchStockAudio } = await import('@/lib/clips/stock-audio-catalog')
    const sfxHits = searchStockAudio(allStockAudioEntries(), q, {
      kind: 'sfx',
      mood: input.mood,
      genre: input.genre,
    })
    const hits: StockAudioSearchHit[] = sfxHits.map((e) => ({
      id: e.id,
      title: e.title,
      kind: 'sfx',
      license: 'cc0',
      durationS: e.durationS,
      tags: e.tags,
      previewUrl: `/api/clips/stock-audio/${e.id}/file`,
    }))
    if (input.kind === 'sfx') return { available: true, hits }
  }
  // The CC0 music is always available, even before the optional generated
  // ElevenLabs manifest is populated in object storage.
  const musicEntries: StockAudioEntry[] = [
    ...allStockAudioEntries().filter(e => e.kind === 'music'),
    ...(manifest?.tracks ?? []).map(t => ({
      id: t.id, kind: 'music' as const, title: t.title,
      source: 'transovo-music' as const, license: 'elevenlabs' as const,
      durationS: t.durationS,
      tags: [t.mood ?? '', t.genre ?? ''].filter(Boolean),
      mood: t.mood, genre: t.genre, bpm: t.bpm, storageKey: t.storageKey,
    })),
  ]
  const { searchStockAudio } = await import('@/lib/clips/stock-audio-catalog')
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
  const ext = meta.mime.includes('wav') ? 'wav' : meta.mime.includes('ogg') ? 'ogg' : 'mp3'
  await registerProjectMedia(workspaceId, projectId, {
    uploadId: upload.id,
    label: `${meta.label}.${ext}`,
    durationMs: meta.durationMs,
    hasAudio: true,
  })
  return { uploadId: upload.id }
}
