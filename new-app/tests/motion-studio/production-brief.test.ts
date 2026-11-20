import {describe,it,expect} from 'vitest'
import {sanitizeProductionBrief} from '../../lib/motion-studio/production-brief'

describe('Motion Studio typed producer brief',()=>{
 const base={prompt:'Research the story of a hometown music legend',videoType:'documentary',
   durationSeconds:120,aspectRatio:'16:9',resolution:'720p',style:{id:'automatic'}}
 it('prompt-only Start enables paid music and AI narrator without a gate',()=>{
  const brief=sanitizeProductionBrief(base)
  expect(brief.prompt).toBe(base.prompt)
  expect(brief.narration).toMatchObject({mode:'ai_voice',handling:'tts_auto_voice'})
  expect(brief.music).toMatchObject({mode:'elevenlabs',handling:'paid_generate'})
  expect(brief.referenceLinks).toBeUndefined()
 })
 it('keeps exact text, opinion, two source links, music upload and talking head',()=>{
  const brief=sanitizeProductionBrief({...base,script:{text:'My words',handling:'exact'},
   commentary:{text:'In my view he deserves more recognition'},
   referenceLinks:[{url:'https://example.com/interview',note:'Exclusive interview'},
     {url:'https://example.org/history',note:'Historical context'}],
   music:{mode:'upload',uploadId:'upl_music',placement:'Under the outro only'},
   narration:{mode:'talking_head',uploadId:'upl_camera'},
   inputs:[{uploadId:'upl_camera',filename:'camera.mp4',mime:'video/mp4',role:'talking_head'},
      {uploadId:'upl_music',filename:'bed.mp3',mime:'audio/mpeg',role:'music'}]})
  expect(brief.script?.handling).toBe('exact')
  expect(brief.commentary?.handling).toBe('creator_opinion')
  expect(brief.referenceLinks).toHaveLength(2)
  expect(brief.referenceLinks?.[0].handling).toBe('include_in_research')
  expect(brief.narration.handling).toBe('preserve_talking_head')
  expect(brief.inputs.find(x=>x.role==='talking_head')?.handling)
    .toBe('preserve_picture_and_sound_add_cutaways')
  expect(brief.music.handling).toBe('use_uploaded_track')
 })
 it('honors draft improvement while keeping original prompt and only requested inputs',()=>{
  const brief=sanitizeProductionBrief({...base,script:{text:'Draft text',handling:'improve'}})
  expect(brief.prompt).toBe(base.prompt)
  expect(brief.script?.handling).toBe('improve')
  expect(brief.inputs).toEqual([])
 })
 it('voiceover uses the actual recorded audio and uploaded_narration role',()=>{
  const brief=sanitizeProductionBrief({...base,
   narration:{mode:'uploaded_narration'},
   inputs:[{uploadId:'upl_a',filename:'original.wav',mime:'audio/wav',role:'narration'}]})
  expect(brief.narration).toMatchObject({uploadId:'upl_a',handling:'voiceover_drives_timing'})
 })
 it('retains explicit Auto-select even when no voice ID is attached',()=>{
  const brief=sanitizeProductionBrief({...base,narration:{mode:'ai_voice',voiceSource:'auto'}})
  expect(brief.narration.voiceSource).toBe('auto')
  expect(brief.narration.voiceId).toBeUndefined()
  expect(brief.narration.handling).toBe('tts_auto_voice')
 })
 it('requires chosen cloned voice and never silently substitutes a stock voice',()=>{
  expect(()=>sanitizeProductionBrief({...base,narration:{mode:'cloned_voice'}}))
    .toThrow(/saved voice/)
  expect(()=>sanitizeProductionBrief({...base,narration:{mode:'cloned_voice',
    voiceId:'my_clone_id',voiceSource:'stock'}})).toThrow(/cloned/)
  const clone=sanitizeProductionBrief({...base,narration:{mode:'cloned_voice',
    voiceId:'my_clone_id',voiceSource:'cloned'}})
  expect(clone.narration.handling).toBe('tts_with_voice_id')
 })
 it('rejects media-role mismatches and unsafe reference URLs',()=>{
  expect(()=>sanitizeProductionBrief({...base,inputs:[
   {uploadId:'upl_one',filename:'voice.mp3',mime:'audio/mpeg',role:'talking_head'}]}))
   .toThrow(/Camera footage/)
  expect(()=>sanitizeProductionBrief({...base,referenceLinks:[{url:'file:///etc/passwd'}]}))
   .toThrow(/web URLs/)
 })
 it('keeps customer-selected no music explicit even with uploaded music',()=>{
  const brief=sanitizeProductionBrief({...base,music:{mode:'none'},
   inputs:[{uploadId:'upl_m',filename:'music.wav',mime:'audio/wav',role:'music'}]})
  expect(brief.music.handling).toBe('no_music')
 })
})
