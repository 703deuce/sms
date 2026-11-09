import { describe,expect,it } from 'vitest'
import { storyCoverage } from '@/lib/ai-producer-agent/clip-mode/story-coverage'

describe('independent short-story moment coverage',()=>{
  it('rejects split-up continuous trim even when three passages exist',()=>{
    const c=storyCoverage([{startMs:114000,endMs:123000},
      {startMs:123000,endMs:133000},{startMs:133000,endMs:144000}])
    expect(c.separated).toBe(false)
    expect(c.gapsMs).toEqual([0,0])
    expect(c.durationSeconds).toBe(30)
  })
  it('accepts genuinely distinct source regions regardless of their selected duration',()=>{
    const c=storyCoverage([{startMs:30000,endMs:45000},
      {startMs:210000,endMs:225000},{startMs:400000,endMs:418000}])
    expect(c.separated).toBe(true)
    expect(c.durationSeconds).toBe(48)
    expect(c.durationPenalty).toBeGreaterThan(0)
  })
  it('keeps 60 seconds a ranking preference, not a hard error',()=>{
    expect(storyCoverage([{startMs:0,endMs:26000}],60).durationPenalty).toBeGreaterThan(0)
    expect(storyCoverage([{startMs:0,endMs:28000},
      {startMs:60000,endMs:92000}],60).durationPenalty).toBe(0)
  })
  it('rejects tiny gaps and overlapping source passages',()=>{
    expect(storyCoverage([{startMs:0,endMs:10000},
      {startMs:12000,endMs:25000}]).separated).toBe(false)
    expect(storyCoverage([{startMs:0,endMs:10000},
      {startMs:9500,endMs:25000}]).separated).toBe(false)
  })
})
