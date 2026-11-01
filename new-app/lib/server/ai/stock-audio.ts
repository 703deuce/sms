import 'server-only'

import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { allStockAudioEntries, type StockAudioEntry } from '@/lib/clips/stock-audio-catalog'
import MUSIC_PROMPTS from '@/lib/clips/music-library-prompts.json'
import { shareBaseUrl } from '@/lib/server/clips/composition-share'

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

async function ensureKenneyFile(entry: StockAudioEntry): Promise<string> {
  const prisma = getPrisma()
  const storage = getClipStorage()
  const providerId = entry.id
  const existing = await prisma.stockAsset.findUnique({
    where: { provider_providerId: { provider: 'kenney-sfx', providerId } },
  })
  const objectKey = `stock-audio/kenney/${providerId}.wav`
  if (existing?.storageKey) {
    try {
      const size = await storage.getObjectSizeBytes(existing.storageKey)
      if (size && size > 0) return storage.createSignedDownloadUrl(existing.storageKey, 3600)
    } catch {
      /* re-ingest */
    }
  }
  const publicUrl = `${shareBaseUrl()}${entry.src}`
  const res = await fetch(publicUrl)
  if (!res.ok) throw new Error('Kenney asset fetch failed')
  const buf = Buffer.from(await res.arrayBuffer())
  await storage.putBytes(objectKey, buf, 'audio/wav')
  const row =
    existing ??
    (await prisma.stockAsset.create({
      data: {
        provider: 'kenney-sfx',
        providerId,
        pageUrl: '',
        author: 'Kenney',
        authorId: 'cc0',
        tags: entry.tags.join(','),
        width: 0,
        height: 0,
        durationS: entry.durationS,
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
  if (input.kind === 'music' && !available) {
    return { available: false, hits: [], presets: MUSIC_PROMPTS as typeof MUSIC_PROMPTS }
  }
  if (!available) {
    return {
      available: false,
      hits: [],
      presets: MUSIC_PROMPTS as typeof MUSIC_PROMPTS,
    }
  }
  const musicEntries: StockAudioEntry[] = (manifest!.tracks ?? []).map((t) => ({
    id: t.id,
    kind: 'music',
    title: t.title,
    source: 'transovo-music',
    license: 'elevenlabs',
    durationS: t.durationS,
    tags: [t.mood ?? '', t.genre ?? ''].filter(Boolean),
    mood: t.mood,
    genre: t.genre,
    bpm: t.bpm,
    storageKey: t.storageKey,
  }))
  const { searchStockAudio } = await import('@/lib/clips/stock-audio-catalog')
  const filtered = searchStockAudio(musicEntries, q, {
    kind: input.kind ?? 'music',
    mood: input.mood,
    genre: input.genre,
  })
  return {
    available: true,
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
  if (kenney) return ensureKenneyFile(kenney)
  return ensureMusicFile(id)
}
