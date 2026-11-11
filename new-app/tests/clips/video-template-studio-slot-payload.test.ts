import { describe, expect, it } from 'vitest'
import { validDraft } from '@/lib/server/clips/video-template-studio-projects'
import { newStudioDraft } from '@/lib/clips/real-video-templates/slot-workflow'

/** Matches the workspace studio PUT payload after "Use" on an uploaded JPG (f01_bold slots). */
describe('video template studio uploaded photo slot payload', () => {
  const releaseId = 'f01_bold'
  const photo = {
    id: 'sh_01_photo',
    kind: 'image' as const,
    license: { id: 'user_owned', provenance: 'user-owned' as const, reference: 'workspace_upload' },
  }
  const studioFill = {
    asset: photo,
    sourceInFrame: 0,
    fit: 'cover' as const,
    muteSourceAudio: true,
    focalX: 50,
    focalY: 50,
    remedy: 'replace' as const,
  }

  it('normalizes still slots that copied video head trim onto uploaded photos', () => {
    const draft = newStudioDraft(releaseId, 'draft_payload_test01')
    const broken = {
      ...draft,
      slots: {
        slot_01: { ...studioFill, sourceInFrame: 6 },
        slot_02: { ...studioFill, asset: { ...photo, id: 'sh_02_photo' } },
        slot_03: { ...studioFill, asset: { ...photo, id: 'sh_03_photo' } },
        slot_04: { ...studioFill, asset: { ...photo, id: 'sh_04_photo' } },
      },
      texts: { headline: 'WAIT FOR IT', closing_line: 'THE REVEAL' },
    }
    const parsed = validDraft(releaseId, broken)
    expect(parsed.slots.slot_01?.sourceInFrame).toBe(0)
  })

  it('accepts the normalized studio payload for four Batch 9A still slots', () => {
    const draft = newStudioDraft(releaseId, 'draft_payload_test02')
    const filled = {
      ...draft,
      slots: {
        slot_01: studioFill,
        slot_02: { ...studioFill, asset: { ...photo, id: 'sh_02_photo' } },
        slot_03: { ...studioFill, asset: { ...photo, id: 'sh_03_photo' } },
        slot_04: { ...studioFill, asset: { ...photo, id: 'sh_04_photo' } },
      },
      texts: { headline: 'WAIT FOR IT', closing_line: 'THE REVEAL' },
    }
    expect(() => validDraft(releaseId, filled)).not.toThrow()
  })
})
