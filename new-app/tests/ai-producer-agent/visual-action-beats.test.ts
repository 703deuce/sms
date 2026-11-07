import { describe,expect,it } from 'vitest'
import {
  buildVisualBeatCandidates,validateStoryVisualBeats,resolveVisualActionRequests,
  combineSpeechWithVisualActions,
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
  it('keeps safe nonoverlapping part of a visual event and logs the reduction',()=>{
    const story=validateStoryVisualBeats([{id:'visual_0',whyFunnyToWatch:'funny',narrativePurpose:'setup'}],candidates)
    const actions=resolveVisualActionRequests([{visualBeatId:'visual_0',startMs:6000,endMs:12000,beat:'action',reason:'keep'}],candidates,story,words,bounds)
    const merged=combineSpeechWithVisualActions([{startMs:1000,endMs:8000,beat:'speech',reason:'intro'}],actions,words,bounds)
    expect(merged.included).toMatchObject([{startMs:8000,endMs:12000}])
    expect(merged.cutPlan).toHaveLength(2)
  })
})
