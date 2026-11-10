import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {clipEditorialAudit,clipEditorialInstructions,honorTargetDuration,isNonBlockingEditorialQaIssue,repairClipBoundaries,shouldVetoPublish,stitchJoinTransitions} from '@/lib/ai-producer-agent/clip-mode/editorial-safety'
import {selectMomentFlowTrim} from '@/lib/ai-producer-agent/clip-mode/moment-flow'
const words=(text:string,startMs=0,spacingMs=380)=>
  text.split(' ').map((w,i)=>({w,s:(startMs+i*spacingMs)/1000,e:(startMs+i*spacingMs+320)/1000}))

type EditorialFinding = {code: string; passageIndex?: number; detail?: string}
type TranscriptWord = {w: string; s: number; e: number}

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

describe('VQ PR #1081 draft openings and tails (clip_30f9ea02)',()=>{
  it('flags And-he on a sentence boundary as a continuation-plus-pronoun opening',()=>{
    const risk=clipEditorialAudit([{startMs:773840,endMs:786495}],publishedWords)
    expect(risk.some(x=>x.code==='continuation_opening'||x.code==='dangling_pronoun_opening')).toBe(true)
  })
  it('snaps And he was a great student back to the dad antecedent',()=>{
    const repaired=repairClipBoundaries([{startMs:773840,endMs:786495}],publishedWords)
    expect(repaired.cuts[0]!.startMs).toBeLessThanOrEqual(769105)
    const opening=publishedWords.filter(w=>w.e*1000>repaired.cuts[0]!.startMs&&w.s*1000<repaired.cuts[0]!.startMs+4000).map(w=>w.w).join(' ')
    expect(opening.toLowerCase()).toMatch(/dad|grandmother/)
    expect(opening.toLowerCase().startsWith('and he')).toBe(false)
  })
  it('re-snaps And-he if an earlier passage was dropped',()=>{
    const repaired=repairClipBoundaries([
      {startMs:761105,endMs:773280},
      {startMs:773840,endMs:786495},
      {startMs:910595,endMs:924840},
    ],publishedWords)
    const first=repaired.cuts[0]!
    const opening=publishedWords.filter(w=>w.e*1000>first.startMs&&w.s*1000<first.startMs+4000).map(w=>w.w).join(' ').toLowerCase()
    expect(opening.startsWith('and he')).toBe(false)
  })
  it('does not extend the Corvette landing tail into the next sentence when there is no room',()=>{
    const repaired=repairClipBoundaries([{startMs:777120,endMs:806030}],publishedWords)
    const landing=publishedWords.filter(w=>w.e*1000<=806030+20 && /[.!?]"?$/.test(w.w)).at(-1)
    expect(landing?.w).toMatch(/Corvette\.?/)
    // "Corvette." ends at the same instant "And for the car lovers" begins.
    expect(repaired.cuts[0]!.endMs).toBeLessThanOrEqual(Math.round(landing!.e*1000))
    const spilled=publishedWords.filter((w: TranscriptWord)=>w.s*1000>=806030&&w.s*1000<806330).map((w: TranscriptWord)=>w.w).join(' ').toLowerCase()
    expect(spilled).toMatch(/^and for/)
    expect(repaired.cuts[0]!.endMs).toBeLessThanOrEqual(806030)
  })
  it('does not treat a later And-without-pronoun sentence as a pronoun continuation',()=>{
    const risk=clipEditorialAudit(publishedCuts,publishedWords)
    expect(risk.some(x=>x.code==='continuation_opening'&&x.passageIndex===3)).toBe(false)
  })
})

describe('And/But/So + demonstrative or it is not a strong continuation',()=>{
  // Personal pronouns after And/But/So almost always point at a person
  // named in omitted prior speech (the clip_30f9ea02 "And he" failure).
  // "it" / "this" / "that" often start a self-contained hook or a dummy
  // subject ("And that was the point.", "So this is how we start.",
  // "But it didn't matter."), so they are not strong continuations.
  // A first-passage And/So/But remains a soft continuation.
  it('still flags And he, But she, and So they as continuation openings',()=>{
    const andHe=words('And he was a great student after all that work.')
    andHe[andHe.length-1]!.w='work.'
    expect(clipEditorialAudit([{startMs:0,endMs:8000}],andHe)
      .some((x: EditorialFinding)=>x.code==='continuation_opening')).toBe(true)
    const butShe=words('But she never gave up on the family after that.')
    butShe[butShe.length-1]!.w='that.'
    expect(clipEditorialAudit([{startMs:0,endMs:8000}],butShe)
      .some((x: EditorialFinding)=>x.code==='continuation_opening')).toBe(true)
    const soThey=words('So they decided to start over with a new plan.')
    soThey[soThey.length-1]!.w='plan.'
    expect(clipEditorialAudit([{startMs:0,endMs:8000}],soThey)
      .some((x: EditorialFinding)=>x.code==='continuation_opening')).toBe(true)
  })
  it('does not flag And that, So this, or But it as a continuation in a later passage',()=>{
    const setup=words('My grandmother taught the family a real lesson here.',0,400)
    setup[setup.length-1]!.w='here.'
    const andThat=words('And that was the whole point of the story today.',20000,400)
    andThat[andThat.length-1]!.w='today.'
    const soThis=words('So this is how we start the next chapter together.',40000,400)
    soThis[soThis.length-1]!.w='together.'
    const butIt=words('But it did not matter once the work was finished.',60000,400)
    butIt[butIt.length-1]!.w='finished.'
    const firstEnd=Math.round(setup[setup.length-1]!.e*1000)
    const laterPassages: Array<{later: TranscriptWord[]; label: string}> = [
      {later: andThat, label: 'that'},
      {later: soThis, label: 'this'},
      {later: butIt, label: 'it'},
    ]
    for(const {later, label} of laterPassages){
      const start=Math.round(later[0]!.s*1000)
      const end=Math.round(later[later.length-1]!.e*1000)
      const risk=clipEditorialAudit(
        [{startMs:0,endMs:firstEnd},{startMs:start,endMs:end}],
        [...setup,...later],
      )
      expect(risk.some((x: EditorialFinding)=>x.code==='continuation_opening'&&x.passageIndex===1),label).toBe(false)
    }
  })
  it('may still treat a first-passage And that as a soft continuation',()=>{
    const w=words('And that was the whole point of the story today.')
    w[w.length-1]!.w='today.'
    expect(clipEditorialAudit([{startMs:0,endMs:8000}],w)
      .some((x: EditorialFinding)=>x.code==='continuation_opening')).toBe(true)
  })
})

describe('tail padding respects trim, source, and neighbor bounds',()=>{
  it('adds a 300ms tail when a pause after the last word leaves room',()=>{
    const w=[
      {w:'This',s:0,e:0.25},
      {w:'is',s:0.25,e:0.4},
      {w:'a',s:0.4,e:0.5},
      {w:'complete',s:0.5,e:0.9},
      {w:'thought',s:0.9,e:1.2},
      {w:'done.',s:3.5,e:3.9},
      {w:'Later',s:5.5,e:5.8},
      {w:'on.',s:5.8,e:6.1},
    ]
    const repaired=repairClipBoundaries([{startMs:0,endMs:3900}],w)
    expect(repaired.cuts[0]!.endMs).toBeGreaterThanOrEqual(4200)
    expect(repaired.cuts[0]!.endMs).toBeLessThan(5500)
    expect(repaired.cuts[0]!.endMs).toBe(4200)
  })
  it('clamps the tail to the source duration at EOF',()=>{
    const w=[
      {w:'This',s:0,e:0.25},
      {w:'is',s:0.25,e:0.4},
      {w:'a',s:0.4,e:0.5},
      {w:'complete',s:0.5,e:0.9},
      {w:'thought',s:0.9,e:1.2},
      {w:'done.',s:3.6,e:4.0},
    ]
    const repaired=repairClipBoundaries([{startMs:0,endMs:4000}],w)
    expect(repaired.cuts[0]!.endMs).toBeLessThanOrEqual(4000)
    expect(repaired.cuts[0]!.endMs).toBe(4000)
  })
  it('leaves an empty transcript unchanged and does not throw',()=>{
    expect(()=>repairClipBoundaries([{startMs:0,endMs:8000}],[])).not.toThrow()
    const repaired=repairClipBoundaries([{startMs:0,endMs:8000}],[])
    expect(repaired.cuts).toEqual([{startMs:0,endMs:8000}])
    expect(repairClipBoundaries([],[]).cuts).toEqual([])
  })
  it('does not extend a tail into a back-to-back following clip',()=>{
    const first=[
      {w:'Here',s:0,e:0.25},
      {w:'is',s:0.25,e:0.4},
      {w:'a',s:0.4,e:0.5},
      {w:'complete',s:0.5,e:0.9},
      {w:'opening',s:0.9,e:1.3},
      {w:'thought.',s:3.6,e:4.0},
    ]
    const second=[
      {w:'Here',s:4.0,e:4.25},
      {w:'is',s:4.25,e:4.4},
      {w:'another',s:4.4,e:4.8},
      {w:'complete',s:4.8,e:5.2},
      {w:'closing',s:5.2,e:5.6},
      {w:'thought.',s:7.6,e:8.0},
    ]
    const repaired=repairClipBoundaries(
      [{startMs:0,endMs:4000},{startMs:4000,endMs:8000}],
      [...first,...second],
    )
    expect(repaired.cuts.length).toBe(2)
    expect(repaired.cuts[0]!.endMs).toBeLessThanOrEqual(4000)
    expect(repaired.cuts[1]!.startMs).toBeGreaterThanOrEqual(repaired.cuts[0]!.endMs)
    // A short gap between clips also cannot be inflated past the next start.
    const gappedSecond=[{w:'Here',s:4.1,e:4.35},...second.slice(1)]
    const gapped=repairClipBoundaries(
      [{startMs:0,endMs:4000},{startMs:4100,endMs:8000}],
      [...first,...gappedSecond],
    )
    expect(gapped.cuts[0]!.endMs).toBeLessThanOrEqual(4100)
    expect(gapped.cuts[0]!.endMs-Math.round(first.at(-1)!.e*1000)).toBeLessThanOrEqual(300)
  })
})
