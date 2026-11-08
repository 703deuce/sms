import {describe,expect,it} from 'vitest'
import {clipAgentSourceWindow,roughCutSourceWindow,minimumAgentTranscriptWords} from '@/lib/ai-producer-agent/rough-cut-window'
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
  it('does not pretend to inspect all of a long stream by silently taking the last 20 minutes',()=>{
    expect(()=>clipAgentSourceWindow(make([0,3600000])))
      .toThrow('clip_agent_requires_bounded_source_window')
  })
  it('rejects undersized sources and retains locked long form behavior',()=>{
    expect(()=>clipAgentSourceWindow(make([0,14000])))
      .toThrow('clip_agent_source_too_short')
    expect(roughCutSourceWindow(make([0,3600000])).rangeMs)
      .toEqual([2400000,3600000])
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
