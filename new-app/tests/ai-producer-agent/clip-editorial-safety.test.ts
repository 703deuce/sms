import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {chooseFallbackPublications,clipEditorialAudit,clipEditorialInstructions,honorTargetDuration,isCriticalEditorialFailure,isCriticalQaIssue,isNeedsReviewQaIssue,isNonBlockingEditorialQaIssue,JOIN_ONSET_PAD_MS,LONG_SOURCE_GAP_MS,MIN_CLIP_TAIL_MS,publishDisposition,regateAfterRepair,repairClipBoundaries,shouldVetoPublish,stitchJoinTransitions,type EditorialRisk} from '@/lib/ai-producer-agent/clip-mode/editorial-safety'
import {selectMomentFlowTrim} from '@/lib/ai-producer-agent/clip-mode/moment-flow'
import {
  clipAgentExportIdempotencyKey,
  editVersionFromSnapshot,
  isUniqueConflict,
  queueClipExportOnce,
  shouldAutoExportPublishedClip,
  shouldAutoPlanClipMotion,
} from '../../lib/ai-producer-agent/clip-mode/clip-agent-export'

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
  expect(restored.cuts[1]!.startMs).toBeGreaterThanOrEqual(8000-JOIN_ONSET_PAD_MS)
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
    expect(risk.some((x: EditorialFinding)=>x.code==='continuation_opening'||x.code==='dangling_pronoun_opening')).toBe(true)
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
    expect(risk.some((x: EditorialFinding)=>x.code==='continuation_opening'&&x.passageIndex===3)).toBe(false)
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


describe('And if/when that/this is a continuation; And that remains exempt',()=>{
  it('flags And if that happens with no antecedent in the clip and snaps back to the setup',()=>{
    const setup=words('It is foundationally going to change our economy at a time scale that we cannot adapt to.',84630,400)
    setup[setup.length-1]!.w='to.'
    const opening=words('And if that happens or if AI slips human control we need a treaty.',Math.round(setup[setup.length-1]!.e*1000)+200,400)
    opening[opening.length-1]!.w='treaty.'
    const w=[...setup,...opening]
    const startMs=Math.round(opening[0]!.s*1000)
    const endMs=Math.round(opening[opening.length-1]!.e*1000)
    const risk=clipEditorialAudit([{startMs,endMs}],w)
    expect(risk.some((x: EditorialFinding)=>x.code==='continuation_opening')).toBe(true)
    const repaired=repairClipBoundaries([{startMs,endMs}],w)
    expect(repaired.cuts[0]!.startMs).toBeLessThanOrEqual(Math.round(setup[0]!.s*1000)+20)
    const text=w.filter((word: TranscriptWord)=>word.e*1000>repaired.cuts[0]!.startMs&&word.s*1000<repaired.cuts[0]!.startMs+8000).map((word: TranscriptWord)=>word.w).join(' ')
    expect(text.toLowerCase()).toMatch(/change our economy/)
    expect(text.toLowerCase().startsWith('and if that')).toBe(false)
  })
  it('keeps the And that / So this / But it exemption for self-contained later hooks',()=>{
    const prior=words('Here is the setup and the first reason we changed course today.',0,400)
    prior[prior.length-1]!.w='today.'
    const andThat=words('And that was the whole point of the story today.',20000,400)
    andThat[andThat.length-1]!.w='today.'
    const soThis=words('So this is how we start the next chapter now.',40000,400)
    soThis[soThis.length-1]!.w='now.'
    const butIt=words("But it didn't matter after the work was done.",60000,400)
    butIt[butIt.length-1]!.w='done.'
    const cuts=[
      {startMs:0,endMs:Math.round(prior[prior.length-1]!.e*1000)},
      {startMs:20000,endMs:Math.round(andThat[andThat.length-1]!.e*1000)},
      {startMs:40000,endMs:Math.round(soThis[soThis.length-1]!.e*1000)},
      {startMs:60000,endMs:Math.round(butIt[butIt.length-1]!.e*1000)},
    ]
    const risk=clipEditorialAudit(cuts,[...prior,...andThat,...soThis,...butIt])
    expect(risk.some((x: EditorialFinding)=>x.code==='continuation_opening'&&x.passageIndex===1)).toBe(false)
    expect(risk.some((x: EditorialFinding)=>x.code==='continuation_opening'&&x.passageIndex===2)).toBe(false)
    expect(risk.some((x: EditorialFinding)=>x.code==='continuation_opening'&&x.passageIndex===3)).toBe(false)
  })
})

