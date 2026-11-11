import 'server-only'

import { createHash } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { BATCH9A_DEFAULT_MUSIC } from '@/lib/clips/real-video-templates/batch9a-anchors'
import {
  assertBatch9aGrooveBytes,
  buildBatch9aGrooveV2Wav,
} from '@/lib/clips/real-video-templates/batch9a-groove-audio'
import type { TemplateMusicDecisionV1 } from '@/lib/clips/real-video-templates/music-sequence'
import type { TemplateAsset } from '@/lib/clips/real-video-templates/sequence-contract'
import type { StudioDraft } from '@/lib/clips/real-video-templates/slot-workflow'
import type { VideoTemplateRelease } from '@/lib/clips/real-video-templates/gallery'
import { getClipStorage, storageDriverName } from '@/lib/storage'
import { FIRST_PARTY_VIDEO_TEMPLATES } from '@/lib/clips/real-video-templates/releases'

function templateMusicKey(workspaceId: string, musicId: string) {
  return `ws/${workspaceId}/template-music/${musicId}.wav`
}

function buildTemplateMusicDecision(uploadId: string, music: NonNullable<VideoTemplateRelease['defaultMusic']>): TemplateMusicDecisionV1 {
  const beats = Array.from(
    { length: Math.floor((music.durationFrames - 1) / music.beatEveryFrames) + 1 },
    (_, index) => index * music.beatEveryFrames,
  )
  return {
    v: 1,
    choice: 'keep-timing',
    acceptLoop: false,
    rights: {
      assetId: uploadId,
      origin: 'first-party-generated',
      author: music.author,
      license: music.license,
      revision: music.revision,
      sha256: music.sha256,
      commercialUse: true,
      exportAllowed: true,
      redistributionAllowed: true,
      verifiedDurationFrames: music.durationFrames,
      verifiedAt: music.revision,
    },
    schedule: {
      v: 1,
      mode: 'beat-time',
      musicAssetId: uploadId,
      sha256: music.sha256,
      bpm: music.bpm,
      confidence: 'manual',
      offsetFrames: 0,
      durationFrames: music.durationFrames,
      beats,
      phrases: [],
      protectedAnchors: [],
    },
  }
}

async function findVerifiedUpload(workspaceId: string, music: NonNullable<VideoTemplateRelease['defaultMusic']>) {
  const key = templateMusicKey(workspaceId, music.id)
  const prisma = getPrisma()
  const row = await prisma.clipUpload.findFirst({
    where: { workspaceId, key, status: 'COMPLETE', mime: 'audio/wav' },
    select: { id: true, key: true, storageDriver: true, bytes: true },
  })
  if (!row) return null
  const storage = getClipStorage(row.storageDriver)
  const bytes = await storage.getObjectBytes(row.key)
  if (BigInt(bytes.byteLength) !== row.bytes) return null
  if (createHash('sha256').update(bytes).digest('hex') !== music.sha256.toLowerCase()) return null
  return row.id
}

export async function ensureWorkspaceBatch9aMusicUpload(workspaceId: string, music = BATCH9A_DEFAULT_MUSIC): Promise<string> {
  const existing = await findVerifiedUpload(workspaceId, music)
  if (existing) return existing
  const bytes = buildBatch9aGrooveV2Wav(music)
  assertBatch9aGrooveBytes(music, bytes)
  const key = templateMusicKey(workspaceId, music.id)
  const driver = storageDriverName()
  const storage = getClipStorage(driver)
  await storage.putBytes(key, bytes, 'audio/wav')
  const uploadId = createId('upl')
  const prisma = getPrisma()
  try {
    await prisma.clipUpload.create({
      data: {
        id: uploadId,
        workspaceId,
        key,
        filename: `${music.id}.wav`,
        bytes: BigInt(bytes.byteLength),
        mime: 'audio/wav',
        durationMs: Math.round(music.durationFrames * 1000 / 30),
        status: 'COMPLETE',
        storageDriver: driver,
        kind: 'media',
      },
    })
  } catch (error) {
    const raced = await findVerifiedUpload(workspaceId, music)
    if (raced) return raced
    throw error
  }
  return uploadId
}

export function draftWithDefaultMusic(
  draft: StudioDraft,
  release: VideoTemplateRelease,
  uploadId: string,
): StudioDraft {
  const music = release.defaultMusic
  if (!music || !release.musicRequired || draft.music) return draft
  const asset: TemplateAsset = {
    id: uploadId,
    kind: 'audio',
    durationFrames: music.durationFrames,
    license: { id: 'batch9a_first_party', provenance: 'first-party', reference: music.revision },
  }
  return {
    ...draft,
    music: asset,
    templateMusic: buildTemplateMusicDecision(uploadId, music),
    musicRightsConfirmed: true,
    musicTiming: 'keep',
  }
}

export async function attachDefaultMusicToDraft(workspaceId: string, draft: StudioDraft): Promise<StudioDraft> {
  const release = FIRST_PARTY_VIDEO_TEMPLATES.find(item => item.id === draft.releaseId)
  if (!release?.defaultMusic || !release.musicRequired || draft.music) return draft
  const uploadId = await ensureWorkspaceBatch9aMusicUpload(workspaceId, release.defaultMusic)
  return draftWithDefaultMusic(draft, release, uploadId)
}
