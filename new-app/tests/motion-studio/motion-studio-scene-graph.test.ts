import { describe, expect, it } from 'vitest'
import { validateMotionSceneGraph } from '@/lib/motion-studio/scene-graph'
import { validatePortableManifest } from '@/lib/motion-studio/portable-contract'

const sha = 'b'.repeat(64)
const asset = 'bnd_scene_v1'
const graph = () => ({
  schema: 'transovo.motion-scene-graph/1' as const,
  rootId: 'comp',
  durationMs: 5000,
  nodes: [
    { id:'comp',name:'Documentary scene',kind:'composition',properties:{} },
    { id:'group',name:'Title system',kind:'group',parentId:'comp',properties:{} },
    {
      id:'headline',name:'Headline',kind:'text',parentId:'group',
      properties:{
        position:{type:'vec2',value:[400,200],keyframes:[
          {id:'kf_1',timeMs:0,value:[400,200],interpolation:'bezier',easing:{out:[0.2,0.3]}},
          {id:'kf_2',timeMs:800,value:[600,200],interpolation:'linear'},
        ]},
        title:{type:'text',value:'Breaking News',editable:true},
      },
      effects:[{id:'glow1',type:'glow',enabled:true,properties:{
        radius:{type:'number',value:15,keyframes:[
          {id:'kf_glow1',timeMs:0,value:0},
          {id:'kf_glow2',timeMs:1200,value:15},
        ]},
      }}],
    },
    {id:'procedural',name:'Grokbot custom Three.js scene',kind:'component',
      parentId:'comp',properties:{},component:{engine:'three.js',sourceAssetId:asset}},
  ],
})
const portable = (motionTree?: unknown) => ({
  format:'motion-studio-portable/1',projectId:'project_1',
  assets:[{id:asset,sha256:sha,kind:'bundle'}],
  scenes:[{id:'scene_1',bundleAssetId:asset,bundleSha256:sha,engine:'three.js',runtime:'browser',
    manifest:{elements:[{id:'title',kind:'text',properties:{
      text:{tier:'live_editable',type:'text',default:'Original'},
    }}],...(motionTree===undefined?{}:{motionTree})}}],
})

describe('Motion Studio backward-compatible scene graph contract',()=>{
  it('accepts old editable scene formats without a motion tree',()=>{
    expect(validatePortableManifest(portable()).scenes[0]!.manifest.motionTree).toBeUndefined()
  })
  it('accepts nested layers, keyframes, effects and engine-owned components',()=>{
    const result=validatePortableManifest(portable(graph()))
    expect(result.scenes[0]!.manifest.motionTree?.nodes.length).toBe(4)
    expect(validateMotionSceneGraph(graph(),[asset]).rootId).toBe('comp')
  })
  it('rejects cyclic or disconnected parent relationships',()=>{
    const cycle=graph()
    cycle.nodes[1]!.parentId='headline'
    expect(()=>validateMotionSceneGraph(cycle,[asset])).toThrow(/cycle/)
    const orphan=graph()
    orphan.nodes[1]!.parentId='missing'
    expect(()=>validateMotionSceneGraph(orphan,[asset])).toThrow(/missing parent/)
  })
  it('refuses source references absent from the immutable asset manifest',()=>{
    const unregistered=graph()
    unregistered.nodes[3]!.component!.sourceAssetId='bnd_unknown'
    expect(()=>validatePortableManifest(portable(unregistered))).toThrow(/component reference/)
  })
  it('rejects repeated object and effect IDs and invalid keys',()=>{
    const duplicate=graph()
    duplicate.nodes[1]!.id='comp'
    expect(()=>validateMotionSceneGraph(duplicate,[asset])).toThrow(/duplicate node/)
    const effectDup=graph()
    effectDup.nodes[2]!.effects!.push({...effectDup.nodes[2]!.effects![0]!})
    expect(()=>validateMotionSceneGraph(effectDup,[asset])).toThrow(/duplicate effect/)
  })
  it('rejects unbounded keyframes and structurally invalid animated properties',()=>{
    const unsorted=graph()
    const position=unsorted.nodes[2]!.properties!.position as {keyframes:{timeMs:number}[]}
    position.keyframes[1]!.timeMs=0
    expect(()=>validateMotionSceneGraph(unsorted,[asset])).toThrow(/out-of-order keyframe/)
    const escaped=graph()
    escaped.nodes[2]!.properties!.title={type:'text',value:'file:///workspace/secrets'}
    expect(()=>validateMotionSceneGraph(escaped,[asset])).toThrow(/unsafe or oversized/)
  })
})