describe('internal joins land on clause boundaries with onset padding',()=>{
  // clip_2c9d41ab: 343.050s ends on "that's..." then 400ms to "I don't..."
  const join2c9d: TranscriptWord[]=[
    {w:'If',s:339.130,e:339.290},{w:'we',s:339.290,e:339.450},{w:'pause',s:339.450,e:339.770},
    {w:'and',s:339.770,e:339.930},{w:'China',s:339.930,e:340.250},{w:"doesn't?",s:340.250,e:340.730},
    {w:'See,',s:340.730,e:341.130},{w:'I',s:341.130,e:341.210},{w:'just',s:341.530,e:341.690},
    {w:"don't",s:341.690,e:341.930},{w:'think',s:341.930,e:342.170},{w:'that',s:342.170,e:342.330},
    {w:"that's...",s:342.330,e:343.050},
    {w:'I',s:343.450,e:343.850},{w:"don't",s:344.170,e:344.330},{w:'take',s:344.650,e:344.890},
    {w:'that',s:344.890,e:345.050},{w:'as',s:345.050,e:345.290},{w:'seriously',s:345.290,e:345.610},
    {w:'as',s:345.610,e:345.770},{w:'a',s:345.770,e:345.850},{w:'lot',s:345.850,e:345.930},
    {w:'of',s:345.930,e:346.010},{w:'people',s:346.010,e:346.170},{w:'do.',s:346.170,e:346.410},
  ]
  it('does not end the 2c9d41ab join at 343.050s on that\'s...',()=>{
    const cuts=[{startMs:339130,endMs:343050},{startMs:343450,endMs:346410}]
    const risk=clipEditorialAudit(cuts,join2c9d)
    expect(risk.some((x: EditorialFinding)=>x.code==='unfinished_ending'&&x.passageIndex===0)).toBe(true)
    const repaired=repairClipBoundaries(cuts,join2c9d)
    const first=repaired.cuts[0]!
    expect(first.endMs).toBeLessThanOrEqual(340730)
    const last=join2c9d.filter((w: TranscriptWord)=>w.e*1000<=first.endMs+20).at(-1)
    expect(last?.w).toMatch(/doesn't\?/)
    expect(first.endMs).not.toBe(343050)
  })

  // clip_020320f5: "up." ends 386.695, "I" starts 386.670 (onset is cut)
  const join0203: TranscriptWord[]=[
    {w:'I',s:382.000,e:382.200},{w:'think',s:382.200,e:382.500},{w:'the',s:383.015,e:383.095},
    {w:'skier',s:384.855,e:385.335},{w:'can',s:385.335,e:385.575},{w:'still',s:385.575,e:385.815},
    {w:'swim',s:385.815,e:386.135},{w:'and',s:386.135,e:386.295},{w:'catch',s:386.295,e:386.535},
    {w:'up.',s:386.535,e:386.695},
    {w:'I',s:386.670,e:386.910},{w:'mean,',s:386.910,e:387.070},{w:"that's",s:387.070,e:387.230},
    {w:'apart.',s:388.030,e:388.190},
    {w:'But,',s:390.270,e:390.430},{w:'eventually,',s:390.430,e:390.910},{w:'yes,',s:390.990,e:391.230},
    {w:'they',s:391.230,e:391.310},{w:'are',s:391.550,e:391.630},{w:'going',s:391.630,e:391.790},
    {w:'to',s:391.790,e:391.870},{w:'catch.',s:391.870,e:392.200},
  ]
  it('does not cut the onset of I at 386.695s on 020320f5',()=>{
    const cuts=[{startMs:382000,endMs:386695},{startMs:390270,endMs:392200}]
    const repaired=repairClipBoundaries(cuts,join0203)
    const first=repaired.cuts[0]!
    expect(first.endMs).toBeLessThanOrEqual(386670)
    const spilled=join0203.filter((w: TranscriptWord)=>w.w==='I'&&Math.round(w.s*1000)===386670)
    expect(spilled.length).toBe(1)
    expect(first.endMs).toBeLessThanOrEqual(Math.round(spilled[0]!.s*1000))
  })

  // clip_26347297: ends on "kids," at 2249.440 then "which means..."
  const join2634: TranscriptWord[]=[
    {w:'Maybe',s:2246.000,e:2246.480},{w:'we',s:2246.480,e:2246.720},{w:'should',s:2246.720,e:2247.120},
    {w:'stop',s:2247.120,e:2247.520},{w:'making',s:2247.520,e:2247.760},{w:'it',s:2247.760,e:2247.920},
    {w:'so',s:2247.920,e:2248.160},{w:'expensive',s:2248.160,e:2248.560},{w:'to',s:2248.560,e:2248.720},
    {w:'have',s:2248.720,e:2248.880},{w:'kids,',s:2248.880,e:2249.440},
    {w:'which',s:2249.600,e:2249.760},{w:'means',s:2249.760,e:2250.080},{w:'that',s:2250.080,e:2250.400},
    {w:'if',s:2250.400,e:2250.560},{w:'the',s:2250.560,e:2250.720},{w:'only',s:2250.720,e:2250.960},
    {w:'argument',s:2250.960,e:2251.440},{w:'that',s:2251.440,e:2251.600},{w:'we',s:2251.600,e:2251.760},
    {w:'have',s:2251.760,e:2252.080},{w:'about',s:2252.080,e:2252.400},{w:'America',s:2252.400,e:2252.720},
    {w:'is',s:2252.720,e:2252.960},{w:'we',s:2252.960,e:2253.120},{w:"can't",s:2253.120,e:2253.360},
    {w:'possibly',s:2253.360,e:2253.680},{w:'do',s:2253.680,e:2253.920},{w:'anything',s:2253.920,e:2254.160},
    {w:'to',s:2254.160,e:2254.320},{w:'make',s:2254.320,e:2254.480},{w:'it',s:2254.480,e:2254.560},
    {w:'easier',s:2254.560,e:2254.800},{w:'to',s:2254.800,e:2254.880},{w:'have',s:2254.880,e:2255.040},
    {w:'kids,',s:2255.040,e:2255.280},{w:'we',s:2255.280,e:2255.440},{w:'are',s:2255.440,e:2255.600},
    {w:'going',s:2255.600,e:2256.400},{w:'to',s:2256.085,e:2256.165},{w:'have',s:2256.165,e:2256.325},
    {w:'a',s:2256.325,e:2256.485},{w:'race',s:2256.485,e:2256.565},{w:'to',s:2256.565,e:2256.725},
    {w:'the',s:2256.725,e:2256.885},{w:'bottom.',s:2256.725,e:2257.205},
    {w:'You',s:2270.120,e:2270.440},{w:'need',s:2270.440,e:2270.600},{w:'to',s:2270.600,e:2270.680},
    {w:'be',s:2270.680,e:2270.840},{w:'invested.',s:2270.840,e:2271.320},
  ]
  it('does not end the 26347297 join on kids, at 2249.440s',()=>{
    const cuts=[{startMs:2246000,endMs:2249440},{startMs:2270120,endMs:2271320}]
    const risk=clipEditorialAudit(cuts,join2634)
    expect(risk.some((x: EditorialFinding)=>x.code==='unfinished_ending'&&x.passageIndex===0)).toBe(true)
    const repaired=repairClipBoundaries(cuts,join2634)
    const first=repaired.cuts[0]!
    expect(first.endMs).toBeGreaterThanOrEqual(2257205)
    const last=join2634.filter((w: TranscriptWord)=>w.e*1000<=first.endMs+20&&w.s*1000<first.endMs).at(-1)
    expect(last?.w).toMatch(/bottom\./)
    expect(first.endMs).toBeGreaterThan(2249440)
  })

  it('pads about 80–120ms before a joined clause onset when there is room',()=>{
    const w: TranscriptWord[]=[
      {w:'We',s:0.200,e:0.400},{w:'were',s:0.400,e:0.600},{w:'done.',s:1.000,e:1.300},
      {w:'Then',s:2.000,e:2.200},{w:'we',s:2.200,e:2.400},{w:'started.',s:2.400,e:2.800},
    ]
    const repaired=repairClipBoundaries([
      {startMs:200,endMs:1300},
      {startMs:2000,endMs:2800},
    ],w)
    expect(repaired.cuts.length).toBeGreaterThanOrEqual(2)
    const second=repaired.cuts[1]!
    expect(second.startMs).toBeGreaterThanOrEqual(2000-JOIN_ONSET_PAD_MS-5)
    expect(second.startMs).toBeLessThan(2000)
    expect(second.startMs).toBeGreaterThanOrEqual(1300)
  })

  it('never lets the 100ms onset pad pull in prior speech; clamp at the previous word end',()=>{
    const w: TranscriptWord[]=[
      {w:'We',s:0.200,e:0.400},{w:'were',s:0.400,e:0.600},{w:'done.',s:1.000,e:1.300},
      {w:'Then',s:1.340,e:1.540},{w:'we',s:1.540,e:1.740},{w:'started.',s:1.740,e:2.100},
    ]
    // 40ms gap — an unclamped 100ms pad would start at 1240 and include "done."
    const repaired=repairClipBoundaries([
      {startMs:200,endMs:1300},
      {startMs:1340,endMs:2100},
    ],w)
    expect(repaired.cuts.length).toBeGreaterThanOrEqual(2)
    const second=repaired.cuts[1]!
    expect(second.startMs).toBeGreaterThanOrEqual(1300)
    expect(second.startMs).toBeLessThanOrEqual(1340)
    const priorSpeech=w.filter((word: TranscriptWord)=>word.s*1000<1340&&word.e*1000>second.startMs)
    expect(priorSpeech.map((word: TranscriptWord)=>word.w)).toEqual([])
  })
})

describe('ae48f53a 300ms tail after treaty.',()=>{
  const treaty: TranscriptWord[]=[
    {w:'we',s:379.655,e:379.815},{w:'need',s:379.815,e:379.975},{w:'an',s:379.975,e:380.135},
    {w:'international',s:380.135,e:380.615},{w:'treaty.',s:380.615,e:381.095},
  ]
  it('does not extend into the next word when I starts at the same instant',()=>{
    const w=[...treaty,{w:'I',s:381.095,e:381.335},{w:'think',s:381.335,e:381.575}]
    const repaired=repairClipBoundaries([{startMs:379655,endMs:381095}],w)
    expect(repaired.cuts[0]!.endMs).toBeLessThanOrEqual(381095)
    const spilled=w.filter((word: TranscriptWord)=>word.s*1000>=381095&&word.s*1000<repaired.cuts[0]!.endMs)
    expect(spilled.map((word: TranscriptWord)=>word.w).join(' ')).toBe('')
  })
  it('keeps a >=300ms tail when a breath remains before the next word',()=>{
    const w=[...treaty,{w:'I',s:381.495,e:381.735},{w:'think',s:381.735,e:381.975}]
    const repaired=repairClipBoundaries([{startMs:379655,endMs:381095}],w)
    const lastEnd=381095
    expect(repaired.cuts[0]!.endMs-lastEnd).toBeGreaterThanOrEqual(MIN_CLIP_TAIL_MS)
    expect(repaired.cuts[0]!.endMs).toBeLessThanOrEqual(381495)
  })
})

describe('held-draft publish policy',()=>{
  it('publishes non-critical leftovers flagged needsReview and drops only critical failures',()=>{
    expect(publishDisposition({
      risks:[{code:'continuation_opening',detail:'And if that happens',passageIndex:0}],
      qaPass:false,
      qaIssues:['The opening depends on omitted setup. Snap back to the antecedent.'],
    })).toBe('publish_needs_review')
    expect(publishDisposition({
      risks:[{code:'unfinished_ending',detail:'kids,',passageIndex:0}],
      qaPass:false,
      qaIssues:['Do not end on kids, — restore the clause.'],
    })).toBe('publish_needs_review')
    expect(publishDisposition({
      risks:[{code:'invalid_passage',detail:'Invalid source interval',passageIndex:0}],
      qaPass:false,
      qaIssues:['broken media: the source interval is empty'],
    })).toBe('drop')
    expect(publishDisposition({
      risks:[],
      qaPass:true,
      qaIssues:[],
    })).toBe('publish')
  })
  it('filters critical drafts out of the fallback and returns none if only critical remain',()=>{
    const held=[{id:'a',critical:true},{id:'b',critical:false},{id:'c',critical:true},{id:'d',critical:false}]
    const isCritical=(x:{critical:boolean})=>x.critical
    expect(chooseFallbackPublications(held,0,3,isCritical).map((x:{id:string})=>x.id)).toEqual(['b','d'])
    expect(chooseFallbackPublications(held.filter((x:{critical:boolean})=>x.critical),0,3,isCritical)).toEqual([])
    expect(chooseFallbackPublications(held,2,3,isCritical)).toEqual([])
    expect(chooseFallbackPublications([],0,3,isCritical)).toEqual([])
  })
  it('never publishes qaPass===null as clean, treats unknown codes and incoherent_passage as critical',()=>{
    expect(publishDisposition({
      risks:[],
      qaPass:null,
      qaIssues:[],
    })).toBe('publish_needs_review')
    expect(publishDisposition({
      risks:[{code:'incoherent_passage',detail:'Childhood anecdote does not belong to the later payoff',passageIndex:0}],
      qaPass:true,
      qaIssues:[],
    })).toBe('drop')
    expect(publishDisposition({
      risks:[{code:'future_unknown_code' as 'invalid_passage',detail:'not yet classified',passageIndex:0}],
      qaPass:true,
      qaIssues:[],
    })).toBe('drop')
    expect(publishDisposition({
      risks:[],
      qaPass:false,
      qaIssues:['qa_code_not_yet_classified: a brand new checker failed this draft'],
    })).toBe('drop')
  })
  it('documents that a listening-only remark is still non-blocking',()=>{
    expect(isNonBlockingEditorialQaIssue('Audio joins are marked as requiring listening review. No waveform was supplied.')).toBe(true)
  })

  it('treats un-prefixed QA prose as needsReview, never silently clean, and not critical',()=>{
    // Justification: free-form LLM notes ("Do not end on kids, — restore the
    // clause.") are editorial review flags, not media/content-destroying
    // failures. Treating them as critical previously dropped almost every
    // live draft. They must still surface to the user (needsReview), never
    // publish as a silent clean pass. Unknown snake_case codes stay critical.
    const prose='Do not end on kids, — restore the clause.'
    expect(isCriticalQaIssue(prose)).toBe(false)
    expect(isNeedsReviewQaIssue(prose)).toBe(true)
    expect(publishDisposition({risks:[],qaPass:true,qaIssues:[prose]})).toBe('publish_needs_review')
    expect(publishDisposition({risks:[],qaPass:true,qaIssues:['Audio joins require listening review. No waveform was supplied.']})).toBe('publish')
    expect(publishDisposition({
      risks:[],qaPass:true,
      qaIssues:['qa_code_not_yet_classified: a brand new checker failed this draft'],
    })).toBe('drop')
  })

  it('drops stale historical QA notes after a landed repair so an empty post-repair audit is clean',()=>{
    const historical=['The opening depends on omitted setup. Snap back to the antecedent.']
    const stale=regateAfterRepair({
      repaired:true,workingRisks:[],historicalQaIssues:historical,qaPassBefore:false,
    })
    expect(stale).toEqual({qaPass:true,qaIssues:[]})
    expect(publishDisposition({risks:[],qaPass:stale.qaPass,qaIssues:stale.qaIssues})).toBe('publish')
    const leftover=regateAfterRepair({
      repaired:true,
      workingRisks:[{code:'continuation_opening',detail:'And if that happens',passageIndex:0}],
      historicalQaIssues:historical,qaPassBefore:false,
    })
    expect(leftover.qaPass).toBe(false)
    expect(leftover.qaIssues.some((x:string)=>x.startsWith('continuation_opening:'))).toBe(true)
    expect(leftover.qaIssues).not.toContain(historical[0])
    const unrepaired=regateAfterRepair({
      repaired:false,workingRisks:[],historicalQaIssues:historical,qaPassBefore:false,
    })
    expect(unrepaired.qaPass).toBe(false)
    expect(unrepaired.qaIssues).toEqual(historical)
  })

  it('keeps critical historical QA notes through regateAfterRepair so the draft still drops (QA nit 3)',()=>{
    // Moving cut boundaries cannot fix broken media, wrong source content, or
    // a critical machine code. Those notes must survive a landed repair even
    // when the post-repair audit is empty, and the draft must still drop.
    const stale='The opening depends on omitted setup. Snap back to the antecedent.'
    const brokenMedia='broken media: the source interval is empty'
    const wrongSource='Wrong source content: this is a different interview.'
    const criticalCode='incoherent_passage: childhood anecdote does not belong to the later payoff'
    const unknownCode='qa_code_not_yet_classified: a brand new checker failed this draft'
    const historical=[stale,brokenMedia,wrongSource,criticalCode,unknownCode]
    for(const note of [brokenMedia,wrongSource,criticalCode,unknownCode])expect(isCriticalQaIssue(note)).toBe(true)
    expect(isCriticalQaIssue(stale)).toBe(false)

    const repaired=regateAfterRepair({
      repaired:true,workingRisks:[],historicalQaIssues:historical,qaPassBefore:false,
    })
    expect(repaired.qaPass).toBe(false)
    expect(repaired.qaIssues).toEqual([brokenMedia,wrongSource,criticalCode,unknownCode])
    expect(repaired.qaIssues).not.toContain(stale)
    expect(publishDisposition({risks:[],qaPass:repaired.qaPass,qaIssues:repaired.qaIssues})).toBe('drop')

    // Even a stale qaPass===true before repair cannot wash a critical note clean.
    const passedBefore=regateAfterRepair({
      repaired:true,workingRisks:[],historicalQaIssues:[brokenMedia],qaPassBefore:true,
    })
    expect(passedBefore).toEqual({qaPass:false,qaIssues:[brokenMedia]})
    expect(publishDisposition({risks:[],qaPass:passedBefore.qaPass,qaIssues:passedBefore.qaIssues})).toBe('drop')

    // Critical notes plus leftover non-critical working risks: still a drop, both kept.
    const withRisk=regateAfterRepair({
      repaired:true,
      workingRisks:[{code:'continuation_opening',detail:'And if that happens',passageIndex:0}],
      historicalQaIssues:[stale,brokenMedia],qaPassBefore:false,
    })
    expect(withRisk.qaIssues).toEqual([brokenMedia,'continuation_opening: And if that happens'])
    expect(publishDisposition({
      risks:[{code:'continuation_opening',detail:'And if that happens',passageIndex:0}],
      qaPass:withRisk.qaPass,qaIssues:withRisk.qaIssues,
    })).toBe('drop')

    // Unrepaired path keeps them too.
    const unrepaired=regateAfterRepair({
      repaired:false,workingRisks:[],historicalQaIssues:[brokenMedia],qaPassBefore:false,
    })
    expect(unrepaired.qaIssues).toContain(brokenMedia)
    expect(publishDisposition({risks:[],qaPass:unrepaired.qaPass,qaIssues:unrepaired.qaIssues})).toBe('drop')
  })
})

describe('clip agent auto-export and auto-motion policy',()=>{
  it('gates auto-export and autoPlanClipMotion on !needsReview; flagged clips still publish',()=>{
    const clean={clipId:'c1',projectId:'p1'}
    const flagged={clipId:'c1',projectId:'p1',needsReview:true}
    expect(shouldAutoExportPublishedClip(clean)).toBe(true)
    expect(shouldAutoPlanClipMotion(clean)).toBe(true)
    expect(shouldAutoExportPublishedClip({...clean,needsReview:false})).toBe(true)
    expect(shouldAutoExportPublishedClip(flagged)).toBe(false)
    expect(shouldAutoPlanClipMotion(flagged)).toBe(false)
    expect(shouldAutoExportPublishedClip({clipId:'c1',projectId:'p1',critical:true})).toBe(false)
    expect(shouldAutoPlanClipMotion({clipId:'c1',critical:true})).toBe(false)
    expect(shouldAutoExportPublishedClip({clipId:'c1',projectId:'p1',suppressed:true})).toBe(false)
    expect(shouldAutoExportPublishedClip({clipId:null,projectId:'p1'})).toBe(false)
  })
})

describe('clip agent export idempotency',()=>{
  it('is stable for the same clipId, edit version, and preset, and changes when any part changes',()=>{
    const a=clipAgentExportIdempotencyKey({clipId:'clip_1',editVersion:'edits_aaa',preset:'mp4:720p:9:16'})
    const b=clipAgentExportIdempotencyKey({clipId:'clip_1',editVersion:'edits_aaa',preset:'mp4:720p:9:16'})
    const c=clipAgentExportIdempotencyKey({clipId:'clip_1',editVersion:'edits_bbb',preset:'mp4:720p:9:16'})
    const d=clipAgentExportIdempotencyKey({clipId:'clip_2',editVersion:'edits_aaa',preset:'mp4:720p:9:16'})
    const e=clipAgentExportIdempotencyKey({clipId:'clip_1',editVersion:'edits_aaa',preset:'mp4:1080p:9:16'})
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).not.toBe(d)
    expect(a).not.toBe(e)
    expect(a).toMatch(/^[0-9a-f]{40}$/)
  })

  it('does not queue a second render when the idempotency key already exists',async()=>{
    const created:string[]=[]
    const store={
      byKey:new Map<string,{id:string;status:string}>(),
      async findByIdempotencyKey(key:string){return this.byKey.get(key)??null},
      async createQueuedExport(input:{renderId:string;idempotencyKey:string}){
        created.push(input.renderId)
        this.byKey.set(input.idempotencyKey,{id:input.renderId,status:'QUEUED'})
        return {created:true as const}
      },
    }
    let n=0
    const createId=()=>`render_${++n}`
    const args={
      workspaceId:'ws_1',projectId:'proj_1',clipId:'clip_1',
      filename:'clip.mp4',editVersion:editVersionFromSnapshot({cuts:[[0,1000]]}),
      createId,store,
    }
    const first=await queueClipExportOnce(args)
    const second=await queueClipExportOnce(args)
    expect(first.queued).toBe(true)
    expect(second.queued).toBe(false)
    if(second.queued===false)expect(second.reason).toBe('already_queued')
    expect(second.renderId).toBe(first.queued?first.renderId:undefined)
    expect(created).toEqual([first.queued?first.renderId:''])
  })

  it('returns the existing export when a unique-constraint race beats the find',async()=>{
    const existing={id:'render_winner',status:'QUEUED'}
    const store={
      async findByIdempotencyKey(){return null},
      async createQueuedExport(){
        return {created:false as const,existing}
      },
    }
    const result=await queueClipExportOnce({
      workspaceId:'ws_1',projectId:'proj_1',clipId:'clip_1',
      filename:'clip.mp4',editVersion:'v1',createId:()=>'render_loser',store,
    })
    expect(result).toEqual({
      queued:false,reason:'already_queued',renderId:'render_winner',
      idempotencyKey:clipAgentExportIdempotencyKey({clipId:'clip_1',editVersion:'v1'}),
    })
    expect(isUniqueConflict({code:'P2002'})).toBe(true)
    expect(isUniqueConflict({code:'P2003'})).toBe(false)
  })

  it('refuses to queue a needsReview, critical, or suppressed clip',async()=>{
    const store={
      async findByIdempotencyKey(){return null},
      async createQueuedExport(){throw new Error('must not create')},
    }
    const flagged=await queueClipExportOnce({
      workspaceId:'ws_1',projectId:'proj_1',clipId:'clip_1',
      filename:'clip.mp4',editVersion:'v1',needsReview:true,createId:()=>'render_x',store,
    })
    expect(flagged).toEqual({queued:false,reason:'not_exportable'})
    const result=await queueClipExportOnce({
      workspaceId:'ws_1',projectId:'proj_1',clipId:'clip_1',
      filename:'clip.mp4',editVersion:'v1',critical:true,createId:()=>'render_x',store,
    })
    expect(result).toEqual({queued:false,reason:'not_exportable'})
  })
})

