import {describe,expect,it} from 'vitest'
import {adaptProducerProject} from '@/lib/motion-studio/producer-project-adapter'
import {buildDeterministicProducerJob} from '@/lib/motion-studio/producer-render-job'
const hex=(c:string)=>c.repeat(64)
const assets=[
  {id:'bnd_one',storageId:'upload_1',sha256:hex('a'),kind:'bundle'},
  {id:'ast_clip',storageId:'upload_2',sha256:hex('b'),kind:'video'},
  {id:'ast_master',storageId:'upload_3',sha256:hex('c'),kind:'video'},
  {id:'ast_recipe',storageId:'upload_4',sha256:hex('d'),kind:'project'},
]
const source={
  schema:'transovo.motion-project/1',projectId:'proj_1',version:3,parentVersion:2,
  format:{width:1920,height:1080,fps:30},
  scenes:[{sceneId:'S01',bundle:'bnd_one',clip:{asset:'ast_clip',renderKey:'rk'},
    timeline:{startMs:0,endMs:5000}}],
  theme:{colors:{accent:{value:'#FF0000',label:'Accent'}},fonts:{display:{faces:[],weight:400}}},
  overrides:{schema:'transovo.edit-patch/1',scenes:{}},
  master:{asset:'ast_master',recipe:'ast_recipe'},assetRefs:assets.map(a=>a.id),
}
const bundle=[{sceneId:'S01',bundleId:'bnd_one',sha256:hex('a'),engine:'browser',runtime:'ms-props',
  manifest:{elements:[{id:'headline',kind:'text',properties:{
    text:{tier:'live_editable' as const,type:'text' as const,default:'Original'},
  }}]}}]
const manifest=adaptProducerProject({document:source,assets,bundles:bundle})
describe('deterministic edit dispatch compatibility',()=>{
  it('rerenders a changed scene without modifying producer v3',()=>{
    const job=buildDeterministicProducerJob({manifest,theme:source.theme,
      overrides:{scenes:{S01:{elements:{headline:{text:'New headline'}}}}}})
    expect(job).toMatchObject({
      schema:'transovo.motion-job/1',mode:'deterministic_render',
      baseVersion:3,projectId:'proj_1',output:{master:true,previews:true},
      edits:{schema:'transovo.edit-patch/1',scenes:{S01:{elements:{headline:{text:'New headline'}}}}},
    })
    expect(source.scenes[0]!.clip.asset).toBe('ast_clip')
  })
  it('sends only changed theme tokens rather than overwriting fonts or labels',()=>{
    const theme={...source.theme,colors:{accent:{value:'#00FF00',label:'Accent'}}}
    const job=buildDeterministicProducerJob({manifest,theme,overrides:{scenes:{}}})
    expect(job.edits.theme).toEqual({colors:{accent:{value:'#00FF00',label:'Accent'}}})
    expect(job.edits.scenes).toBeUndefined()
  })
  it('rejects missing edits and foreign scene IDs',()=>{
    expect(()=>buildDeterministicProducerJob({manifest,theme:source.theme,overrides:{scenes:{}}})).toThrow(/no deterministic edits/)
    expect(()=>buildDeterministicProducerJob({manifest,theme:source.theme,
      overrides:{scenes:{S99:{elements:{headline:{text:'Wrong'}}}}}})).toThrow(/unknown scene/)
  })
})
