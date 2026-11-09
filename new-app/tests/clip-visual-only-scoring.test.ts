import {describe,expect,it} from 'vitest'
import {validateClipVisualSelections} from '@/lib/ai-producer-agent/specialists'
import {scoreFinishedAgentClip} from '@/lib/streamer/agent-clip-scoring'
const observations=[
  {sourceRangeMs:[10000,25000] as [number,number]},
  {sourceRangeMs:[45000,65000] as [number,number]},
  {sourceRangeMs:[80000,95000] as [number,number]},
]
const cut=(startMs:number,endMs:number)=>({startMs,endMs,beat:'observed action',reason:'Actual observed visual event'})
describe('clip-only silent visual source support',()=>{
  it('accepts continuous silent video without any transcript IDs',()=>{
    expect(validateClipVisualSelections([cut(10000,25000)],[0,100000],observations,
      30000,true)).toHaveLength(1)
  })
  it('accepts short stitched visual clips, well below the maximum',()=>{
    const result=validateClipVisualSelections([
      cut(10000,20000),cut(45000,52000),cut(80000,92000),
    ],[0,100000],observations,90000,false)
    expect(result.reduce((n,v)=>n+v.endMs-v.startMs,0)).toBe(29000)
  })
  it('refuses visual-only fabricated timecodes with no observed frames',()=>{
    expect(()=>validateClipVisualSelections([cut(67000,79000)],[0,100000],
      observations,90000,true)).toThrow('clip_visual_selection_without_observed_evidence')
  })
  it('keeps one take continuous and rejects excessive runtime',()=>{
    expect(()=>validateClipVisualSelections([
      cut(10000,20000),cut(45000,50000)],
      [0,100000],observations,30000,true))
      .toThrow('clip_visual_moment_must_be_continuous')
    expect(()=>validateClipVisualSelections([cut(10000,95000)],
      [0,100000],observations,30000,true))
      .toThrow('clip_visual_exceeds_maximum_runtime')
  })
  it('does not penalize the absence of audio or transcript in objective score',()=>{
    const result=scoreFinishedAgentClip({
      qaRating:96,finderRating:95,
      objective:{sourceBounded:true,noOverlaps:true,
        durationMs:29000,maxDurationMs:90000,hasOutput:true},
    })
    expect(result.score).toBe(96)
    expect(result.weights).toEqual({qa:45,finder:35,objective:20})
  })
  it('does not fabricate a weighted score when QA rating is unavailable',()=>{
    const result=scoreFinishedAgentClip({
      finderRating:90,
      objective:{sourceBounded:true,noOverlaps:true,
        durationMs:20000,maxDurationMs:60000,hasOutput:true},
    })
    expect(result.qaRating).toBeNull()
    expect(result.score).toBeNull()
  })
})
