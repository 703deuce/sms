import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { filterVideoTemplates, validateVideoTemplateGallery, validateVideoTemplateRelease, type VideoTemplateRelease } from '@/lib/clips/real-video-templates/gallery'
import { FIRST_PARTY_VIDEO_TEMPLATES } from '@/lib/clips/real-video-templates/releases'
import { compileTemplate, templateFrameToMs } from '@/lib/clips/real-video-templates/sequence-contract'
import { compileTemplateWithMusic } from '@/lib/clips/real-video-templates/music-sequence'
import { BATCH9A_DEFAULT_MUSIC } from '@/lib/clips/real-video-templates/batch9a-anchors'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'

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
const BATCH9A_WORKER_CONTRACT = JSON.parse(readFileSync(
  resolve(process.cwd(),'tests/fixtures/batch9a-anchor-render-contract.json'),'utf8',
)) as {
  v:number
  music:{generator:string;sha256:string;durationFrames:number}
  anchors:Array<{id:string;familyId:string;totalFrames:number;slotFrames:number[];slotStarts:number[];
    transitions:Array<{atFrame:number;type:string;durationFrames:number}>;headline:string;closing:string}>
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
  it('matches the exact language-neutral worker contract for all ten anchors', () => {
    expect(BATCH9A_WORKER_CONTRACT.v).toBe(1)
    expect(BATCH9A_WORKER_CONTRACT.music).toEqual({
      generator:BATCH9A_DEFAULT_MUSIC.generator,
      sha256:BATCH9A_DEFAULT_MUSIC.sha256,
      durationFrames:BATCH9A_DEFAULT_MUSIC.durationFrames,
    })
    expect(BATCH9A_WORKER_CONTRACT.anchors.map(row=>row.id))
      .toEqual(FIRST_PARTY_VIDEO_TEMPLATES.map(release=>release.id))
    for(const release of FIRST_PARTY_VIDEO_TEMPLATES){
      const row=BATCH9A_WORKER_CONTRACT.anchors.find(value=>value.id===release.id)!
      expect(row.familyId).toBe(release.family.familyId)
      expect(row.totalFrames).toBe(release.family.totalFrames)
      expect(row.slotFrames).toEqual(release.family.slots.map(slot=>slot.durationFrames))
      expect(row.slotStarts).toEqual(release.family.slots.map(slot=>slot.startFrame))
      expect(row.transitions).toEqual(release.family.slots.slice(1).map(slot=>{
        if(slot.transition==='cut')throw new Error('Batch 9A worker contract requires authored transitions')
        return {atFrame:slot.startFrame,type:slot.transition.type,durationFrames:slot.transition.durationFrames}
      }))
      expect(row.headline).toBe(release.family.texts[0]?.defaultText)
      expect(row.closing).toBe(release.family.texts[1]?.defaultText)
    }
  })

  it('pins every committed real-media preview sprite to its manifest SHA-256', () => {
    for (const release of FIRST_PARTY_VIDEO_TEMPLATES) {
      const preview = release.previewMedia
      expect(preview, release.id).toBeDefined()
      const file = resolve(process.cwd(), 'public', preview!.spritePath.replace(/^\//, ''))
      const digest = createHash('sha256').update(readFileSync(file)).digest('hex')
      expect(digest, release.id).toBe(preview!.sha256)
    }
  })

  it('keeps all ten Preview anchors above the Batch 9A authoring-quality floor', () => {
    expect(new Set(FIRST_PARTY_VIDEO_TEMPLATES.map(x=>x.design.stylePackId)).size).toBe(10)
    expect(new Set(FIRST_PARTY_VIDEO_TEMPLATES.map(x=>x.family.texts[0]?.defaultText)).size).toBe(10)
    expect(FIRST_PARTY_VIDEO_TEMPLATES.every(x=>x.family.texts.every(text=>
      Boolean(text.finish?.shadow) &&
      (Boolean(text.finish?.stroke) || text.finish?.letterSpacing != null)
    ))).toBe(true)
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
      const hook=release.family.texts[0]!
      expect(hook.x,release.id+' headline must stay centered in 9:16').toBe(50)
      if(hook.defaultText.length>=12)
        expect(hook.size,release.id+' long headline must stay inside 9:16 safe width').toBeLessThanOrEqual(120)
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
      const edits=compiled.edits
      const durationMs=templateFrameToMs(release.family.totalFrames)
      const expectedCuts=release.family.slots.slice(1).map(slot=>templateFrameToMs(slot.startFrame))
      const expectedTransitions=release.family.slots.slice(1).map(slot=>{
        if(slot.transition==='cut')throw new Error('Batch 9A release lost authored transition')
        return {srcMs:templateFrameToMs(slot.startFrame),type:slot.transition.type,
          durMs:templateFrameToMs(slot.transition.durationFrames)}
      })
      expect(edits.sourceSegments).toHaveLength(release.family.slots.length)
      expect(compiled.sequence.items).toHaveLength(release.family.slots.length)
      for(const [index,slot] of release.family.slots.entries()){
        expect(edits.sourceSegments?.[index]).toMatchObject({
          startMs:templateFrameToMs(slot.startFrame),
          endMs:templateFrameToMs(slot.startFrame+slot.durationFrames),
          fit:slot.fit,
        })
        expect(compiled.sequence.items[index]).toMatchObject({
          slotId:slot.id,outputStartFrame:slot.startFrame,
          outputEndFrame:slot.startFrame+slot.durationFrames,
        })
      }
      expect(edits.videoSplits).toEqual(expectedCuts)
      expect(edits.transitions).toEqual(expectedTransitions)
      expect(edits.textItems).toHaveLength(release.family.texts.length+(release.family.graphics?.length??0))
      expect(edits.textItems?.every(layer=>Boolean(layer.anim))).toBe(true)
      for(const [index,text] of release.family.texts.entries()){
        const layer=edits.textItems?.[index]
        expect(layer?.style.font,release.id+':'+text.id).toBe(text.font)
        expect(layer?.style.size,release.id+':'+text.id).toBe(text.size)
        expect(layer?.style.color,release.id+':'+text.id).toBe(text.color)
        expect(layer?.style.stroke,release.id+':'+text.id).toEqual(text.finish?.stroke)
        expect(layer?.style.shadow,release.id+':'+text.id).toEqual(text.finish?.shadow)
        expect(layer?.style.letterSpacing,release.id+':'+text.id).toBe(text.finish?.letterSpacing)
      }
      expect(edits.textItems?.filter(layer=>layer.kind==='shape')).toHaveLength(release.family.graphics?.length??0)
      expect(edits.keyframes?.some(track=>track.target==='video'&&track.points.length>=2)).toBe(true)
      expect(edits.audio?.music).toMatchObject({
        uploadId:musicAsset.id,generationId:musicAsset.id,startMs:0,endMs:durationMs,
        loop:false,volume:0.35,
      })
      expect(edits.inserts).toBeUndefined()
      expect(edits.cutRanges).toEqual([])
      expect(edits.templateProvenance).toMatchObject({
        familyId:release.family.familyId,designId:release.design.designId,
      })
      const reloaded=normalizeEdits(JSON.parse(JSON.stringify(edits)),{
        clipStartMs:0,clipEndMs:durationMs,
      })
      const stripFit = <T extends { fit?: string }>(segs: T[] | undefined) =>
        segs?.map(({ fit: _fit, ...rest }) => rest)
      expect(stripFit(reloaded.sourceSegments)).toEqual(stripFit(edits.sourceSegments))
      expect(reloaded.videoSplits).toEqual(edits.videoSplits)
      expect(reloaded.transitions).toEqual(edits.transitions)
      expect(reloaded.audio?.music?.uploadId).toBe(edits.audio?.music?.uploadId)
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

  it('keeps authored text finishes editable and rejects unsafe finish fields', () => {
    const item=fixture('finish')
    item.family.texts=[{
      id:'headline',defaultText:'Readable',maxChars:40,startFrame:0,durationFrames:90,
      x:50,y:20,font:'Anton',size:72,color:'#FFFFFF',
      finish:{stroke:{color:'#000000',width:2},shadow:{color:'#000000',opacity:80,dist:4},letterSpacing:1.2},
      anim:{in:{type:'fade',unit:'block',durMs:300}},
    }]
    const checked=validateVideoTemplateRelease(item)
    const compiled=compileTemplate(checked.family,checked.design,{
      instanceId:'finish_instance',media:{slot1:{
        id:'photo_finish',kind:'image',
        license:{id:'owned',provenance:'user-owned',reference:'workspace_upload'},
      }},
    },{durationFrames:90,edits:defaultEdits({clipStartMs:0,clipEndMs:3000})})
    expect(compiled.edits.textItems?.[0]?.style).toMatchObject({
      stroke:{color:'#000000',width:2},shadow:{color:'#000000',opacity:80,dist:4},letterSpacing:1.2,
    })
    expect(()=>validateVideoTemplateRelease({...item,family:{...item.family,texts:[{
      ...item.family.texts[0]!,finish:{stroke:{color:'#000000',width:17}},
    }]}})).toThrow('text.finish.stroke.width')
    expect(()=>validateVideoTemplateRelease({...item,family:{...item.family,texts:[{
      ...item.family.texts[0]!,finish:{shadow:{color:'black',opacity:80,dist:4}},
    }]}})).toThrow('invalid color')
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
