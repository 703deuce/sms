import {describe,it,expect} from 'vitest'
import {readStreamerAgentBatch,streamerAgentSettings} from '@/lib/streamer/agent-batch-contract'

describe('durable streamer agent batch state',()=>{
  const state={
    id:'sagent_1',status:'running',mode:'clip_story_v1',
    seconds:60,index:1,total:5,
    sourceStartMs:0,sourceDurationMs:5*20*60_000,
    completed:[{projectId:'p1',clipId:'c1',startMin:0}],
    errors:[],startedAt:'2026-11-08T23:00:00Z',
  }
  it('recovers active batch and previously rendered clip links after reload',()=>{
    expect(readStreamerAgentBatch({agentClipBatch:state})).toEqual(state)
  })
  it('rejects malformed progress and modes',()=>{
    expect(readStreamerAgentBatch({agentClipBatch:{...state,index:6}})).toBeNull()
    expect(readStreamerAgentBatch({agentClipBatch:{...state,mode:'clean_take_v1'}})).toBeNull()
    expect(readStreamerAgentBatch({agentClipBatch:null})).toBeNull()
  })
  it('accepts a unified clipper batch mode',()=>{
    const unified={...state,mode:'clip_unified_v1' as const}
    expect(readStreamerAgentBatch({agentClipBatch:unified})).toEqual(unified)
  })
  it('does not interpret unrelated project settings as an active batch',()=>{
    expect(readStreamerAgentBatch({streamer:{}})).toBeNull()
    expect(streamerAgentSettings(null)).toEqual({})
  })
})
