import {describe,expect,it} from 'vitest'
import {selectMomentFlowTrim} from '@/lib/ai-producer-agent/clip-mode/moment-flow'
import {storyCoverage} from '@/lib/ai-producer-agent/clip-mode/story-coverage'

describe('clip-only Flow and story recovery policies',()=>{
 it('keeps a Flow trim to a clean 26s ending instead of padding to 60s',()=>{
   const original={startMs:0,endMs:60000,beat:'moment'}
   const trimmed={startMs:5000,endMs:31000,beat:'moment'}
   expect(selectMomentFlowTrim(original,trimmed)).toEqual({selection:trimmed,accepted:true})
 })
 it('disallows extending beyond the chosen original moment',()=>{
   const original={startMs:10000,endMs:40000}
   const extension={startMs:10000,endMs:63000}
   expect(selectMomentFlowTrim(original,extension)).toEqual({selection:original,accepted:false})
 })
 it('disallows a zero-length Flow output',()=>{
   const original={startMs:10000,endMs:40000}
   expect(selectMomentFlowTrim(original,{startMs:40000,endMs:40000}).accepted).toBe(false)
 })
 it('rejects adjacent 29s pseudo-stories',()=>{
   const coverage=storyCoverage([
     {startMs:114000,endMs:123000},{startMs:123000,endMs:133000},
     {startMs:133000,endMs:143000}],60)
   expect(coverage.separated).toBe(false)
   expect(coverage.durationSeconds).toBe(29)
 })
 it('recognizes a 60s story assembled from distant moments',()=>{
   const coverage=storyCoverage([
     {startMs:15000,endMs:35000},{startMs:185000,endMs:205000},
     {startMs:480000,endMs:500000}],60)
   expect(coverage.separated).toBe(true)
   expect(coverage.durationSeconds).toBe(60)
   expect(coverage.durationPenalty).toBe(0)
 })
 it('penalizes a short complete story but does not reject it for length',()=>{
   const coverage=storyCoverage([
     {startMs:15000,endMs:29000},{startMs:185000,endMs:200000}],60)
   expect(coverage.separated).toBe(true)
   expect(coverage.durationPenalty).toBeGreaterThan(0)
 })
})
