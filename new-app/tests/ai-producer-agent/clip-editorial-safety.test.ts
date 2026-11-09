import {describe,expect,it} from 'vitest'
import {clipEditorialAudit,clipEditorialInstructions} from '@/lib/ai-producer-agent/clip-mode/editorial-safety'
import {selectMomentFlowTrim} from '@/lib/ai-producer-agent/clip-mode/moment-flow'
const words=(text:string,startMs=0,spacingMs=380)=>
  text.split(' ').map((w,i)=>({w,s:(startMs+i*spacingMs)/1000,e:(startMs+i*spacingMs+320)/1000}))

describe('clip-only editorial policy from video review',()=>{
 it('flags a first line referencing context the viewer never heard',()=>{
  const w=words('that is why we had to stop and rethink the answer')
  expect(clipEditorialAudit([{startMs:0,endMs:3900}],w)
   .some(x=>x.code==='referential_opening')).toBe(true)
 })
 it('does not treat a later story passage starting with so as missing context by itself',()=>{
  const w=[...words('Here is the problem and the first reason',0),
           ...words('So we changed our plan with real context',30000)]
  const risk=clipEditorialAudit([
   {startMs:0,endMs:3000},{startMs:30000,endMs:33000}],w)
  expect(risk.some(x=>x.code==='referential_opening')).toBe(false)
 })
 it('inspects words immediately after the end for omitted only-if',()=>{
  const w=[...words('This works for everyone',0),
            ...words('only if the system actually confirms the request',4000)]
  const risk=clipEditorialAudit([{startMs:0,endMs:1850}],w)
  expect(risk.map(x=>x.code)).toContain('missing_qualification')
 })
 it('does not flag a qualifier already retained in the cut',()=>{
  const w=words('This works for everyone but only if they confirm the request',0)
  expect(clipEditorialAudit([{startMs:0,endMs:4600}],w)
   .some(x=>x.code==='missing_qualification')).toBe(false)
 })
 it('keeps a natural 15-second trim without padding',()=>{
  const o={startMs:0,endMs:60000}
  const p={startMs:0,endMs:15000}
  expect(selectMomentFlowTrim(o,p).selection).toEqual(p)
 })
 it('permits 2 setup sentences but never a minute of unrelated preamble',()=>{
  const o={startMs:20000,endMs:52000}
  const context={maxEarlierSetupMs:12000,maxLaterConclusionMs:6500}
  expect(selectMomentFlowTrim(o,{startMs:10000,endMs:52000},context).accepted).toBe(true)
  expect(selectMomentFlowTrim(o,{startMs:0,endMs:52000},context).accepted).toBe(false)
 })
 it('permits only bounded source qualification after the end',()=>{
  const o={startMs:20000,endMs:52000}
  const context={maxEarlierSetupMs:12000,maxLaterConclusionMs:6500}
  expect(selectMomentFlowTrim(o,{startMs:20000,endMs:56500},context).accepted).toBe(true)
  expect(selectMomentFlowTrim(o,{startMs:20000,endMs:68000},context).accepted).toBe(false)
 })
 it('documents point, context, caveat, chronology, names and face safe-zone checks',()=>{
  const rule=clipEditorialInstructions().toLowerCase()
  for(const part of ['point','setup','qualifier','payoff','proper-name','face and mouth']){
    expect(rule).toContain(part)
  }
 })
})
