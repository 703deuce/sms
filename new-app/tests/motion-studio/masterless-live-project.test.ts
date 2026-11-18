import {describe,it,expect} from 'vitest'
import {validateNativeProducerEnvelope,adaptProducerProject} from '../../lib/motion-studio/producer-project-adapter'
import {buildDeterministicProducerJob} from '../../lib/motion-studio/producer-render-job'
import {validatePortableManifest} from '../../lib/motion-studio/portable-contract'

const sha='a'.repeat(64)
const document={
  schema:'transovo.motion-project/1',projectId:'msp_live',version:1,
  parentVersion:null,format:{width:480,height:854,fps:30},
  scenes:[{sceneId:'S1',bundle:'bnd_S1',timeline:{startSec:0,endSec:2.3,frames:69}}],
  theme:{colors:{accent:'#ffffff'}},overrides:{scenes:{}},
  assetRefs:['bnd_S1'],master:null,
}
const assets=[{id:'bnd_S1',storageId:'up_S1',sha256:sha,kind:'bundle'}]
const bundles=[{sceneId:'S1',bundleId:'bnd_S1',sha256:sha,
  engine:'browser',runtime:'chrome',manifest:{elements:[]}}]
const liveProject={
  schema:'transovo.live-project/1',projectId:'msp_live',
  format:{width:480,height:854,fps:30,durationMs:2300},
  tracks:[{id:'main_visuals',kind:'visual',items:[
    {id:'S1',type:'scene',startMs:0,durationMs:2300},
    {id:'S1.plate',type:'sceneLayer',sceneId:'S1',elementId:'plate',
      startMs:0,endMs:2300,label:'Footage',kind:'video'},
  ]}],
}
describe('live source import and on-demand export',()=>{
  it('validates a real original scene without a master or scene MP4',()=>{
    const doc=validateNativeProducerEnvelope(document)
    expect(doc.master).toBeNull()
    expect(doc.scenes[0]?.clip).toBeUndefined()
    const manifest=adaptProducerProject({document,assets,bundles})
    const project=validatePortableManifest({...manifest,liveProject})
    expect(project.scenes[0]?.bundleAssetId).toBe('up_S1')
    const job=buildDeterministicProducerJob({
      manifest:project,theme:document.theme,overrides:document.overrides,
    })
    expect(job.renderFromBundles).toBe(true)
    expect(job.delivery).toBe('live')
    expect(job.output.master).toBe(true)
  })
  it('still refuses unknown source bundles',()=>{
    expect(()=>adaptProducerProject({document,assets:[],bundles})).toThrow()
  })
})