type Word={w:string;s:number;e:number}
type Cut={startMs:number;endMs:number}
type Draft={clipId:string|null;rejected:boolean;cuts:Cut[];qaIssues:string[];words:Word[]}
type Fixture={runId:string;drafts:Draft[]}

const fixtureDir=dirname(fileURLToPath(import.meta.url))

function loadReplayFixture(name:string):Fixture{
  return JSON.parse(readFileSync(join(fixtureDir,'fixtures',name),'utf8')) as Fixture
}

function replayDraft(draft:Draft){
  if(draft.rejected||!draft.clipId||!draft.cuts.length){
    return {clipId:draft.clipId,disposition:'skip_rejected' as const,published:false,needsReview:false,dropped:false,critical:false}
  }
  const substantive=draft.qaIssues.filter((issue:string)=>!isNonBlockingEditorialQaIssue(issue))
  const words=draft.words
  const initialRisks=words.length?clipEditorialAudit(draft.cuts,words):[]
  const qaPassBefore:boolean|null=false
  const veto=shouldVetoPublish({risks:initialRisks,qaPass:qaPassBefore,qaIssues:substantive})
  let workingCuts=draft.cuts
  let workingRisks=initialRisks
  // Historical QA on these runs did not pass clean, so always apply the one
  // deterministic repair pass (same as orchestrator when qaPass !== true).
  void veto
  const revised=repairClipBoundaries(workingCuts,words,{maxEarlierSetupMs:12_000,maxLaterConclusionMs:6_500})
  let repairLanded=false
  if(revised.repaired){
    workingCuts=revised.cuts
    workingRisks=words.length?clipEditorialAudit(workingCuts,words):workingRisks
    repairLanded=true
  }
  const {qaPass,qaIssues:combinedIssues}=regateAfterRepair({
    repaired:repairLanded,workingRisks,historicalQaIssues:substantive,qaPassBefore,
  })
  const disposition=publishDisposition({risks:workingRisks,qaPass,qaIssues:combinedIssues})
  const critical=isCriticalEditorialFailure(workingRisks,combinedIssues)
  return {
    clipId:draft.clipId,
    disposition,
    published:disposition==='publish'||disposition==='publish_needs_review',
    needsReview:disposition==='publish_needs_review',
    dropped:disposition==='drop',
    critical,
  }
}

