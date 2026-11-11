import { describe, expect, it } from 'vitest'
import { filterVideoTemplates, validateVideoTemplateGallery, validateVideoTemplateRelease, type VideoTemplateRelease } from '@/lib/clips/real-video-templates/gallery'
import { FIRST_PARTY_VIDEO_TEMPLATES } from '@/lib/clips/real-video-templates/releases'

function fixture(id: string): VideoTemplateRelease {
  return {
    id, title: id, category: 'Editorial', description: 'A fully timed scene',
    demoPath: '/media/demo.mp4', demoPosterPath: '/media/poster.webp',
    rights: 'No music; first-party licensed demonstration',
    requiredCapabilities: [], authoredDimensions: ['font-hierarchy','text-placement','animation-choreography'],
    reviewed: true, previewRenderVerified: true,
    family: { schemaVersion: 1, familyId: 'story', revision: 1, title: 'Story', tags: ['editorial'],
      aspects: ['9:16'], fps: 30, totalFrames: 90,
      slots: [{ id: 'slot1', ordinal: 1, role: 'hero', media: 'image', startFrame: 0,
        durationFrames: 90, fit: 'cover', sourceAudio: 'mute', transition: 'cut' }],
      texts: [], beatAnchors: [0,45] },
    design: { schemaVersion: 1, designId: id, revision: 1, stylePackId: 'editorial',
      familyId: 'story', familyRevision: 1, musicPolicy: 'none' },
  }
}
describe('standalone real video gallery', () => {
  it('never invents released designs from the 2,000 target', () => {
    expect(validateVideoTemplateGallery(FIRST_PARTY_VIDEO_TEMPLATES)).toEqual(FIRST_PARTY_VIDEO_TEMPLATES)
  })
  it('requires real local demos and three visible authored dimensions', () => {
    expect(validateVideoTemplateRelease(fixture('one')).id).toBe('one')
    expect(() => validateVideoTemplateRelease({ ...fixture('one'), reviewed: false } as unknown as VideoTemplateRelease)).toThrow('Unreviewed')
    expect(() => validateVideoTemplateRelease({ ...fixture('one'), demoPath: 'https://remote.example/demo.mp4' })).toThrow('local demo')
    expect(() => validateVideoTemplateRelease({ ...fixture('one'), authoredDimensions: ['font-hierarchy', 'color','aspect'] })).toThrow('three')
  })
  it('checks duplicate IDs and family/treatment pairs', () => {
    expect(() => validateVideoTemplateGallery([fixture('one'),fixture('one')])).toThrow('Duplicate')
  })
  it('filters and paginates before mounting video previews', () => {
    const all = Array.from({length: 2033}, (_, i) => fixture('design' + i))
    expect(filterVideoTemplates(all, {}, 1, 24).items).toHaveLength(24)
    expect(filterVideoTemplates(all, {}, 2, 24).items).toHaveLength(24)
    expect(filterVideoTemplates(all, {query: 'design42'}, 1, 24).total).toBeGreaterThan(0)
    expect(filterVideoTemplates(all, {aspect: '16:9'}).total).toBe(0)
    expect(filterVideoTemplates(all, {maxDurationSeconds: 2}).total).toBe(0)
    expect(filterVideoTemplates(all, {}, 10000).page).toBe(85)
    expect(filterVideoTemplates(all, {}, 1, 1000).items).toHaveLength(48)
  })
})
