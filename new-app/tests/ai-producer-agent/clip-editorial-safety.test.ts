import {describe,expect,it} from 'vitest'
import {clipEditorialAudit,clipEditorialInstructions,repairClipBoundaries,shouldVetoPublish} from '@/lib/ai-producer-agent/clip-mode/editorial-safety'
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
 it('flags a stammered I-mean false start like the #1079 interview opening',()=>{
  const w=words('I mean, president Obama did what he did, and in doing that, me to do what I am doing. I get to do what I do because president Obama did what he did.')
  const risk=clipEditorialAudit([{startMs:0,endMs:8000}],w)
  expect(risk.some(x=>x.code==='false_start_opening'||x.code==='referential_opening')).toBe(true)
 })
 it('flags a mid-sentence ending without terminal punctuation',()=>{
  const w=words('Rights are about the ability to make those choices. Similarly, I do not need anybody to understand')
  const endMs=Math.round(w[w.length-1]!.e*1000)
  expect(clipEditorialAudit([{startMs:0,endMs}],w)
   .some(x=>x.code==='unfinished_ending')).toBe(true)
 })
 it('flags an answer that refers to a removed interviewer exchange',()=>{
  const w=[
    ...words('Do you feel tension between your faith and the party?',0,400),
    ...words('You keep talking about cultural liberalism, and I am talking about constitutional rights.',20000,400),
  ]
  const risk=clipEditorialAudit([
    {startMs:0,endMs:4000},
    {startMs:20000,endMs:32000},
  ],w)
  expect(risk.some(x=>x.code==='cut_context_reference')).toBe(true)
 })
 it('repairs a false-start opening and a mid-sentence ending, or restores a cut question',()=>{
  const opening=words('I mean, president Obama did what he did. I get to do what I do because president Obama built this.')
  const repaired=repairClipBoundaries([{startMs:0,endMs:Math.round(opening[opening.length-1]!.e*1000)}],opening)
  expect(repaired.repaired).toBe(true)
  expect(repaired.cuts[0]!.startMs).toBeGreaterThan(0)

  const mid=words('Rights protect the ability to make those choices for everyone in this country.')
  mid[mid.length-1]!.w='country.'
  const tail=words('Similarly I do not need anybody to understand the rest', 12000, 380)
  const all=[...mid,...tail]
  const midEnd=Math.round(all[all.length-1]!.e*1000)
  const fixedEnd=repairClipBoundaries([{startMs:0,endMs:midEnd}],all)
  expect(fixedEnd.cuts[0]!.endMs).toBeLessThan(midEnd)
  expect(fixedEnd.cuts[0]!.endMs).toBeGreaterThanOrEqual(3000)

  const setup=words('I have been covering this debate for years now.',0,400)
  setup[setup.length-1]!.w='now.'
  const q=words('Do you feel any tension between your faith and the party?',8000,400)
  q[q.length-1]!.w='party?'
  const a=words('You keep talking about cultural liberalism and I am talking about rights.',20000,400)
  a[a.length-1]!.w='rights.'
  const restored=repairClipBoundaries([
    {startMs:0,endMs:Math.round(setup[setup.length-1]!.e*1000)},
    {startMs:20000,endMs:Math.round(a[a.length-1]!.e*1000)},
  ],[...setup,...q,...a])
  expect(restored.cuts[1]!.startMs).toBeLessThan(20000)
  expect(restored.cuts[1]!.startMs).toBeGreaterThanOrEqual(8000)
 })
 it('vetoes publish when QA or the audit finds a broken opening, ending, or cut context',()=>{
  expect(shouldVetoPublish({
    risks:[{code:'unfinished_ending',detail:'mid-sentence',passageIndex:0}],
    qaPass:false,
    qaIssues:['Editorial QA: ending is mid-sentence'],
  })).toBe(true)
  expect(shouldVetoPublish({
    risks:[],
    qaPass:true,
    qaIssues:[],
  })).toBe(false)
 })
})
