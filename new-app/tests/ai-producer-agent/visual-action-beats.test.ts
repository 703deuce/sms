import { describe,expect,it } from 'vitest'
import {
  buildVisualBeatCandidates,validateStoryVisualBeats,resolveVisualActionRequests,
  combineSpeechWithVisualActions,recoverVisualActionRequests,
} from '@/lib/ai-producer-agent/visual-action-beats'
import type { VisualMomentEvidence } from '@/lib/ai-producer-agent/visual-evidence'
import type { ClipWord } from '@/lib/clips/edits'

const evidence=(start:number,end:number,observation:string,tier:'coarse_3s'|'focused_1fps'='focused_1fps'):VisualMomentEvidence=>({
  sourceRangeMs:[start,end],observation,whyInteresting:'funny physical reaction',
  category:'action',spokenContext:'',analysisTier:tier,
})
const words:ClipWord[]=[
  {w:'hello',s:1,e:1.7},{w:'there',s:1.7,e:2.1},
  {w:'next',s:20,e:20.4},{w:'package',s:20.4,e:21},
]
const bounds:[number,number]=[0,40_000]

describe('Story visual beats and Footage source-time actions',()=>{
  const candidates=buildVisualBeatCandidates([
    evidence(5000,16000,'opens package slowly','coarse_3s'),
  ],[
    evidence(5200,15200,'fights stubborn box tape'),
    evidence(26000,33000,'surprised look at gift'),
  ])
  it('supplies time-stamped visual candidates, preferring the focused duplicate',()=>{
    expect(candidates).toHaveLength(2)
    expect(candidates[0]!.observation).toBe('fights stubborn box tape')
    expect(candidates[0]!.id).toBe('visual_0')
    expect(candidates[1]!.sourceRangeMs).toEqual([26000,33000])
  })
  it('Story must choose actual observed visual beat IDs, never invent them',()=>{
    const story=validateStoryVisualBeats([{id:'visual_0',whyFunnyToWatch:'funny frustration',narrativePurpose:'build before reveal'}],candidates)
    expect(story).toHaveLength(1)
    expect(()=>validateStoryVisualBeats([{id:'visual_fake',whyFunnyToWatch:'x',narrativePurpose:'x'}],candidates)).toThrow('unverified')
    expect(()=>validateStoryVisualBeats([{id:'visual_0',whyFunnyToWatch:'x',narrativePurpose:'x'},{id:'visual_0',whyFunnyToWatch:'x',narrativePurpose:'x'}],candidates)).toThrow('unverified')
  })
  it('selects a silent physical beat at exact legal source times with original video/audio intact',()=>{
    const story=validateStoryVisualBeats([{id:'visual_0',whyFunnyToWatch:'physical comedy',narrativePurpose:'build anticipation'}],candidates)
    const actions=resolveVisualActionRequests([{visualBeatId:'visual_0',startMs:6000,endMs:12000,beat:'tape struggle',reason:'keep the visual payoff'}],candidates,story,words,bounds)
    expect(actions).toMatchObject([{kind:'visual_action',visualBeatId:'visual_0',startMs:6000,endMs:12000}])
    const speech=[{startMs:1000,endMs:2100,beat:'setup',reason:'introduction'},
      {startMs:20000,endMs:21000,beat:'reaction',reason:'continuity'}]
    const combined=combineSpeechWithVisualActions(speech,actions,words,bounds)
    expect(combined.cutPlan.map(x=>[x.startMs,x.endMs])).toEqual([[1000,2100],[6000,12000],[20000,21000]])
    expect(combined.included).toHaveLength(1)
    expect(combined.omitted).toHaveLength(0)
  })
  it('rejects invented action spans, wrong Story IDs and mid-word boundaries',()=>{
    const story=validateStoryVisualBeats([{id:'visual_0',whyFunnyToWatch:'funny',narrativePurpose:'context'}],candidates)
    const valid={visualBeatId:'visual_0',startMs:6000,endMs:12000,beat:'physical',reason:'source observation'}
    expect(()=>resolveVisualActionRequests([{...valid,startMs:3000}],candidates,story,words,bounds)).toThrow('outside_observed_source')
    expect(()=>resolveVisualActionRequests([{...valid,visualBeatId:'visual_1'}],candidates,story,words,bounds)).toThrow('missing_story_evidence')
    expect(()=>resolveVisualActionRequests([{...valid,endMs:20_200}],candidates,story,words,bounds)).toThrow()
  })
  it('never duplicates an action already covered by a speech passage',()=>{
    const story=validateStoryVisualBeats([{id:'visual_0',whyFunnyToWatch:'funny',narrativePurpose:'setup'}],candidates)
    const actions=resolveVisualActionRequests([{visualBeatId:'visual_0',startMs:6000,endMs:12000,beat:'action',reason:'keep'}],candidates,story,words,bounds)
    const merged=combineSpeechWithVisualActions([{startMs:4000,endMs:15000,beat:'speech',reason:'kept as complete sentence'}],actions,words,bounds)
    expect(merged.cutPlan).toHaveLength(1)
    expect(merged.omitted[0]?.reason).toBe('covered_by_speech_or_unsafe_edges')
  })
  it('retains the uncovered five-second tape-action tail when a speech cut overlaps its opening',()=>{
    const story=validateStoryVisualBeats([{id:'visual_0',whyFunnyToWatch:'tape',narrativePurpose:'comedy'}],candidates)
    const actions=resolveVisualActionRequests([
      {visualBeatId:'visual_0',startMs:6000,endMs:12000,beat:'tape fight',reason:'actual visual action'},
    ],candidates,story,words,bounds)
    // The incoming action starts inside the spoken passage, but its final
    // ~5s is genuine uncovered source footage that must not be thrown away.
    const merged=combineSpeechWithVisualActions(
      [{startMs:1000,endMs:7000,beat:'dialogue',reason:'original voice'}],actions,words,bounds)
    expect(merged.included).toHaveLength(1)
    expect(merged.included[0]!.startMs).toBeGreaterThanOrEqual(7000)
    expect(merged.included[0]!.endMs).toBe(12000)
    expect(merged.included[0]!.endMs-merged.included[0]!.startMs).toBeGreaterThan(4000)
  })
  it('nudges the uncovered edge off a real spoken word instead of dropping the whole action',()=>{
    const story=validateStoryVisualBeats([{id:'visual_0',whyFunnyToWatch:'tape',narrativePurpose:'comedy'}],candidates)
    const action=resolveVisualActionRequests([
      {visualBeatId:'visual_0',startMs:6000,endMs:12000,beat:'action',reason:'observed'},
    ],candidates,story,words,bounds)
    const wordy:ClipWord[]=[{w:'overlap',s:6.85,e:7.4}]
    const merged=combineSpeechWithVisualActions(
      [{startMs:1000,endMs:7000,beat:'speech',reason:'spoken'}],action,wordy,bounds)
    expect(merged.included).toHaveLength(1)
    expect(merged.included[0]!.startMs).toBeGreaterThan(7430)
    expect(merged.included[0]!.endMs).toBe(12000)
  })
  it('keeps safe nonoverlapping part of a visual event and logs the reduction',()=>{
    const story=validateStoryVisualBeats([{id:'visual_0',whyFunnyToWatch:'funny',narrativePurpose:'setup'}],candidates)
    const actions=resolveVisualActionRequests([{visualBeatId:'visual_0',startMs:6000,endMs:12000,beat:'action',reason:'keep'}],candidates,story,words,bounds)
    const merged=combineSpeechWithVisualActions([{startMs:1000,endMs:8000,beat:'speech',reason:'intro'}],actions,words,bounds)
    expect(merged.included).toMatchObject([{startMs:8000,endMs:12000}])
    expect(merged.cutPlan).toHaveLength(2)
  })
  it('recovers slightly out-of-evidence timestamps without discarding valid word cuts',()=>{
    const story=validateStoryVisualBeats([{id:'visual_0',whyFunnyToWatch:'tape',narrativePurpose:'build up'}],candidates)
    const repaired=recoverVisualActionRequests([
      {visualBeatId:'visual_0',startMs:5100,endMs:15400,beat:'box tape',reason:'visible struggle'},
    ],candidates,story,words,bounds)
    expect(repaired.omitted).toHaveLength(0)
    expect(repaired.selections).toMatchObject([{startMs:5200,endMs:15200,visualBeatId:'visual_0'}])
    expect(repaired.repairs).toHaveLength(1)
  })
  it('repairs action boundaries inside ASR words while keeping the original audio source range',()=>{
    const localWords:ClipWord[]=[
      {w:'opens',s:6.0,e:6.5},{w:'box',s:12.0,e:12.5},
    ]
    const story=validateStoryVisualBeats([{id:'visual_0',whyFunnyToWatch:'reaction',narrativePurpose:'payoff'}],candidates)
    const result=recoverVisualActionRequests([
      {visualBeatId:'visual_0',startMs:6200,endMs:12200,beat:'struggle',reason:'unboxing'},
    ],candidates,story,localWords,bounds)
    expect(result.selections).toHaveLength(1)
    expect(result.repairs).toHaveLength(1)
    expect(result.selections[0]!.startMs).toBeGreaterThanOrEqual(5200)
    expect(result.selections[0]!.endMs).toBeLessThanOrEqual(15200)
    expect(result.selections[0]!.startMs).not.toBe(6200)
    expect(result.selections[0]!.endMs).not.toBe(12200)
  })
  it('skips an unrecoverable visual event but keeps the independently valid dialogue edit',()=>{
    const story=validateStoryVisualBeats([{id:'visual_0',whyFunnyToWatch:'laugh',narrativePurpose:'build'}],candidates)
    const result=recoverVisualActionRequests([
      {visualBeatId:'visual_0',startMs:100,endMs:35_000,beat:'invented span',reason:'too broad'},
      {visualBeatId:'visual_1',startMs:26_500,endMs:31_000,beat:'unapproved',reason:'not in Story'},
    ],candidates,story,words,bounds)
    expect(result.selections).toHaveLength(0)
    expect(result.omitted.map(x=>x.reason)).toEqual([
      'visual_action_outside_observed_source','visual_action_missing_story_evidence',
    ])
    const speech=[{startMs:1000,endMs:2100,beat:'intro',reason:'source words'}]
    expect(combineSpeechWithVisualActions(speech,result.selections,words,bounds).cutPlan).toEqual(speech)
  })
  it('only repairs close to the evidence boundary, never rewrites unrelated video times',()=>{
    const story=validateStoryVisualBeats([{id:'visual_0',whyFunnyToWatch:'tape',narrativePurpose:'payoff'}],candidates)
    const result=recoverVisualActionRequests([
      {visualBeatId:'visual_0',startMs:0,endMs:15_000,beat:'struggle',reason:'wrong source'},
    ],candidates,story,words,bounds)
    expect(result.omitted[0]?.reason).toBe('visual_action_outside_observed_source')
    expect(result.selections).toHaveLength(0)
  })

})
