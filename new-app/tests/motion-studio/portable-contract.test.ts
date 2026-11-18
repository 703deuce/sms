import {describe,it,expect} from 'vitest'
import {validatePortableManifest,validateScenePropertyPatch,validateThemePatch} from '../../lib/motion-studio/portable-contract'
const sha='a'.repeat(64)
const make=()=>({
  format:'motion-studio-portable/1',projectId:'msp_real',assets:[
    {id:'bnd_S01',sha256:sha,kind:'bundle'},
    {id:'ast_logo',sha256:sha,kind:'image'},
  ],
  scenes:[{
    id:'S01',bundleAssetId:'bnd_S01',bundleSha256:sha,engine:'threejs',
    runtime:'chrome-156',dependencies:['ast_logo'],
    manifest:{elements:[
      {id:'title',kind:'dom',properties:{
        text:{tier:'live_editable',type:'text',maxChars:30},
        color:{tier:'live_editable',type:'color'},
        font:{tier:'live_editable',type:'font'},
        scale:{tier:'render_editable',type:'number',min:0.5,max:2},
        camera:{tier:'protected',type:'point'},
        animation:{tier:'ai_editable',type:'enum',choices:['orbit','push']},
      }},
      {id:'portrait',kind:'webgl-mesh',properties:{
        image:{tier:'live_editable',type:'image'},
        focalPoint:{tier:'live_editable',type:'point'},
      }},
    ]},
  }],
})
describe('portable project contract',()=>{
  it('accepts a real scene bundle and preserves engine identity',()=>{
    const m=validatePortableManifest(make())
    expect(m.scenes[0]!.engine).toBe('threejs')
  })
  it('refuses local paths and signed URLs in persistent manifests',()=>{
    expect(()=>validatePortableManifest({...make(),timeline:{url:'https://x/?access_token=secret'}})).toThrow()
    expect(()=>validatePortableManifest({...make(),timeline:{path:'/workspace/me/file'}})).toThrow()
  })
  it('requires bundle source to be registered',()=>{
    const m=make();m.scenes[0]!.bundleAssetId='missing'
    expect(()=>validatePortableManifest(m)).toThrow()
  })
  it('rejects duplicate scene ids',()=>{
    const m=make();m.scenes.push({...m.scenes[0]!})
    expect(()=>validatePortableManifest(m)).toThrow()
  })
  it('allows safe text/color/font edits without changing animation',()=>{
    const m=validatePortableManifest(make())
    expect(validateScenePropertyPatch(m,'S01',{title:{
      text:'THE LEXICON',color:'#ffbbaa',font:'engine:Playfair-900',
    }},'live').requiresRender).toBe(false)
  })
  it('flags render-editable values and refuses them in live preview',()=>{
    const m=validatePortableManifest(make())
    expect(validateScenePropertyPatch(m,'S01',{title:{scale:1.2}},'render').requiresRender).toBe(true)
    expect(()=>validateScenePropertyPatch(m,'S01',{title:{scale:1.2}},'live')).toThrow()
  })
  it('refuses changes to motion and camera properties',()=>{
    const m=validatePortableManifest(make())
    expect(()=>validateScenePropertyPatch(m,'S01',{title:{animation:'orbit'}})).toThrow()
    expect(()=>validateScenePropertyPatch(m,'S01',{title:{camera:{x:0,y:0}}})).toThrow()
  })
  it('validates numeric and text bounds',()=>{
    const m=validatePortableManifest(make())
    expect(()=>validateScenePropertyPatch(m,'S01',{title:{text:'X'.repeat(31)}})).toThrow()
    expect(()=>validateScenePropertyPatch(m,'S01',{title:{scale:3}})).toThrow()
  })
  it('allows only project assets as image replacements',()=>{
    const m=validatePortableManifest(make())
    expect(validateScenePropertyPatch(m,'S01',{portrait:{image:'ast_logo'}}).patch.portrait?.image).toBe('ast_logo')
    expect(()=>validateScenePropertyPatch(m,'S01',{portrait:{image:'foreign_logo'}})).toThrow()
  })
  it('validates normalized focal points',()=>{
    const m=validatePortableManifest(make())
    expect(()=>validateScenePropertyPatch(m,'S01',{portrait:{focalPoint:{x:2,y:0}}})).toThrow()
    expect(validateScenePropertyPatch(m,'S01',{portrait:{focalPoint:{x:0.2,y:0.7}}}).patch.portrait?.focalPoint).toEqual({x:0.2,y:0.7})
  })
  it('accepts clearing overrides for theme inheritance',()=>{
    const m=validatePortableManifest(make())
    expect(validateScenePropertyPatch(m,'S01',{title:{color:null}}).patch.title?.color).toBeNull()
  })
  it('permits project theme colors without preset font families',()=>{
    expect(validateThemePatch({colors:{primary:'#c0ffee'},fonts:{display:'engine:Anton'}})).toEqual({
      colors:{primary:'#c0ffee'},fonts:{display:'engine:Anton'},
    })
    expect(()=>validateThemePatch({colors:{primary:'red'}})).toThrow()
  })
  it('accepts bounded graph layer timing and position edits as a no-render save patch',()=>{
    const input=make()
    const scene=input.scenes[0]!
    const m=validatePortableManifest({...input,scenes:[{
      ...scene,manifest:{...scene.manifest,motionTree:{
        schema:'transovo.motion-scene-graph/1',rootId:'root',durationMs:2300,
        nodes:[
          {id:'root',name:'Scene',kind:'composition',properties:{}},
          {id:'title',name:'Date title',kind:'text',parentId:'root',startMs:0,endMs:2300,properties:{}},
        ],
      }},
    }]})
    const edited=validateScenePropertyPatch(m,'S01',{title:{startMs:300,endMs:1800}},'render')
    expect(edited.patch.title).toEqual({startMs:300,endMs:1800})
    expect(edited.requiresRender).toBe(false)
    expect(()=>validateScenePropertyPatch(m,'S01',{title:{startMs:2400}})).toThrow()
    expect(()=>validateScenePropertyPatch(m,'S01',{title:{endMs:0}})).toThrow()
  })

})
