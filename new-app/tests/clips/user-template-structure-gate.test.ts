import { describe, expect, it } from 'vitest'
import { assertUserTemplateEditableStructure } from '@/lib/clips/user-templates/structure-gate'
import type { UserTemplateAssetManifestV1, UserTemplateDefinitionV1 } from '@/lib/clips/user-templates/contract'

function fixture(){
  const slots=[
    {id:'slot_1',ordinal:1,label:'Main',media:'video' as const,target:{kind:'main' as const},minDurationMs:6000},
    {id:'slot_2',ordinal:2,label:'Second',media:'video' as const,target:{kind:'source' as const,sourceId:'template_source_2'},minDurationMs:2000},
  ]
  const edits:any={
    v:2,trim:{in:0,out:6000},cutRanges:[],wordFixes:{},captions:{},layout:{mode:'full_frame',shotOverrides:[]},
    sources:[{id:'template_source_2',ref:'upload',refId:'template_slot_2',mediaType:'video',label:'Replaceable clip'}],
    sourceSegments:[{sourceId:'template_source_2',startMs:2000,endMs:4000,inMs:0}],
    transitions:[],textItems:[],broll:[],keyframes:[],audio:{music:null,sfx:[]},
  }
  const definition:UserTemplateDefinitionV1={
    v:1,snapshot:{edits,editsSaveVersion:7,clipStartMs:0,clipEndMs:6000,aspect:'9:16'},
    slots,textFields:[],previewRange:{startMs:0,endMs:5000},
    capabilities:{transitions:false,keyframes:false,sourcePlayback:false,textLayers:false,graphics:false,music:false},
  }
  const manifest:UserTemplateAssetManifestV1={v:1,slots,decorative:[],musicPolicy:'mute'}
  return {definition,manifest}
}

describe('Batch 15 editable-template publication gate',()=>{
  it('accepts a public definition that retains real main/source clip items',()=>{
    const {definition,manifest}=fixture()
    expect(()=>assertUserTemplateEditableStructure(definition,manifest,{public:true})).not.toThrow()
  })

  it('rejects a source slot when its actual source object or timeline segment is lost',()=>{
    const {definition,manifest}=fixture()
    definition.snapshot.edits.sources=undefined
    expect(()=>assertUserTemplateEditableStructure(definition,manifest)).toThrow(/lost its editable media-source object/)
  })

  it('rejects private asset references from public serialization',()=>{
    const {definition,manifest}=fixture()
    definition.snapshot.edits.sources![0]!.refId='private_upload_123'
    expect(()=>assertUserTemplateEditableStructure(definition,manifest,{public:true}))
      .toThrow(/private asset reference/)
  })

  it('allows explicit private decorative dependencies but never publicizes them',()=>{
    const {definition,manifest}=fixture()
    manifest.decorative=[{key:'font:font_secret',kind:'font',assetId:'font_secret',redistributionCleared:false}]
    expect(()=>assertUserTemplateEditableStructure(definition,manifest)).not.toThrow()
    expect(()=>assertUserTemplateEditableStructure(definition,manifest,{public:true}))
      .toThrow(/private decorative dependencies/)
  })

  it('rejects public SFX and Studio Sound until redistribution rights are cleared',()=>{
    const {definition,manifest}=fixture()
    definition.snapshot.edits.audio={music:null,sfx:[{generationId:'private_sfx',startMs:100,endMs:400,volume:1}] as any}
    expect(()=>assertUserTemplateEditableStructure(definition,manifest,{public:true}))
      .toThrow(/SFX\/Studio Sound/)
  })

  it('rejects dangling editable keyframes instead of flattening their animation',()=>{
    const {definition,manifest}=fixture()
    definition.snapshot.edits.keyframes=[{target:'text:missing',prop:'x',frames:[{ms:100,value:10}]}] as any
    expect(()=>assertUserTemplateEditableStructure(definition,manifest)).toThrow(/text keyframe target/)
  })

  it('rejects corrupt slot-local speed/hold plans',()=>{
    const {definition,manifest}=fixture()
    definition.snapshot.edits.sourceSegments![0]!.playback={
      outputFrames:60,pieces:[{kind:'play',frames:30,rate:1}],
    } as any
    expect(()=>assertUserTemplateEditableStructure(definition,manifest)).toThrow(/speed\/hold plan/)
  })

  it('requires public templates to replace the main source instead of retaining it privately',()=>{
    const {definition,manifest}=fixture()
    definition.slots=definition.slots.filter(s=>s.target.kind!=='main')
    manifest.slots=manifest.slots.filter(s=>s.target.kind!=='main')
    expect(()=>assertUserTemplateEditableStructure(definition,manifest,{public:true}))
      .toThrow(/replaceable main-source clip/)
  })
})
