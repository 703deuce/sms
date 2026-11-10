import {describe,expect,it} from 'vitest'
import {clipAgentSourceWindow,roughCutSourceWindow,minimumAgentTranscriptWords,MAX_CLIP_AGENT_SOURCE_MS,clipAnalysisChunks,clipAgentWallClockMs,analyzeWaitTimeoutMs,clipAgentHardSteps,clipAgentHardStepsForCandidates,clipCandidateHardSteps,clipCandidateWallClockMs,clipQaRetryHardSteps} from '@/lib/ai-producer-agent/rough-cut-window'
import {buildAgentSystemPrompt} from '@/lib/ai-producer-agent/prompts'

describe('streamer agent clip mode source isolation',()=>{
  const make=(rangeMs:[number,number])=>({
    sourceId:'stream',kind:'stream' as const,projectId:'project',
    rangeMs,durationMs:rangeMs[1]-rangeMs[0],
  })
  it('keeps the authorized 30-second and 20-minute windows absolute',()=>{
    expect(clipAgentSourceWindow(make([182000,212000])).rangeMs).toEqual([182000,212000])
    expect(clipAgentSourceWindow(make([400000,1600000])).rangeMs).toEqual([400000,1600000])
  })
  it('allows a full 65-minute interview or a 10-hour episode as one run',()=>{
    expect(clipAgentSourceWindow(make([0,3_931_162])).rangeMs).toEqual([0,3_931_162])
    expect(clipAgentSourceWindow(make([0,MAX_CLIP_AGENT_SOURCE_MS])).rangeMs)
      .toEqual([0,MAX_CLIP_AGENT_SOURCE_MS])
  })
  it('does not silently take the last 20 minutes of a long source',()=>{
    expect(clipAgentSourceWindow(make([0,3600000])).rangeMs).toEqual([0,3600000])
    expect(clipAgentSourceWindow(make([0,3600000])).durationMs).toBe(3600000)
  })
  it('rejects sources shorter than 15 seconds or longer than 10 hours',()=>{
    expect(()=>clipAgentSourceWindow(make([0,14000])))
      .toThrow('clip_agent_source_too_short')
    expect(()=>clipAgentSourceWindow(make([0,MAX_CLIP_AGENT_SOURCE_MS+1000])))
      .toThrow('clip_agent_source_exceeds_max_duration')
    expect(roughCutSourceWindow(make([0,3600000])).rangeMs)
      .toEqual([2400000,3600000])
  })
  it('plans invisible analysis chunks across a long episode, then covers the whole span',()=>{
    const chunks=clipAnalysisChunks(0,3_931_162)
    expect(chunks[0]).toEqual([0,1_200_000])
    expect(chunks.at(-1)?.[1]).toBe(3_931_162)
    expect(chunks).toHaveLength(4)
    expect(clipAgentWallClockMs(3_931_162)).toBeGreaterThan(45*60_000)
    expect(analyzeWaitTimeoutMs(3_931_162)).toBeGreaterThan(20*60_000)
  })
})

describe('agent-powered clipping prompt isolation',()=>{
  const args={genre:'irl_just_chatting',outputType:'story' as const,
    platform:'shorts' as const,editMode:'just_chatting_rough_cut' as const}
  it('chooses short continuous clip instructions over legacy long-form prompt',()=>{
    const p=buildAgentSystemPrompt({...args,clipAgentMode:'moment'})
    expect(p).toContain('STREAMER SINGLE MOMENT CLIP')
    expect(p).toContain('exactly one continuous source interval')
    expect(p).not.toContain('You are editing a long-form Just Chatting stream')
  })
  it('chooses multiple-source-passages story within a short output',()=>{
    const p=buildAgentSystemPrompt({...args,clipAgentMode:'story'})
    expect(p).toContain('STREAMER AI STORY CLIP')
    expect(p).toContain('mini-story')
    expect(p).not.toContain('You are editing a long-form Just Chatting stream')
  })
  it('preserves the existing long-form Just Chatting prompt exactly for old modes',()=>{
    const p=buildAgentSystemPrompt(args)
    expect(p).toContain('You are editing a long-form Just Chatting stream')
    expect(p).not.toContain('STREAMER SINGLE MOMENT CLIP')
  })
})

describe('streamer word minimum contract',()=>{
  it('accepts speech-light gameplay while preserving long-form minimum',()=>{
    expect(minimumAgentTranscriptWords('clip_moment_v1')).toBe(8)
    expect(minimumAgentTranscriptWords('clip_story_v1')).toBe(8)
    expect(minimumAgentTranscriptWords('single_source_v1')).toBe(30)
    expect(minimumAgentTranscriptWords()).toBe(30)
  })
})

describe('clip candidate QA budget scales with source length and yield',()=>{
  const interviewMs=3_931_162
  it('gives each candidate more than the default 80-step budget that exhausted QA',()=>{
    expect(clipCandidateHardSteps(interviewMs)).toBeGreaterThan(80)
    expect(clipCandidateHardSteps(interviewMs)).toBeGreaterThanOrEqual(200)
    expect(clipCandidateWallClockMs(interviewMs)).toBeGreaterThan(12*60_000)
    expect(clipQaRetryHardSteps()).toBe(80)
  })
  it('expands the run-level step cap as candidate count grows',()=>{
    const base=clipAgentHardSteps(interviewMs)
    expect(clipAgentHardStepsForCandidates(interviewMs,17)).toBeGreaterThan(base)
    expect(clipAgentHardStepsForCandidates(interviewMs,17)).toBe(base+17*8)
    expect(clipAgentHardStepsForCandidates(interviewMs,0)).toBe(base)
  })
})