function replayRun(fixture:Fixture){
  type ReplayRow=ReturnType<typeof replayDraft>
  const results=fixture.drafts.map((d:Draft)=>replayDraft(d))
  let published=results.filter((r:ReplayRow)=>r.published)
  const dropped=results.filter((r:ReplayRow)=>r.dropped)
  let fallbackUsed=false
  if(!published.length){
    const usable=dropped.filter((r:ReplayRow)=>r.clipId&&!r.critical)
    const fallback=chooseFallbackPublications(usable,0,3,(r:{critical:boolean})=>r.critical)
    fallbackUsed=fallback.length>0
    published=fallback.map((r:ReplayRow)=>({...r,published:true,needsReview:true,dropped:false,disposition:'publish_needs_review' as const}))
  }
  return {
    runId:fixture.runId,
    published:published.length,
    clean:published.filter((r:ReplayRow)=>!r.needsReview).length,
    needsReview:published.filter((r:ReplayRow)=>r.needsReview).length,
    dropped:fallbackUsed?dropped.length-published.length:dropped.length,
    skipped:results.filter((r:ReplayRow)=>r.disposition==='skip_rejected').length,
    fallbackUsed,
  }
}

// Re-gate after repair drops stale historical QA notes, so clips whose
// post-repair audit is empty publish clean (QA projection: 10+4 and 13+3).
// Later post-repair checks change these vs 10+4 / 13+3:
// a3c clip_88a083b1 (52-minute jump) is a critical drop;
// 7574 clip_5afb4015 and clip_1d23876e are needsReview (truncated fixture words);
// a3c clip_a961dac4 and clip_af264bcf, and 7574 clip_31f33843 and clip_099c2071,
// are needsReview for unfulfilled "Here's why." setups.
const expectedA3c={published:13,clean:7,needsReview:6,dropped:2}
const expected7574={published:16,clean:9,needsReview:7,dropped:0}


