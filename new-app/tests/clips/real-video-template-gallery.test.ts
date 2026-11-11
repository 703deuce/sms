import { describe, expect, it } from 'vitest'
import { filterVideoTemplates, validateVideoTemplateGallery, validateVideoTemplateRelease, type VideoTemplateRelease } from '@/lib/clips/real-video-templates/gallery'
import { FIRST_PARTY_VIDEO_TEMPLATES } from '@/lib/clips/real-video-templates/releases'
import { compileTemplate } from '@/lib/clips/real-video-templates/sequence-contract'
import { defaultEdits } from '@/lib/clips/edits'

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
  it('publishes only the 10 Batch 9A anchors as truthful Preview releases', () => {
    expect(validateVideoTemplateGallery(FIRST_PARTY_VIDEO_TEMPLATES)).toEqual(FIRST_PARTY_VIDEO_TEMPLATES)
    expect(FIRST_PARTY_VIDEO_TEMPLATES).toHaveLength(10)
    expect(FIRST_PARTY_VIDEO_TEMPLATES.map(x=>x.id)).toEqual(
      Array.from({length:10},(_,i)=>'f'+String(i+1).padStart(2,'0')+'_bold'))
    expect(FIRST_PARTY_VIDEO_TEMPLATES.every(x =>
      x.certificationStatus==='preview' && !x.reviewed && !x.previewRenderVerified &&
      x.musicRequired && x.defaultMusic?.sha256 === '4fb1206922f32a40c53ae14780d721541eb1fe0c42259f666016b23d68a11d3e'
    )).toBe(true)
  })
  it('requires real local demos and three visible authored dimensions', () => {
    expect(validateVideoTemplateRelease(fixture('one')).id).toBe('one')
    expect(() => validateVideoTemplateRelease({ ...fixture('one'), reviewed: false } as unknown as VideoTemplateRelease))
      .toThrow('Preview templates must not claim completed certification')
    expect(validateVideoTemplateRelease({
      ...fixture('preview'), demoPath: undefined, demoPosterPath: undefined,
      reviewed: false, previewRenderVerified: false, certificationStatus: 'preview',
    }).certificationStatus).toBe('preview')
    expect(() => validateVideoTemplateRelease({ ...fixture('one'), demoPath: 'https://remote.example/demo.mp4' })).toThrow('local demo')
    expect(() => validateVideoTemplateRelease({ ...fixture('one'), authoredDimensions: ['font-hierarchy', 'color','aspect'] })).toThrow('three')
  })
  it('checks duplicate IDs and family/treatment pairs', () => {
    expect(() => validateVideoTemplateGallery([fixture('one'),fixture('one')])).toThrow('Duplicate')
  })

  it('compiles authored text and graphic choreography into shared renderable item animations', () => {
    const item = fixture('motion')
    item.family.texts = [{
      id: 'headline', defaultText: 'Story', maxChars: 40, startFrame: 0,
      durationFrames: 90, x: 30, y: 25, font: 'Anton', size: 60, color: '#ffffff',
      anim: { in: { type: 'slide_up', unit: 'block', durMs: 400 },
        out: { type: 'fade', unit: 'block', durMs: 300 } },
    }]
    item.family.graphics = [{
      id: 'frame', type: 'rounded', startFrame: 0, durationFrames: 90,
      x: 50, y: 60, w: 320, h: 140, color: '#eeff33',
      anim: { loop: { type: 'pulse', periodMs: 900 } },
    }]
    const result = compileTemplate(item.family, item.design, {
      instanceId: 'instance1', media: { slot1: {
        id: 'photo_1', kind: 'image',
        license: { id: 'owned', provenance: 'user-owned', reference: 'workspace_upload' },
      } },
    }, { durationFrames: 90, edits: defaultEdits({clipStartMs: 0, clipEndMs: 3000}) })
    expect(result.edits.textItems?.[0]?.anim?.in?.type).toBe('slide_up')
    expect(result.edits.textItems?.[1]?.anim?.loop?.type).toBe('pulse')
    expect(result.edits.textItems?.[1]?.kind).toBe('shape')
    expect(result.edits.inserts).toBeUndefined()
    expect(() => validateVideoTemplateRelease({
      ...item, family: { ...item.family,
        graphics: [{ ...item.family.graphics![0]!,
          anim: { in: { type: 'typewriter', unit: 'char', durMs: 300 } } }] },
    })).toThrow('whole-layer')
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
