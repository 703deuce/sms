import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { transitionAtCut, transitionAtSite } from '@/lib/clips/editor/transitions'
import { FIRST_PARTY_VIDEO_TEMPLATES } from '@/lib/clips/real-video-templates/releases'
import { compileTemplateWithMusic } from '@/lib/clips/real-video-templates/music-sequence'
import { BATCH9A_DEFAULT_MUSIC } from '@/lib/clips/real-video-templates/batch9a-anchors'
import { templateFrameToMs } from '@/lib/clips/real-video-templates/sequence-contract'
import { defaultEdits } from '@/lib/clips/edits'

describe('template videoSplits expose transitions on the timeline', () => {
  const f01 = FIRST_PARTY_VIDEO_TEMPLATES.find((r) => r.id === 'f01_bold')!

  it('transitionAtCut misses video-split boundaries; transitionAtSite resolves them', () => {
    const durationMs = templateFrameToMs(f01.family.totalFrames)
    const musicAsset = {
      id: 'batch9a_test_music',
      kind: 'audio' as const,
      durationFrames: BATCH9A_DEFAULT_MUSIC.durationFrames,
      license: { id: 'owned', provenance: 'first-party' as const, reference: 'test' },
    }
    const compiled = compileTemplateWithMusic(
      f01.family,
      f01.design,
      {
        instanceId: 'instance_f01',
        media: Object.fromEntries(
          f01.family.slots.map((slot, index) => [
            slot.id,
            { id: `photo_${index}`, kind: 'image' as const, license: { id: 'owned', provenance: 'user-owned' as const, reference: 't' } },
          ]),
        ),
        music: musicAsset,
        templateMusic: {
          v: 1,
          rights: {
            assetId: musicAsset.id,
            origin: 'first-party-generated',
            author: BATCH9A_DEFAULT_MUSIC.author,
            license: BATCH9A_DEFAULT_MUSIC.license,
            revision: BATCH9A_DEFAULT_MUSIC.revision,
            sha256: BATCH9A_DEFAULT_MUSIC.sha256,
            commercialUse: true,
            exportAllowed: true,
            redistributionAllowed: true,
            verifiedDurationFrames: BATCH9A_DEFAULT_MUSIC.durationFrames,
            verifiedAt: BATCH9A_DEFAULT_MUSIC.revision,
          },
          schedule: {
            v: 1,
            mode: 'beat-time' as const,
            musicAssetId: musicAsset.id,
            sha256: BATCH9A_DEFAULT_MUSIC.sha256,
            bpm: BATCH9A_DEFAULT_MUSIC.bpm,
            confidence: 'manual' as const,
            offsetFrames: 0,
            durationFrames: BATCH9A_DEFAULT_MUSIC.durationFrames,
            beats: [],
            phrases: [],
            protectedAnchors: [],
          },
          choice: 'keep-timing',
          acceptLoop: false,
        },
      } as never,
      {
        durationFrames: f01.family.totalFrames,
        edits: defaultEdits({ clipStartMs: 0, clipEndMs: durationMs }),
      },
    )
    const edits = compiled.edits
    const tb = timebaseFor(edits)
    expect(edits.videoSplits?.length).toBeGreaterThan(0)
    const cut = edits.videoSplits![0]!
    expect(transitionAtCut(tb.segs, edits.transitions, cut)).toBeUndefined()
    expect(transitionAtSite(tb, edits.videoSplits, edits.transitions, cut)?.type).toBe(
      edits.transitions?.[0]?.type,
    )
  })

  it('Batch 9A slot motion keeps cover scale while panning (no edge gaps)', () => {
    const anchor = JSON.parse(
      readFileSync(resolve(process.cwd(), 'tests/fixtures/batch9a-anchor-render-contract.json'), 'utf8'),
    ) as { anchors: Array<{ id: string }> }
    for (const release of FIRST_PARTY_VIDEO_TEMPLATES) {
      const row = anchor.anchors.find((a) => a.id === release.id)
      expect(row, release.id).toBeDefined()
      for (const slot of release.family.slots) {
        if (!slot.motion) continue
        expect(slot.motion.from.scale, release.id).toBeGreaterThanOrEqual(103)
        expect(slot.motion.to.scale, release.id).toBe(slot.motion.from.scale)
      }
    }
  })
})