describe('post-repair chronology gap and transcript coverage',()=>{
  it('flags a 52-minute splice as critical chronology when there is no story plan (88a083b1)',()=>{
    const cuts=[
      {startMs:685815,endMs:710575},
      {startMs:710655,endMs:726140},
      {startMs:3863830,endMs:3925190},
    ]
    const words=[
      {w:'I',s:725.0,e:725.2},{w:'think',s:725.2,e:725.5},{w:'he',s:725.5,e:725.7},{w:'played',s:725.7,e:726.0},{w:'that',s:726.0,e:726.1},{w:'game.',s:726.1,e:726.14},
      {w:'Talk',s:3863.830,e:3864.0},{w:'to',s:3864.0,e:3864.2},{w:'me.',s:3864.2,e:3864.5},
    ]
    const noPlan=clipEditorialAudit(cuts,words)
    expect(cuts[2]!.startMs-cuts[1]!.endMs).toBeGreaterThan(LONG_SOURCE_GAP_MS)
    expect(noPlan.some((x:EditorialRisk)=>x.code==='chronology'&&x.passageIndex===2)).toBe(true)
    expect(noPlan.some((x:EditorialRisk)=>x.code==='incoherent_passage'&&x.passageIndex===2)).toBe(true)
    expect(isCriticalEditorialFailure(noPlan,[])).toBe(true)
    expect(publishDisposition({risks:noPlan,qaPass:true,qaIssues:[]})).toBe('drop')
    // A planned jump still has to land on a self-contained sentence start.
    // "Talk to me." is a context-dependent uptake, so this is a chronology
    // misrepresentation even when a multi-beat story was planned.
    const planned=clipEditorialAudit(cuts,words,{storyPlan:true})
    expect(planned.some((x:EditorialRisk)=>x.code==='chronology'&&x.passageIndex===2)).toBe(true)
    expect(planned.some((x:EditorialRisk)=>x.code==='incoherent_passage'&&x.passageIndex===2)).toBe(true)
    expect(planned.some((x:EditorialRisk)=>x.code==='long_source_gap')).toBe(false)
    expect(isCriticalEditorialFailure(planned,[])).toBe(true)
    expect(publishDisposition({risks:planned,qaPass:true,qaIssues:planned.map((r:EditorialRisk)=>r.code+': '+r.detail)})).toBe('drop')
  })

  it('allows a planned long jump only when it lands on a self-contained sentence start',()=>{
    const cuts=[
      {startMs:0,endMs:1300},
      {startMs:5*60_000+4000,endMs:5*60_000+5000},
    ]
    const words=[
      {w:'We',s:0.0,e:0.2},{w:'created',s:0.2,e:0.5},{w:'the',s:0.5,e:0.7},{w:'commission.',s:0.7,e:1.2},
      {w:'Prices',s:304.0,e:304.3},{w:'went',s:304.3,e:304.5},{w:'up.',s:304.5,e:304.9},
    ]
    const planned=clipEditorialAudit(cuts,words,{storyPlan:true})
    expect(planned.some((x:EditorialRisk)=>x.code==='long_source_gap'&&x.passageIndex===1)).toBe(true)
    expect(planned.some((x:EditorialRisk)=>x.code==='chronology'||x.code==='incoherent_passage')).toBe(false)
    expect(publishDisposition({risks:planned,qaPass:true,qaIssues:planned.map((r:EditorialRisk)=>r.code+': '+r.detail)})).toBe('publish_needs_review')
  })

  it('flags a kept cut that the transcript window does not cover (5afb4015)',()=>{
    // Official fixture words only cover ~434–452s; the last kept cut is 549.9–559.3s
    // and ends "I'll give you one example." with no example in the clip.
    const cuts=[
      {startMs:450020,endMs:470705},
      {startMs:477400,endMs:506520},
      {startMs:549915,endMs:559290},
    ]
    const words=[
      {w:'Monopolies',s:450.02,e:450.40},{w:'and',s:450.40,e:450.58},
      {w:'oligopolies.',s:450.74,e:451.62},{w:'We',s:452.02,e:452.34},
    ]
    const risks=clipEditorialAudit(cuts,words)
    expect(risks.some((x:EditorialRisk)=>x.code==='uncovered_cut'&&x.passageIndex===0)).toBe(true)
    expect(risks.some((x:EditorialRisk)=>x.code==='uncovered_cut'&&x.passageIndex===2)).toBe(true)
    expect(isCriticalEditorialFailure(risks,[])).toBe(false)
    expect(publishDisposition({risks,qaPass:true,qaIssues:[]})).toBe('publish_needs_review')
  })

  it('flags 5afb4015 as unfinished_ending when full words cover the promised example that never comes',()=>{
    const spoken=words("Monopolies and oligopolies. What's an example of a monopoly that holds power over an extended period of time in our era? I'll give you one example.")
    const endMs=Math.round(spoken[spoken.length-1]!.e*1000)+200
    const risks=clipEditorialAudit([{startMs:0,endMs}],spoken)
    expect(risks.some((x:EditorialRisk)=>x.code==='unfinished_ending')).toBe(true)
    expect(isCriticalEditorialFailure(risks,[])).toBe(false)
    expect(publishDisposition({risks,qaPass:true,qaIssues:[]})).toBe('publish_needs_review')
  })

  it('fail-closes needsReview when a kept cut has no transcript words, including an empty word list',()=>{
    const cuts=[{startMs:0,endMs:5000},{startMs:8000,endMs:12000}]
    const empty=clipEditorialAudit(cuts,[])
    expect(empty.filter((x:EditorialRisk)=>x.code==='uncovered_cut').map((x:EditorialRisk)=>x.passageIndex)).toEqual([0,1])
    expect(publishDisposition({risks:empty,qaPass:true,qaIssues:[]})).toBe('publish_needs_review')
  })

  it('07fc0289 at 24.24s: source words are Came, not I came or He came',()=>{
    // VQ stitch ASR heard "I came" at the 24.24s join. Pipeline words after
    // "twenties." (794.895) go straight to "Came" (795.295). There is no I/He
    // token. Energy starts ~795.10s, so the onset of "Came" is slightly late
    // in the transcript (~195ms), not a missing pronoun. Repair pads 100ms
    // to 795.195, which still leaves some of that unaligned onset out.
    const words=[
      {w:'twenties.',s:794.175,e:794.895},
      {w:'Came',s:795.295,e:795.455},
      {w:'to',s:795.455,e:795.615},
      {w:'do',s:795.615,e:795.775},
      {w:'a',s:795.775,e:795.855},
      {w:'PhD',s:795.855,e:796.095},
    ]
    const between=words.filter((w:TranscriptWord)=>w.e>794.895&&w.s<795.295)
    expect(between.map((w:TranscriptWord)=>w.w)).toEqual([])
    expect(words.some((w:TranscriptWord)=>w.s>=794.9&&w.s<=795.4&&/^(?:I|He|he|i)$/.test(w.w))).toBe(false)
    const repaired=repairClipBoundaries([
      {startMs:769105,endMs:784320},
      {startMs:795295,endMs:806030},
    ],words)
    const join=repaired.cuts[1]!
    expect(join.startMs).toBeLessThan(795295)
    expect(join.startMs).toBeGreaterThanOrEqual(794895) // does not pull in "twenties."
    expect(join.startMs).toBe(795295-JOIN_ONSET_PAD_MS)
    const risks=clipEditorialAudit(repaired.cuts,words)
    // Not a missing I/He pronoun — do not invent a dangling-pronoun or
    // continuation flag from this join. Follow-up: punch-in/mask + 300ms tail.
    expect(risks.some((x:EditorialRisk)=>x.code==='dangling_pronoun_opening'||x.code==='continuation_opening')).toBe(false)
  })
})


