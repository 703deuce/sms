import {describe,it,expect} from 'vitest'
import {candidateWindows,overlapFraction,rankCandidate} from '@/lib/ai-producer-agent/clip-mode/candidates'
import {storyCoverage} from '@/lib/ai-producer-agent/clip-mode/story-coverage'

describe('independent short clip modes',()=>{
 it('finds and independently ranks seven real moments across a video',()=>{
   const moments=Array.from({length:8},(_,i)=>({
     start_s:i*100+15,end_s:i*100+35,peak_s:i*100+25,
     score:0.85-i*.02,what_happened:'Event '+i,
   }))
   const found=candidateWindows(moments,[0,900_000],'moment',60)
   expect(found).toHaveLength(8)
   expect(new Set(found.map(x=>x.peakMs)).size).toBe(8)
   expect(found[0]?.finderScore).toBeGreaterThan(found[7]!.finderScore)
 })
 it('does not make up candidates where Gemini found none',()=>{
   expect(candidateWindows([],[0,200000],'story',60)).toEqual([])
 })
 it('rejects 1:54-2:24 continuous triple trim pretending to be a story',()=>{
   const coverage=storyCoverage([
     {startMs:114000,endMs:123000},{startMs:123000,endMs:133000},
     {startMs:133000,endMs:144000}],60)
   expect(coverage.separated).toBe(false)
   expect(coverage.gapsMs).toEqual([0,0])
 })
 it('accepts a real 50-second multiregion story and does not require 60 exactly',()=>{
   const coverage=storyCoverage([
     {startMs:10000,endMs:25000},{startMs:70000,endMs:88000},
     {startMs:125000,endMs:142000}],60)
   expect(coverage.separated).toBe(true)
   expect(coverage.durationSeconds).toBe(50)
 })
 it('keeps shorter genuine moments with ranking penalty',()=>{
   const short=rankCandidate({finderScore:90,qaPass:true,issues:0,durationSeconds:26,targetS:60})
   const full=rankCandidate({finderScore:90,qaPass:true,issues:0,durationSeconds:60,targetS:60})
   expect(short).toBeGreaterThan(0)
   expect(short).toBeLessThan(full)
 })
 it('dedupes overlapping cut plans independent of ranking',()=>{
   expect(overlapFraction([{startMs:0,endMs:30000}],[{startMs:3000,endMs:29000}])).toBeGreaterThan(.35)
   expect(overlapFraction([{startMs:0,endMs:30000}],[{startMs:60000,endMs:90000}])).toBe(0)
 })
})