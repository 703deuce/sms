import {describe,it,expect} from 'vitest'
import {defaultClipSettings,clipProjectSettingsSchema} from '@/lib/clips/settings'
import {streamerAgentWindows} from '@/lib/streamer/agent-windows'
import {readStreamerAgentBatch} from '@/lib/streamer/agent-batch-contract'
import {clipAgentSourceWindow} from '@/lib/ai-producer-agent/rough-cut-window'

describe('uploaded clips share the Twitch/Kick agent workflow',()=>{
  it('persists selected short mode and target length in normal upload settings',()=>{
    const settings=defaultClipSettings({
      autoAgentClipMode:'clip_story_v1',autoAgentClipSeconds:90,
    })
    const saved=clipProjectSettingsSchema.parse(JSON.parse(JSON.stringify(settings)))
    expect(saved.autoAgentClipMode).toBe('clip_story_v1')
    expect(saved.autoAgentClipSeconds).toBe(90)
  })
  it('feeds uploaded footage through identical bounded source contract',()=>{
    const rangeMs:[number,number]=[60_000,1_260_000]
    const uploaded={sourceId:'uploaded_recording',kind:'upload' as const,
      projectId:'uploaded-project',rangeMs,durationMs:1_200_000}
    expect(clipAgentSourceWindow(uploaded).rangeMs).toEqual(rangeMs)
    expect(()=>clipAgentSourceWindow({...uploaded,rangeMs:[0,3_600_000]}))
      .toThrow('clip_agent_requires_bounded_source_window')
  })
  it('uses exact same 20-minute splitting and persisted result format',()=>{
    const windows=streamerAgentWindows(0,45*60_000,true)
    expect(windows).toEqual([[0,1_200_000],[1_200_000,2_400_000],
      [2_400_000,2_700_000]])
    const batch={id:'batch1',status:'running',mode:'clip_moment_v1',
      seconds:60,index:1,total:3,sourceStartMs:0,sourceDurationMs:2_700_000,
      completed:[{projectId:'output',clipId:'clip',startMin:0}],
      errors:[],startedAt:'2026-11-08T00:00:00Z'}
    expect(readStreamerAgentBatch({agentClipBatch:batch})?.completed)
      .toEqual(batch.completed)
  })
})
