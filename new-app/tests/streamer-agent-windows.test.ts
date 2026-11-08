import {describe,it,expect} from 'vitest'
import {MAX_AGENT_SOURCE_WINDOW_MS,streamerAgentWindows} from '@/lib/streamer/agent-windows'

describe('Twitch/Kick bounded specialist-agent clips',()=>{
  it('splits multi-hour VOD into contiguous nonoverlapping original-time windows',()=>{
    const sourceStart=90_000
    const windows=streamerAgentWindows(sourceStart,65*60_000,true)
    expect(MAX_AGENT_SOURCE_WINDOW_MS).toBe(20*60_000)
    expect(windows).toEqual([
      [90_000,1_290_000],[1_290_000,2_490_000],
      [2_490_000,3_690_000],[3_690_000,3_990_000],
    ])
  })
  it('a user-selected window never silently becomes last-20-minutes',()=>{
    expect(streamerAgentWindows(120_000,90*60_000,false,30))
      .toEqual([[1_920_000,3_120_000]])
  })
  it('omits terminal source fragments shorter than 15 seconds',()=>{
    expect(streamerAgentWindows(0,MAX_AGENT_SOURCE_WINDOW_MS+14_000,true))
      .toEqual([[0,MAX_AGENT_SOURCE_WINDOW_MS]])
  })
  it('rejects invalid or out of bounds source windows',()=>{
    expect(()=>streamerAgentWindows(0,10_000,true)).toThrow()
    expect(()=>streamerAgentWindows(0,60_000,false,4)).toThrow()
  })
})
