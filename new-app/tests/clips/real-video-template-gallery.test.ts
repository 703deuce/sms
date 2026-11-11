import { describe, expect, it } from 'vitest'
import { filterVideoTemplates, validateVideoTemplateGallery, validateVideoTemplateRelease, type VideoTemplateRelease } from '@/lib/clips/real-video-templates/gallery'
import { FIRST_PARTY_VIDEO_TEMPLATES } from '@/lib/clips/real-video-templates/releases'
import { compileTemplate } from '@/lib/clips/real-video-templates/sequence-contract'
import { compileTemplateWithMusic } from '@/lib/clips/real-video-templates/music-sequence'
import { BATCH9A_DEFAULT_MUSIC } from '@/lib/clips/real-video-templates/batch9a-anchors'
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
      x.musicRequired && x.defaultMusic?.sha256 === BATCH9A_DEFAULT_MUSIC.sha256
    )).toBe(true)
    expect(FIRST_PARTY_VIDEO_TEMPLATES.every(x =>
      x.previewMedia?.frames===4 && x.previewMedia.columns===4 &&
      x.previewMedia.spritePath.startsWith('/clips/template-previews/') &&
      /^[a-f0-9]{64}$/.test(x.previewMedia.sha256)
    )).toBe(true)
    expect(new Set(FIRST_PARTY_VIDEO_TEMPLATES.map(x=>x.previewMedia?.spritePath)).size).toBe(10)
    expect(new Set(FIRST_PARTY_VIDEO_TEMPLATES.map(x=>x.previewMedia?.sha256)).size).toBe(10)
  })
  it('keeps all ten Preview anchors above the Batch 9A authoring-quality floor', () => {
    expect(new Set(FIRST_PARTY_VIDEO_TEMPLATES.map(x=>x.design.stylePackId)).size).toBe(10)
    expect(new Set(FIRST_PARTY_VIDEO_TEMPLATES.map(x=>x.family.texts[0]?.defaultText)).size).toBe(10)
    const transitionTypes=new Set(FIRST_PARTY_VIDEO_TEMPLATES.flatMap(x=>
      x.family.slots.slice(1).map(slot=>slot.transition==='cut'?'cut':slot.transition.type)))
    expect(transitionTypes.size).toBeGreaterThanOrEqual(6)
    for(const release of FIRST_PARTY_VIDEO_TEMPLATES){
      const score=[
        release.family.revision>=2 && release.design.revision>=2,
        release.family.texts.length>=2 && release.family.texts.every(text=>Boolean(text.anim?.in)),
        (release.family.graphics?.length??0)>=1 && release.family.graphics!.every(graphic=>Boolean(graphic.anim)),
        release.family.slots.slice(1).every(slot=>slot.transition!=='cut'),
        release.family.slots.every(slot=>Boolean(slot.motion)),
        release.family.slots.every(slot=>Boolean(slot.fx)),
        release.family.slots.every(slot=>slot.startFrame%BATCH9A_DEFAULT_MUSIC.beatEveryFrames===0),
        release.family.texts[0]!.maxChars<=40,
        release.family.texts[0]!.size>=58,
        release.family.totalFrames>=210 && release.family.totalFrames<=450,
      ].filter(Boolean).length
      expect(score,release.id).toBeGreaterThanOrEqual(9)
    }
  })

  it('compiles every Batch 9A anchor with beat cuts, transitions, animated layers and music', () => {
    const musicAsset = {
      id:'batch9a_test_music',kind:'audio' as const,durationFrames:BATCH9A_DEFAULT_MUSIC.durationFrames,
      license:{id:'batch9a_first_party',provenance:'first-party' as const,reference:BATCH9A_DEFAULT_MUSIC.revision},
    }
    const rights = {
      assetId:musicAsset.id,origin:'first-party-generated',author:BATCH9A_DEFAULT_MUSIC.author,
      license:BATCH9A_DEFAULT_MUSIC.license,revision:BATCH9A_DEFAULT_MUSIC.revision,
      sha256:BATCH9A_DEFAULT_MUSIC.sha256,commercialUse:true,exportAllowed:true,redistributionAllowed:true,
      verifiedDurationFrames:BATCH9A_DEFAULT_MUSIC.durationFrames,verifiedAt:BATCH9A_DEFAULT_MUSIC.revision,
    }
    const schedule = {
      v:1 as const,mode:'beat-time' as const,musicAssetId:musicAsset.id,sha256:BATCH9A_DEFAULT_MUSIC.sha256,
      bpm:BATCH9A_DEFAULT_MUSIC.bpm,confidence:'manual' as const,offsetFrames:0,
      durationFrames:BATCH9A_DEFAULT_MUSIC.durationFrames,
      beats:Array.from({length:Math.ceil(BATCH9A_DEFAULT_MUSIC.durationFrames/BATCH9A_DEFAULT_MUSIC.beatEveryFrames)},
        (_,i)=>i*BATCH9A_DEFAULT_MUSIC.beatEveryFrames).filter(x=>x<BATCH9A_DEFAULT_MUSIC.durationFrames),
      phrases:[],protectedAnchors:[],
    }
    for(const release of FIRST_PARTY_VIDEO_TEMPLATES){
      expect(release.family.slots.every(slot =>
        slot.startFrame % BATCH9A_DEFAULT_MUSIC.beatEveryFrames === 0)).toBe(true)
      expect(release.family.slots.slice(1).every(slot => slot.transition !== 'cut')).toBe(true)
      expect(release.family.texts.every(text => Boolean(text.anim?.in))).toBe(true)
      expect(release.family.graphics?.every(graphic => Boolean(graphic.anim))).toBe(true)
      const media=Object.fromEntries(release.family.slots.map((slot,index)=>[slot.id,{
        id:'photo_'+release.id+'_'+index,kind:'image' as const,
        license:{id:'owned',provenance:'user-owned' as const,reference:'workspace_upload'},
      }]))
      const compiled=compileTemplateWithMusic(release.family,release.design,{
        instanceId:'instance_'+release.id,media,music:musicAsset,
        templateMusic:{v:1,rights,schedule,choice:'keep-timing',acceptLoop:false},
      } as any,{
        durationFrames:release.family.totalFrames,
        edits:defaultEdits({clipStartMs:0,clipEndMs:Math.round(release.family.totalFrames*1000/30)}),
      })
      expect(compiled.edits.sourceSegments).toHaveLength(release.family.slots.length)
      expect(compiled.edits.transitions).toHaveLength(release.family.slots.length-1)
      expect(compiled.edits.textItems).toHaveLength(release.family.texts.length+(release.family.graphics?.length??0))
      expect(compiled.edits.audio?.music).toMatchObject({uploadId:musicAsset.id})
    }
  })

  it('requires real local demos and three visible authored dimensions', () => {
    expect(validateVideoTemplateRelease(fixture('one')).id).toBe('one')
    expect(() => validateVideoTemplateRelease({ ...fixture('one'), reviewed: false } as unknown as VideoTemplateRelease))
      .toThrow('Preview templates must not claim completed certification')
    const preview = { ...fixture('preview'),
      reviewed: false, previewRenderVerified: false, certificationStatus: 'preview' as const }
    delete preview.demoPath
    delete preview.demoPosterPath
    expect(validateVideoTemplateRelease(preview).certificationStatus).toBe('preview')
    expect(() => validateVideoTemplateRelease({ ...fixture('one'), demoPath: 'https://remote.example/demo.mp4' })).toThrow('local demo')
    expect(() => validateVideoTemplateRelease({ ...fixture('one'), authoredDimensions: ['font-hierarchy', 'color','aspect'] })).toThrow('three')
  })
  it('accepts only bounded local rendered preview sprites', () => {
    const sprite = {spritePath:'/clips/template-previews/sample.webp',frames:4,columns:4,sha256:'a'.repeat(64)}
    expect(validateVideoTemplateRelease({...fixture('sprite'),previewMedia:sprite}).previewMedia).toEqual(sprite)
    expect(() => validateVideoTemplateRelease({
      ...fixture('remote-sprite'),previewMedia:{...sprite,spritePath:'https://example.com/sample.webp'},
    })).toThrow('local WebP')
    expect(() => validateVideoTemplateRelease({
      ...fixture('bad-sprite'),previewMedia:{...sprite,frames:5,columns:4},
    })).toThrow('Invalid preview sprite')
    expect(() => validateVideoTemplateRelease({
      ...fixture('bad-hash'),previewMedia:{...sprite,sha256:'not-a-hash'},
    })).toThrow('Invalid preview sprite')
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
