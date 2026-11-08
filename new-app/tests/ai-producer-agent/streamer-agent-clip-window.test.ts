import {describe,expect,it} from 'vitest'
import {clipAgentSourceWindow,roughCutSourceWindow} from '@/lib/ai-producer-agent/rough-cut-window'

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
