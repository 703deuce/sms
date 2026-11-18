import {describe,expect,it} from 'vitest'
import type {MsPortableManifest} from '../../lib/motion-studio/portable-contract'
import {normalizeUniversalTimeline,visualsAt,captionsAt,gainFromDb} from '../../lib/motion-studio/universal-timeline'
import {readTimelineCaptions} from '../../lib/motion-studio/universal-captions'
const manifest:MsPortableManifest={
  format:'motion-studio-portable/1',projectId:'msp_example',
  assets:[],scenes:[{id:'S1',bundleAssetId:'bnd_example',bundleSha256:'a'.repeat(64),
    engine:'browser',runtime:'chrome',manifest:{elements:[]}}],
  timeline:{nativeScenePlacements:[{sceneId:'S1',timeline:{startSec:0,endSec:2.3,frames:69}}]},
}
describe('Universal timeline playback contract',()=>{
  it('preserves a 2.3-second legacy scene rather than rounding to two seconds',()=>{
    const result=normalizeUniversalTimeline(manifest)
    expect(result.visuals[0]).toMatchObject({sceneId:'S1',startMs:0,durationMs:2300})
    expect(result.durationMs).toBe(2300)
  })
  it('plays original footage, scenes, audio stems and captions on one clock',()=>{
    const project:MsPortableManifest={...manifest,liveProject:{
      schema:'transovo.live-project/1',projectId:'msp_example',
      format:{width:480,height:854,fps:30,durationMs:10000},
      tracks:[
        {id:'visual',kind:'visual',items:[
          {id:'S1',type:'scene',startMs:0,durationMs:2300,sceneInMs:0},
          {id:'uploaded',type:'video',assetId:'ast_original',startMs:2300,durationMs:7700,inMs:500}]},
        {id:'main_voice',kind:'audio',gainDb:-3,items:[
          {id:'voice1',type:'audio',src:'ast_voice',startMs:0,durationMs:10000,inMs:0,gainDb:1,muted:false}]},
        {id:'text',kind:'text',captions:'ast_captions',items:[
          {id:'cap1',type:'caption',text:'Watch this',startMs:2000,durationMs:1000,endMs:3000}]},
      ],
    }}
    const result=normalizeUniversalTimeline(project)
    expect(result).toMatchObject({width:480,height:854,fps:30,durationMs:10000,
      captionsAssetIds:['ast_captions']})
    expect(result.visuals).toHaveLength(2)
    expect(result.audio[0]).toMatchObject({assetId:'ast_voice',gainDb:-2})
    expect(visualsAt(result,2400)[0]).toMatchObject({type:'video',assetId:'ast_original'})
    expect(captionsAt(result,2400).map(c=>c.text)).toEqual(['Watch this'])
    expect(captionsAt(result,3500)).toEqual([])
  })
  it('accepts out-of-order caption cues in VTT without embedding video pixels',()=>{
    const cues=readTimelineCaptions('WEBVTT\\n\\n00:00:02.300 --> 00:00:03.500\\nAn editable caption')
    expect(cues[0]).toMatchObject({startMs:2300,endMs:3500,text:'An editable caption'})
    expect(gainFromDb(-6)).toBeCloseTo(0.501187,5)
  })
})
