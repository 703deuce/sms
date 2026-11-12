#!/usr/bin/env tsx
/**
 * Compile ClipEditsV2 for Batch 9A gallery anchors (f01_bold–f10_bold).
 * Feeds worker/scripts/extract_batch9a_anchor_gallery_posters.py at 1080×1920.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { defaultEdits } from '../lib/clips/edits'
import {
  BATCH9A_ANCHOR_RELEASES,
  BATCH9A_DEFAULT_MUSIC,
} from '../lib/clips/real-video-templates/batch9a-anchors'
import { buildBatch9aGrooveV2Wav } from '../lib/clips/real-video-templates/batch9a-groove-audio'
import { compileTemplateWithMusic, type TemplateMusicDecisionV1 } from '../lib/clips/real-video-templates/music-sequence'
import { templateFrameToMs, type TemplateAsset } from '../lib/clips/real-video-templates/sequence-contract'

const out = resolve(process.cwd(), process.argv[2] ?? '../build/batch9a-anchor-gallery-contract.json')
const musicBytes = buildBatch9aGrooveV2Wav(BATCH9A_DEFAULT_MUSIC)
const musicSha = createHash('sha256').update(musicBytes).digest('hex')
if (musicSha !== BATCH9A_DEFAULT_MUSIC.sha256) {
  throw new Error('Batch 9A groove bytes drift from pinned SHA-256')
}

const license = {
  id: 'batch9a_gallery_first_party',
  provenance: 'first-party' as const,
  reference: BATCH9A_DEFAULT_MUSIC.revision,
}
const rights = {
  assetId: BATCH9A_DEFAULT_MUSIC.id,
  origin: 'first-party-generated' as const,
  author: BATCH9A_DEFAULT_MUSIC.author,
  license: BATCH9A_DEFAULT_MUSIC.license,
  revision: BATCH9A_DEFAULT_MUSIC.revision,
  sha256: musicSha,
  commercialUse: true,
  exportAllowed: true,
  redistributionAllowed: true,
  verifiedDurationFrames: BATCH9A_DEFAULT_MUSIC.durationFrames,
  verifiedAt: BATCH9A_DEFAULT_MUSIC.revision,
}
const schedule = {
  v: 1 as const,
  mode: 'beat-time' as const,
  musicAssetId: BATCH9A_DEFAULT_MUSIC.id,
  sha256: musicSha,
  bpm: BATCH9A_DEFAULT_MUSIC.bpm,
  confidence: 'manual' as const,
  offsetFrames: 0,
  durationFrames: BATCH9A_DEFAULT_MUSIC.durationFrames,
  beats: Array.from(
    { length: Math.ceil(BATCH9A_DEFAULT_MUSIC.durationFrames / BATCH9A_DEFAULT_MUSIC.beatEveryFrames) },
    (_, i) => i * BATCH9A_DEFAULT_MUSIC.beatEveryFrames,
  ).filter((x) => x < BATCH9A_DEFAULT_MUSIC.durationFrames),
  phrases: [] as const,
  protectedAnchors: [] as const,
}
const decision: TemplateMusicDecisionV1 = { v: 1, rights, schedule, choice: 'keep-timing' }
const music: TemplateAsset = {
  id: BATCH9A_DEFAULT_MUSIC.id,
  kind: 'audio',
  durationFrames: BATCH9A_DEFAULT_MUSIC.durationFrames,
  license,
}

const photoManifest = {
  path: 'worker/tests/fixtures/template_media/b8_cc0_photos.json',
  revision: 'b8-cc0-photo-pack-v1',
  license: 'CC0-1.0',
} as const

const designs = BATCH9A_ANCHOR_RELEASES.map((release) => {
  const media: Record<string, TemplateAsset> = {}
  release.family.slots.forEach((slot, index) => {
    media[slot.id] = {
      id: `gallery_image_${index}`,
      kind: 'image',
      license,
    }
  })
  const durationMs = templateFrameToMs(release.family.totalFrames)
  const base = defaultEdits({ clipStartMs: 0, clipEndMs: durationMs })
  const carrierEdits = {
    ...base,
    trim: { in: 0, out: durationMs },
    layout: { ...base.layout, mode: 'full_frame' as const },
    aspectRatio: '9:16' as const,
    captions: { ...base.captions, enabled: false },
  }
  const compiled = compileTemplateWithMusic(
    release.family,
    release.design,
    {
      instanceId: `gallery_${release.id}`,
      media,
      music,
      templateMusic: decision,
    },
    { durationFrames: release.family.totalFrames, edits: carrierEdits },
  )
  return {
    id: release.id,
    familyId: release.family.familyId,
    totalFrames: release.family.totalFrames,
    boundaries: [0, ...release.family.slots.map((slot) => slot.startFrame + slot.durationFrames)],
    slotStarts: release.family.slots.map((slot) => slot.startFrame),
    slotFrames: release.family.slots.map((slot) => slot.durationFrames),
    edits: compiled.edits,
  }
})

mkdirSync(dirname(out), { recursive: true })
const musicFile = 'batch9a-anchor-gallery-music.wav'
writeFileSync(resolve(dirname(out), musicFile), musicBytes)
writeFileSync(
  out,
  JSON.stringify(
    {
      v: 1,
      phase: 'batch9a-anchor-gallery-v1',
      fps: 30,
      playW: 1080,
      playH: 1920,
      fixture: { musicId: BATCH9A_DEFAULT_MUSIC.id, musicSha, musicFile, photoManifest },
      designs,
    },
    null,
    2,
  ) + '\n',
)
console.log('Wrote', designs.length, 'Batch 9A gallery anchor contracts to', out)
