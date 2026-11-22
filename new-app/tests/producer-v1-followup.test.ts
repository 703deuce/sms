import {describe,it,expect} from 'vitest'
import {sanitizeProductionBrief} from '@/lib/motion-studio/production-brief'
import {requestedProducerClipCount,validProducerDiscoveryClipCount} from '@/lib/clips/producer-clip-count'
import {producerRenderState} from '@/lib/clips/producer-render-state'
import {exportLoudnessLufs} from '@/lib/clips/speech-leveling'

const legacy={
  prompt:'Make a documentary',workflow:'idea',videoType:'anything',durationSeconds:180,
  aspectRatio:'16:9',resolution:'480p',style:{id:'automatic'},
  narration:{mode:'ai_voice'},music:{mode:'none'},inputs:[],
}

describe('B0 existing film and clip contracts',()=>{
  it('legacy film brief has no new BYO keys (byte-identical default shape)',()=>{
    const original=sanitizeProductionBrief(legacy)
    expect(JSON.stringify(original)).not.toContain('reviewPlan')
    expect(JSON.stringify(original)).not.toContain('captionsEnabled')
    expect(JSON.stringify(original)).not.toContain('voiceoverAmount')
    expect(JSON.stringify(original)).not.toContain('footageType')
    expect(original.narration.mode).toBe('ai_voice')
    expect(original.workflow).toBe('idea')
  })
  it('legacy second-camera / extras roles are first-class picture assets',()=>{
    const footage=sanitizeProductionBrief({...legacy,workflow:'footage',
      inputs:[
        {uploadId:'upl_cam',filename:'a.mp4',mime:'video/mp4',role:'footage'},
        {uploadId:'upl_angle',filename:'b.mp4',mime:'video/mp4',role:'angle'},
        {uploadId:'upl_extra',filename:'c.mp4',mime:'video/mp4',role:'broll'},
      ]})
    expect(footage.narration.mode).toBe('ai_voice')
    expect(footage.inputs.map(x=>x.handling)).toEqual([
      'use_as_picture','use_as_picture','use_as_picture'])
  })
  it('explicit BYO fields survive sanitization while omitted fields do not appear',()=>{
    const b=sanitizeProductionBrief({...legacy,workflow:'footage',
      narration:{mode:'none'},reviewPlan:false,captionsEnabled:false,
      voiceoverAmount:'none',footageType:'Podcast',goal:'A short story',
      callToAction:'Visit us'})
    expect(b.narration).toMatchObject({mode:'none',handling:'no_narration'})
    expect(b.reviewPlan).toBe(false)
    expect(b.captionsEnabled).toBe(false)
    expect(b.goal).toBe('A short story')
  })
  it('cloned voice requires an authenticated saved choice',()=>{
    expect(()=>sanitizeProductionBrief({...legacy,narration:{mode:'cloned_voice'}}))
      .toThrow('Select a saved voice')
  })
})

describe('clip producer counts and lifecycle',()=>{
  it('requested clip ceiling is 30 and reaches producer inputs',()=>{
    expect(validProducerDiscoveryClipCount(30)).toBe(true)
    expect(validProducerDiscoveryClipCount(31)).toBe(false)
    expect(requestedProducerClipCount({maximumClips:30},{autoGrokMaxClips:5}))
      .toBe(30)
    expect(requestedProducerClipCount(null,{autoGrokMaxClips:5})).toBe(5)
    expect(requestedProducerClipCount({maximumClips:35},{})).toBe(30)
  })
  it('uncreated queue row is queued, not failed',()=>{
    expect(producerRenderState({ready:false,renderStatus:null})).toBe('queued')
    expect(producerRenderState({ready:false,renderStatus:'QUEUED'})).toBe('queued')
    expect(producerRenderState({ready:false,renderStatus:'RENDERING'})).toBe('rendering')
    expect(producerRenderState({ready:false,renderStatus:'FAILED'})).toBe('failed')
    expect(producerRenderState({ready:false,enqueueError:'queue_unavailable'})).toBe('failed')
    expect(producerRenderState({ready:true,renderStatus:'READY'})).toBe('done')
  })
})

describe('stored loudness target',()=>{
  it('does not silently substitute -14 for a -15 producer or film target',()=>{
    expect(exportLoudnessLufs({speechLevelingEnabled:true,loudnessLufs:-15})).toBe(-15)
    expect(exportLoudnessLufs({speechLevelingEnabled:true,loudnessLufs:-14})).toBe(-14)
    expect(exportLoudnessLufs({speechLevelingEnabled:false,loudnessLufs:-15})).toBeUndefined()
    expect(exportLoudnessLufs({speechLevelingEnabled:true})).toBe(-15)
  })
})
