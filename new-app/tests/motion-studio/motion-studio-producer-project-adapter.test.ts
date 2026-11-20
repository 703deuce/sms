import { describe, expect, it } from 'vitest'
import { adaptProducerProject, validateNativeProducerEnvelope } from '@/lib/motion-studio/producer-project-adapter'

const hash=(ch:string)=>ch.repeat(64)
const assets=[
  {id:'bnd_first',sha256:hash('a'),kind:'bundle'},
  {id:'ast_clip',sha256:hash('b'),kind:'video'},
  {id:'ast_master',sha256:hash('c'),kind:'video'},
  {id:'ast_recipe',sha256:hash('d'),kind:'project'},
  {id:'fnt_display',sha256:hash('e'),kind:'font'},
  {id:'ast_narration',sha256:hash('f'),kind:'audio'},
]
const document=()=>({
  schema:'transovo.motion-project/1' as const,
  projectId:'production_1',version:1,parentVersion:null,
  format:{width:1920,height:1080,fps:30},
  scenes:[{sceneId:'S01',bundle:'bnd_first',clip:{asset:'ast_clip',renderKey:'rk_1'},
    timeline:{startMs:0,endMs:4000}}],
  theme:{schema:'transovo.motion-theme/1',colors:{accent:{value:'#ABCDEF',label:'Accent'}},
    fonts:{display:{faces:['fnt_display'],weight:400}}},
  overrides:{schema:'transovo.edit-patch/1',scenes:{}},
  master:{asset:'ast_master',recipe:'ast_recipe',renderKey:'mk_1'},
  sources:{narration:{asset:'ast_narration'},music:[],captions:'ast_narration'},
  runtimeLock:'ast_recipe',
  fontRecords:[{fontId:'fnt_display',family:'Example'}],
  assetRefs:assets.map(x=>x.id),
})
const bundles=[{sceneId:'S01',bundleId:'bnd_first',sha256:hash('a'),engine:'browser',
  runtime:'ms-props',
  manifest:{elements:[{id:'title',kind:'text',properties:{
    text:{tier:'live_editable' as const,type:'text' as const,default:'Title'},
  }}]},
  dependencies:['fnt_display']}]
describe('native producer project -> editable portable project',()=>{
  it('preserves master, narration, font data, timeline and engine source',()=>{
    const original=document()
    const m=adaptProducerProject({document:original,assets,bundles})
    expect(m.scenes).toHaveLength(1)
    expect(m.scenes[0]?.bundleAssetId).toBe('bnd_first')
    expect((m as unknown as {producerDocument:unknown}).producerDocument).toEqual(original)
    expect(m.audio).toEqual(original.sources)
    expect(m.timeline).toMatchObject({nativeScenePlacements:[{sceneId:'S01',timeline:{startMs:0,endMs:4000}}]})
  })
  it('maps producer content IDs to Transovo upload IDs and preserves native references',()=>{
    const mapped=assets.map((a,i)=>({...a,storageId:'upload_'+(i+1)}))
    const m=adaptProducerProject({document:document(),assets:mapped,bundles})
    expect(m.scenes[0]?.bundleAssetId).toBe('upload_1')
    expect(m.scenes[0]?.dependencies).toEqual(['upload_5'])
    expect(m.assets.map(x=>x.id)).toEqual(mapped.map(x=>x.storageId))
    expect((m as unknown as {producerAssetMap:Record<string,string>}).producerAssetMap.fnt_display).toBe('upload_5')
    expect((m as unknown as {producerDocument:ReturnType<typeof document>}).producerDocument.assetRefs).toContain('fnt_display')
  })
  it('accepts a render-first live document with an unrendered master recipe',()=>{
    const live={...document(),delivery:{mode:'live'},
      master:{recipe:'ast_recipe',renderedInVersion:0,origin:'live_delivery'}}
    const m=adaptProducerProject({document:live,assets,bundles})
    expect((m as unknown as {producerDocument:unknown}).producerDocument).toEqual(live)
  })
  it('still refuses a rendered master without its asset',()=>{
    expect(()=>validateNativeProducerEnvelope({...document(),
      master:{recipe:'ast_recipe',renderedInVersion:1}})).toThrow(/envelope/)
    expect(()=>validateNativeProducerEnvelope({...document(),
      master:{asset:'ast_master'}})).toThrow(/envelope/)
  })
  it('refuses missing referenced media rather than silently omitting',()=>{
    expect(()=>adaptProducerProject({document:document(),assets:assets.slice(1),bundles})).toThrow()
  })
  it('refuses a scene bundle that does not match original scene or hash',()=>{
    expect(()=>adaptProducerProject({document:document(),assets,
      bundles:[{...bundles[0]!,sha256:hash('b')}]})).toThrow(/SHA-256 mismatch/)
  })
  it('refuses unregistered scene dependencies',()=>{
    expect(()=>adaptProducerProject({document:document(),assets,
      bundles:[{...bundles[0]!,dependencies:['ast_unknown']}]})).toThrow(/dependency missing/)
  })
  it('refuses a malformed native version or duplicated scene',()=>{
    expect(()=>validateNativeProducerEnvelope({...document(),version:0})).toThrow()
    const original=document()
    expect(()=>validateNativeProducerEnvelope({...original,scenes:[...original.scenes,...original.scenes]})).toThrow()
  })
})