describe('generalized unfinished_ending setups',()=>{
  function endingRisks(text:string){
    const w=words(text)
    const endMs=Math.round(w[w.length-1]!.e*1000)+200
    return clipEditorialAudit([{startMs:0,endMs}],w)
  }
  function hasUnfinished(text:string){
    return endingRisks(text).some((x:EditorialRisk)=>x.code==='unfinished_ending')
  }

  it('flags cataphoric setups, a trailing colon, an unanswered question, and a dangling preposition',()=>{
    expect(hasUnfinished("I'll give you one example.")).toBe(true)
    expect(hasUnfinished("Here's the thing.")).toBe(true)
    expect(hasUnfinished("Here's why.")).toBe(true)
    expect(hasUnfinished("Here's what.")).toBe(true)
    expect(hasUnfinished('Let me tell you.')).toBe(true)
    expect(hasUnfinished('The reason is.')).toBe(true)
    expect(hasUnfinished('For instance.')).toBe(true)
    expect(hasUnfinished('Here is the list:')).toBe(true)
    expect(hasUnfinished('What happens next?')).toBe(true)
    expect(hasUnfinished('I was thinking about')).toBe(true)
  })

  it('does not flag normal complete endings or a question that already has an answer',()=>{
    expect(hasUnfinished("That's the reason.")).toBe(false)
    expect(hasUnfinished('Here it is.')).toBe(false)
    expect(hasUnfinished('Let me tell you, it worked.')).toBe(false)
    expect(hasUnfinished("That's one example.")).toBe(false)
    expect(hasUnfinished('What do we do? We fight.')).toBe(false)
    expect(hasUnfinished("That's what I voted for.")).toBe(false)
    expect(hasUnfinished("That's the point, right?")).toBe(false)
  })
})

describe('held-draft replay of live 0-published runs',()=>{

  it('aprun_a3c71b5a: 7 clean, 6 needsReview, 2 dropped after chronology/coverage/setup checks',()=>{
    const counts=replayRun(loadReplayFixture('aprun_a3c71b5a.replay.json'))
    expect(counts.runId).toBe('aprun_a3c71b5acee74a5ea52192768053a1ea')
    expect(counts).toMatchObject(expectedA3c)
  })

  it('aprun_7574d85f: 9 clean, 7 needsReview, 0 dropped after chronology/coverage/setup checks',()=>{
    const counts=replayRun(loadReplayFixture('aprun_7574d85f.replay.json'))
    expect(counts.runId).toBe('aprun_7574d85f5ce64fcdb58a05c2e0b5b8e6')
    expect(counts).toMatchObject(expected7574)
  })
})
