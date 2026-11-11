import {describe,expect,it} from 'vitest'
import {publishedBatchClipIds,streamerBatchStatusText} from '@/lib/streamer/agent-batch-contract'
import {streamerAgentWindows,MAX_AGENT_SOURCE_WINDOW_MS} from '@/lib/streamer/agent-windows'

describe('streamer batch published-output contract',()=>{
  it('includes every published clip exactly once, keeping first-result order',()=>{
    const ids=publishedBatchClipIds({resultClipId:'lead',producerNotes:{
      publishedClipIds:['story_1','lead','continuous_1','story_1'],
    }})
    expect(ids).toEqual(['lead','story_1','continuous_1'])
  })
  it('does not mistake drafts, selected moments, or unlisted clips for published outputs',()=>{
    expect(publishedBatchClipIds({producerNotes:{
      selectedClipIds:['selected'],draftClipIds:['draft'],publishedClipCount:2,
    }})).toEqual([])
    expect(publishedBatchClipIds({resultClipId:'legacy'})).toEqual(['legacy'])
  })
  it('CL16: shows queued window and elapsed, never promises an ETA while busy',()=>{
    const batch={status:'running',index:1,total:3,startedAt:'2026-11-11T00:00:00.000Z'}
    expect(streamerBatchStatusText(batch,Date.parse('2026-11-11T00:02:04.000Z')))
      .toContain('window 2/3 · elapsed 2m 04s · ETA unknown')
    expect(streamerBatchStatusText({...batch,status:'canceled'},Date.parse('2026-11-11T00:02:04Z')))
      .toContain('Batch canceled')
    expect(streamerBatchStatusText({...batch,status:'done'},Date.parse('2026-11-11T00:02:04Z')))
      .toContain('Batch complete')
    expect(streamerBatchStatusText({...batch,startedAt:'invalid'},Date.now()))
      .toContain('elapsed unknown')
  })
  it('keeps one contiguous timeline after folding a sub-minute full-VOD tail',()=>{
    const duration=MAX_AGENT_SOURCE_WINDOW_MS+15_000
    const ranges=streamerAgentWindows(70_000,duration,true)
    expect(ranges).toHaveLength(2)
    expect(ranges[0]![0]).toBe(70_000)
    expect(ranges[0]![1]).toBe(ranges[1]![0])
    expect(ranges[1]![1]).toBe(70_000+duration)
    expect(ranges[1]![1]-ranges[1]![0]).toBe(60_000)
  })
})
