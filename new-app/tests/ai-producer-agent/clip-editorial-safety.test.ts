import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {clipEditorialAudit,clipEditorialInstructions,honorTargetDuration,isNonBlockingEditorialQaIssue,repairClipBoundaries,shouldVetoPublish,stitchJoinTransitions} from '@/lib/ai-producer-agent/clip-mode/editorial-safety'
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


const publishedWords=JSON.parse(readFileSync(
  join(dirname(fileURLToPath(import.meta.url)),'fixtures/aprun_851c73b3_published_words.json'),
  'utf8',
)) as Array<{w:string;s:number;e:number}>

const publishedCuts=[
  {startMs:765000,endMs:784160},
  {startMs:868065,endMs:873345},
  {startMs:877505,endMs:892220},
  {startMs:897795,endMs:910595},
  {startMs:910595,endMs:924840},
]

describe('aprun_851c73b3 published-clip fixture repairs',()=>{
  it('flags the mid-phrase dangling her opening and the later also-continuation',()=>{
    const risk=clipEditorialAudit(publishedCuts,publishedWords)
    expect(risk.some(x=>x.code==='mid_phrase_opening'&&x.passageIndex===0)).toBe(true)
    expect(risk.some(x=>x.code==='dangling_pronoun_opening'&&x.passageIndex===0)).toBe(true)
    expect(risk.some(x=>x.code==='continuation_opening'&&x.passageIndex===2)).toBe(true)
    expect(risk.some(x=>x.code==='incoherent_passage'&&x.passageIndex===0)).toBe(true)
  })
  it('does not treat a later complete And-sentence as a continuation opener',()=>{
    const risk=clipEditorialAudit(publishedCuts,publishedWords)
    expect(risk.some(x=>x.code==='continuation_opening'&&x.passageIndex===3)).toBe(false)
    expect(risk.some(x=>x.code==='continuation_opening'&&x.passageIndex===4)).toBe(false)
  })
  it('snaps the opening back to My grandmother and includes her antecedent',()=>{
    const repaired=repairClipBoundaries(publishedCuts,publishedWords)
    expect(repaired.repaired).toBe(true)
    const first=repaired.cuts[0]!
    expect(first.startMs).toBeLessThanOrEqual(761105)
    expect(first.startMs).toBeGreaterThanOrEqual(755000)
    const opening=publishedWords.filter(w=>w.e*1000>first.startMs&&w.s*1000<first.startMs+4000).map(w=>w.w).join(' ')
    expect(opening.toLowerCase()).toContain('grandmother')
    expect(opening.toLowerCase()).not.toMatch(/^(?:uh,?\s*)?her six/)
  })
  it('repairs but also coming to understand by including the omitted thought',()=>{
    const repaired=repairClipBoundaries(publishedCuts,publishedWords)
    const also=repaired.cuts.find(c=>c.endMs===892220||(c.startMs<878000&&c.endMs>=892000))
    expect(also).toBeTruthy()
    expect(also!.startMs).toBeLessThanOrEqual(873585)
    const opening=publishedWords.filter(w=>w.e*1000>also!.startMs&&w.s*1000<also!.startMs+5000).map(w=>w.w).join(' ').toLowerCase()
    expect(opening).toContain('understanding these differences')
    expect(opening.startsWith('but also')).toBe(false)
  })
  it('trims the disconnected Corvette detour but keeps the grandmother ending',()=>{
    const repaired=repairClipBoundaries(publishedCuts,publishedWords)
    const first=repaired.cuts[0]!
    expect(first.endMs).toBeLessThanOrEqual(773280+50)
    expect(first.endMs).toBeGreaterThan(768000)
    const last=repaired.cuts.at(-1)!
    expect(last.endMs).toBe(924840)
    const lastText=publishedWords.filter(w=>w.e*1000>last.startMs&&w.s*1000<last.endMs).map(w=>w.w).join(' ').toLowerCase()
    expect(lastText).toContain('make us human')
  })
  it('includes a concluding sentence after it feels the same',()=>{
    const repaired=repairClipBoundaries([
      {startMs:913640,endMs:920520},
    ],publishedWords,{maxLaterConclusionMs:6500})
    expect(repaired.cuts[0]!.endMs).toBeGreaterThanOrEqual(924840)
    const text=publishedWords.filter(w=>w.e*1000>repaired.cuts[0]!.startMs&&w.s*1000<repaired.cuts[0]!.endMs).map(w=>w.w).join(' ').toLowerCase()
    expect(text).toContain('make us human')
  })
  it('plans brief crossfades on every stitch join',()=>{
    const joins=stitchJoinTransitions(publishedCuts)
    expect(joins).toHaveLength(4)
    expect(joins.every(j=>j.type==='crossfade'&&j.durMs>=200&&j.durMs<=400)).toBe(true)
    expect(joins.map(j=>j.srcMs)).toEqual([868065,877505,897795,910595])
  })
  it('still vetoes a dangling pronoun or continuation that could not be repaired',()=>{
    expect(shouldVetoPublish({
      risks:[{code:'dangling_pronoun_opening',detail:'her six of eight kids',passageIndex:0}],
      qaPass:true,qaIssues:[],
    })).toBe(true)
    expect(shouldVetoPublish({
      risks:[{code:'continuation_opening',detail:'also coming to understand',passageIndex:2}],
      qaPass:true,qaIssues:[],
    })).toBe(true)
    expect(shouldVetoPublish({
      risks:[],qaPass:true,qaIssues:[],
    })).toBe(false)
  })
})


describe('duration tightening must not cut the ending payoff',()=>{
  it('keeps the last passage when a story is longer than the request',()=>{
    const cuts=[
      {startMs:0,endMs:40000},
      {startMs:50000,endMs:80000},
      {startMs:90000,endMs:120000},
    ]
    const result=honorTargetDuration(cuts,[],60)
    expect(result.cuts.at(-1)!.endMs).toBe(120000)
    expect(result.cuts.at(-1)!.startMs).toBe(90000)
    expect(result.note??'').toMatch(/ending|complete story/i)
  })
})

describe('non-blocking editorial QA warnings',()=>{
  it('treats listening-only and duration-only remarks as warnings',()=>{
    expect(isNonBlockingEditorialQaIssue('Audio joins are marked as requiring listening review. No waveform was supplied.')).toBe(true)
    expect(isNonBlockingEditorialQaIssue('No audio was supplied, so seam clicks cannot be verified.')).toBe(true)
    expect(isNonBlockingEditorialQaIssue('The clip is too short relative to the length target.')).toBe(true)
  })
  it('still treats a missing payoff or mid-sentence ending as blocking',()=>{
    expect(isNonBlockingEditorialQaIssue('The edit omits the recorded cooperation payoff after 381095 ms.')).toBe(false)
    expect(isNonBlockingEditorialQaIssue('The 350 ms crossfade cannot repair this missing story beat or the dangling clause.')).toBe(false)
    expect(isNonBlockingEditorialQaIssue('Ending is mid-sentence and must be extended to the next complete sentence.')).toBe(false)
  })
})
