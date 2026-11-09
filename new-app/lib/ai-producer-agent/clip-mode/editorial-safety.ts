/** Clip-only editorial guardrails. Transcript markers identify risks for Flow/QA;
 * they do not prove semantic meaning, so the specialist must judge context.
 * Source word timestamps are seconds; selection timestamps are milliseconds.
 */
export type TimedWord={w:string;s:number;e:number}
export type ClipSpan={startMs:number;endMs:number;kind?:string}
export type EditorialRiskCode=
  |'referential_opening'|'missing_qualification'|'unfinished_ending'
  |'chronology'|'invalid_passage'|'false_start_opening'|'cut_context_reference'
export type EditorialRisk={
  code:EditorialRiskCode
  detail:string
  passageIndex:number
}
const REF_OPEN=/^(?:that(?:'s| is) why|like i said|as i said|as we said|as mentioned|so|and|this|that|those|these|it|they|he|she|which|because|but|anyway|again)\b/i
const QUAL_OPEN=/^(?:but|however|unless|except|only if|as long as|provided that|on the other hand|the catch is|with one exception|not if)\b/i
const DANGLING=/\b(?:but|because|if|unless|although|however|which|so|and|the thing is|what i mean is)\s*[,—-]?$/i
const FILLER_OPEN=/^(?:i mean[,.]?\s*)+(?:um|uh|like|you know|so)?[,.]?\s*/i
const FALSE_START=/^(?:i mean[,.]?\s+)+/i
const CUT_CONTEXT_OPEN=/^(?:you keep(?: talking)?|that(?:'s| is) not (?:what|why)|i(?:'m| am) (?:not )?talking about|as i (?:said|mentioned)|going back to|to (?:your|that) (?:question|point)|like i(?: said| mentioned))\b/i
const SENTENCE_END=/[.!?]["']?$/
const PUBLISH_VETO_CODES=new Set<EditorialRiskCode>([
  'referential_opening','unfinished_ending','missing_qualification',
  'chronology','invalid_passage','false_start_opening','cut_context_reference',
])
const QA_VETO=/qualif|mislead|misrepresent|changed meaning|false impression|missing setup|payoff before|unresolved referen|context missing|mid-sentence|mid sentence|unfinished ending|false start|stammer|broken opening|cut (?:question|exchange|context)|backward refer|not self-contained|dangling/i

function phrase(words:readonly TimedWord[]):string{
  return words.map(x=>x.w).join(' ').replace(/[\u2018\u2019]/g,"'").replace(/\s+([,.;:!?])/g,'$1').trim()
}
function at(words:readonly TimedWord[],from:number,to:number):TimedWord[]{
  return words.filter(w=>w.e*1000>from&&w.s*1000<to)
}
function endsMidSentence(tail:string):boolean{
  if(DANGLING.test(tail))return true
  const trimmed=tail.trim()
  if(!trimmed)return false
  // A complete landing usually has sentence punctuation, or is a short
  // exclamation. A clause that just stops mid-thought does not.
  if(SENTENCE_END.test(trimmed))return false
  const last=trimmed.split(/\s+/).pop()??''
  return last.length>0 && !/[.!?…]$/.test(trimmed)
}

export function clipEditorialAudit(
  cuts:readonly ClipSpan[],words:readonly TimedWord[],
):EditorialRisk[]{
  const issues:EditorialRisk[]=[]
  const ordered=cuts.filter(x=>x.kind!=='visual_action')
  for(let i=0;i<ordered.length;i++){
    const cut=ordered[i]!
    if(!Number.isFinite(cut.startMs)||!Number.isFinite(cut.endMs)||cut.endMs<=cut.startMs){
      issues.push({code:'invalid_passage',detail:'Invalid source interval',passageIndex:i});continue
    }
    if(i>0&&cut.startMs<ordered[i-1]!.startMs)
      issues.push({code:'chronology',detail:'A source passage plays before an earlier passage',passageIndex:i})
    const inside=at(words,cut.startMs,cut.endMs)
    if(!inside.length)continue // visual-only moments need visual QA, never fake ASR findings
    const first=phrase(inside.slice(0,8)).toLowerCase()
    // A stitched story may legitimately open a later passage with "so" when
    // its preceding output passage already supplied the antecedent. Flow does
    // the semantic join audit for those. Flag only the first audible opening.
    if(i===0&&(REF_OPEN.test(first)||FALSE_START.test(first))){
      const code:EditorialRiskCode=FALSE_START.test(first)&&!REF_OPEN.test(first)?'false_start_opening':'referential_opening'
      issues.push({code,detail:'Opening may refer to missing setup or start mid-thought: '+first.slice(0,75),passageIndex:i})
    }
    if(i>0){
      const prev=ordered[i-1]!
      const gap=at(words,prev.endMs,cut.startMs)
      const gapText=phrase(gap)
      if((CUT_CONTEXT_OPEN.test(first)||/\?/.test(gapText))&&(CUT_CONTEXT_OPEN.test(first)||/^(?:well|so|right|look)\b/i.test(first))){
        if(CUT_CONTEXT_OPEN.test(first)||/\?/.test(gapText)&&CUT_CONTEXT_OPEN.test(first)){
          issues.push({code:'cut_context_reference',detail:'Passage answers or refers to a removed exchange: '+first.slice(0,90),passageIndex:i})
        }
      }
      if(CUT_CONTEXT_OPEN.test(first)){
        if(!issues.some(x=>x.code==='cut_context_reference'&&x.passageIndex===i))
          issues.push({code:'cut_context_reference',detail:'Passage refers to a removed exchange: '+first.slice(0,90),passageIndex:i})
      }
    }
    const tail=phrase(inside.slice(-8))
    if(endsMidSentence(tail))
      issues.push({code:'unfinished_ending',detail:'Ending appears to leave a clause unfinished: '+tail.slice(-90),passageIndex:i})
    // Qualifier immediately following the selected end may change the claim.
    // Look at the ORIGINAL source, not the assembled timeline. Do not count
    // words already retained in the next selected passage.
    const nextSource=at(words,cut.endMs,cut.endMs+6500)
      .filter(w=>!ordered.some(other=>other!==cut&&w.s*1000>=other.startMs&&w.e*1000<=other.endMs))
    const tailContext=phrase(nextSource.slice(0,9)).toLowerCase()
    if(QUAL_OPEN.test(tailContext))
      issues.push({code:'missing_qualification',detail:'Source may continue with a meaning-changing qualification: '+tailContext.slice(0,90),passageIndex:i})
  }
  return issues
}

export function shouldVetoPublish(input:{
  risks:readonly EditorialRisk[]
  qaPass:boolean|null
  qaIssues:readonly string[]
}):boolean{
  if(input.risks.some(r=>PUBLISH_VETO_CODES.has(r.code)))return true
  if(input.qaPass===false&&input.qaIssues.some(issue=>QA_VETO.test(issue)))return true
  return false
}

function nextSentenceStart(words:readonly TimedWord[],fromMs:number,limitMs:number):number|null{
  const region=at(words,fromMs,limitMs)
  if(!region.length)return null
  // Skip a false start / "I mean," preface, then land on the restated thought.
  let i=0
  const text=phrase(region)
  if(FALSE_START.test(text)||FILLER_OPEN.test(text)){
    while(i<region.length&&/^(?:i|mean|um|uh|like|you|know|so)$/i.test(region[i]!.w.replace(/[.,!?]/g,'')))i++
    if(i>0&&i<region.length)return Math.round(region[i]!.s*1000)
  }
  for(let j=0;j<region.length-1;j++){
    if(SENTENCE_END.test(region[j]!.w))return Math.round(region[j+1]!.s*1000)
  }
  return null
}

function lastCompletedEnd(words:readonly TimedWord[],startMs:number,endMs:number):number|null{
  const region=at(words,startMs,endMs)
  for(let i=region.length-1;i>=0;i--){
    if(SENTENCE_END.test(region[i]!.w))return Math.round(region[i]!.e*1000)
  }
  return null
}

function nextCompletedEnd(words:readonly TimedWord[],endMs:number,limitMs:number):number|null{
  const region=at(words,endMs,limitMs)
  for(const w of region){
    if(SENTENCE_END.test(w.w))return Math.round(w.e*1000)
  }
  return null
}

function gapHasQuestion(words:readonly TimedWord[],fromMs:number,toMs:number):boolean{
  return /\?/.test(phrase(at(words,fromMs,toMs)))
}

export type BoundaryRepair={
  cuts:ClipSpan[]
  repaired:boolean
  notes:string[]
  contextBridges:Array<{atMs:number;text:string;passageIndex:number}>
}

/** Trim or extend to clean sentence boundaries. Never pads toward a target. */
export function repairClipBoundaries(
  cuts:readonly ClipSpan[],
  words:readonly TimedWord[],
  opts:{maxEarlierSetupMs?:number;maxLaterConclusionMs?:number}={},
):BoundaryRepair{
  const earlier=Math.max(0,opts.maxEarlierSetupMs??12_000)
  const later=Math.max(0,opts.maxLaterConclusionMs??6_500)
  const notes:string[]=[]
  const contextBridges:BoundaryRepair['contextBridges']=[]
  const next:ClipSpan[]=cuts.map(c=>({...c}))
  for(let i=0;i<next.length;i++){
    const cut=next[i]!
    const prevEnd=i>0?next[i-1]!.endMs:cut.startMs-earlier
    const floor=i===0?cut.startMs-earlier:Math.max(prevEnd,cut.startMs-earlier)
    const ceiling=i+1<next.length?Math.min(next[i+1]!.startMs,cut.endMs+later):cut.endMs+later
    if(i===0){
      const opening=phrase(at(words,cut.startMs,cut.startMs+8000))
      if(FALSE_START.test(opening)||REF_OPEN.test(opening)||FILLER_OPEN.test(opening)){
        const start=nextSentenceStart(words,cut.startMs,Math.min(cut.startMs+earlier,cut.endMs-3000))
        if(start!=null&&start>cut.startMs&&start<cut.endMs-3000){
          notes.push('Trimmed false-start or referential opening to a self-contained sentence')
          cut.startMs=start
        }
      }
    }else{
      const first=phrase(at(words,cut.startMs,cut.startMs+8000))
      if(CUT_CONTEXT_OPEN.test(first)&&gapHasQuestion(words,prevEnd,cut.startMs)){
        const question=at(words,prevEnd,cut.startMs)
        const qDur=((question.at(-1)?.e??0)-(question[0]?.s??0))*1000
        if(question.length&&qDur>0&&qDur<=8000&&(question[0]!.s*1000)>=floor){
          cut.startMs=Math.round(question[0]!.s*1000)
          notes.push('Restored the preceding question so the answer is self-contained')
        }else{
          const qText=phrase(question).replace(/\s+/g,' ').trim().slice(0,80)
          if(qText){
            contextBridges.push({atMs:cut.startMs,text:qText,passageIndex:i})
            notes.push('Added a source-grounded context bridge for a removed exchange')
          }
        }
      }
    }
    const tail=phrase(at(words,Math.max(cut.startMs,cut.endMs-8000),cut.endMs))
    if(endsMidSentence(tail)){
      const extended=nextCompletedEnd(words,cut.endMs,ceiling)
      if(extended!=null&&extended>cut.endMs){
        cut.endMs=extended
        notes.push('Extended a mid-sentence ending to the next complete sentence')
      }else{
        const trimmed=lastCompletedEnd(words,cut.startMs,cut.endMs)
        if(trimmed!=null&&trimmed<cut.endMs&&trimmed-cut.startMs>=3000){
          cut.endMs=trimmed
          notes.push('Trimmed a mid-sentence ending back to the last complete sentence')
        }
      }
    }
    const qualifier=at(words,cut.endMs,Math.min(ceiling,cut.endMs+later))
      .filter(w=>!next.some((other,j)=>j!==i&&w.s*1000>=other.startMs&&w.e*1000<=other.endMs))
    if(QUAL_OPEN.test(phrase(qualifier.slice(0,9)).toLowerCase())){
      const end=nextCompletedEnd(words,cut.endMs,Math.min(ceiling,cut.endMs+later))
      if(end!=null){cut.endMs=end;notes.push('Included a meaning-changing qualifier after the ending')}
    }
  }
  const valid=next.filter(c=>c.endMs-c.startMs>=3000)
  return {cuts:valid,repaired:notes.length>0,notes,contextBridges}
}

export function contextBridgeCaption(text:string):string{
  const clean=text.replace(/\s+/g,' ').trim()
  if(!clean)return ''
  const clipped=clean.length<=72?clean:clean.slice(0,69).replace(/\s+\S*$/,'')+'…'
  return clipped
}

/** Compact QA evidence for multi-hour transcripts: every selected passage
 * plus a short neighborhood, not the entire 10-hour word list. */
export function qaTranscriptWindow(
  words:readonly TimedWord[],
  cuts:readonly ClipSpan[],
  sourceRange:[number,number],
):TimedWord[]{
  if(words.length<=8_000)return words.filter(w=>w.e*1000>sourceRange[0]&&w.s*1000<sourceRange[1])
  const keep=new Set<TimedWord>()
  const neighborhoods:Array<[number,number]>=[[sourceRange[0],sourceRange[0]+20_000],[sourceRange[1]-20_000,sourceRange[1]]]
  for(const cut of cuts){
    neighborhoods.push([cut.startMs-20_000,cut.endMs+12_000])
  }
  for(const w of words){
    const mid=(w.s+w.e)*500
    if(neighborhoods.some(([a,b])=>mid>=a&&mid<=b))keep.add(w)
  }
  return [...keep].sort((a,b)=>a.s-b.s)
}


export function honorTargetDuration(
  cuts:readonly ClipSpan[],
  words:readonly TimedWord[],
  targetSeconds:number,
):{cuts:ClipSpan[];tightened:boolean;note?:string}{
  const dur=()=>cuts.reduce((n,c)=>n+Math.max(0,c.endMs-c.startMs),0)/1000
  let next=cuts.map(c=>({...c}))
  let duration=next.reduce((n,c)=>n+Math.max(0,c.endMs-c.startMs),0)/1000
  if(!(targetSeconds>0)||duration<=targetSeconds*1.25){
    const note=targetSeconds>0&&duration>targetSeconds+10
      ? `Natural length ${Math.round(duration)}s exceeds the ${targetSeconds}s request; kept a complete ending rather than padding or chopping meaning.`
      : undefined
    return {cuts:next,tightened:false,note}
  }
  // Prefer ending on the last complete sentence inside the target window
  // before dropping a whole passage.
  const last=next[next.length-1]!
  const budgetMs=Math.round(targetSeconds*1000)
  const keptBefore=next.slice(0,-1).reduce((n,c)=>n+c.endMs-c.startMs,0)
  const lastBudget=budgetMs-keptBefore
  if(lastBudget>=3000){
    const trimmed=lastCompletedEnd(words,last.startMs+3000,last.startMs+lastBudget)
    if(trimmed!=null&&trimmed<last.endMs){
      last.endMs=trimmed
      return {cuts:next,tightened:true,note:`Tightened a long take to ${Math.round((keptBefore+trimmed-last.startMs)/1000)}s at a complete sentence.`}
    }
  }
  while(next.length>2){
    next=next.slice(0,-1)
    duration=next.reduce((n,c)=>n+c.endMs-c.startMs,0)/1000
    if(duration<=targetSeconds*1.25){
      return {cuts:next,tightened:true,note:`Dropped a trailing passage so the story could honor the ${targetSeconds}s request.`}
    }
  }
  return {cuts:cuts.map(c=>({...c})),tightened:false,
    note:`Natural length ${Math.round(dur())}s exceeds the ${targetSeconds}s request; kept a complete story rather than cutting meaning.`}
}

export function clipEditorialInstructions():string{
  return [
    'CLIP EDITORIAL CONTRACT — applies to this clip only:',
    'Before selecting or shortening any footage, state the intended POINT in ONE clear sentence (claim, story or joke), and preserve that same point through every cut.',
    'A first line starting with “that’s why”, “so”, “and”, “this”, “like I said”, “I mean,” or another backward reference or false start is NOT self-contained; return to the relevant one or two setup sentences. Never add a long preamble or dead air.',
    'Hook with the strongest authentic line that raises a question or tension, but do not move the payoff before its explanation or fabricate/reorder spoken meaning.',
    'For stitched stories, every section must be understandable from the earlier sections in the OUTPUT, not from unplayed original source. If an answer refers to a removed interviewer exchange, include that question or do not use the answer.',
    'Never remove a but, only if, unless, exception, caveat, negation or qualifier when it changes the speaker’s actual meaning.',
    'Inspect at least the NEXT 6.5 SECONDS of original source after every proposed END for a late qualifier or concluding thought, and INCLUDE it when materially needed.',
    'End exactly after the authentic full conclusion or joke landing. Mid-sentence endings are a failure. Short is fine; never pad to the target duration. Cut filler and search detours, not meaning.',
    'Every distinct clip must stand alone, have its own reason to exist, and not be a near-duplicate.',
    'QA must explicitly FAIL a meaning-changing omission, a stammered or referential opening, a mid-sentence ending, or payoff-before-setup and identify the original words/source times to repair. Fix at the source word IDs, not via generated dialogue.',
    'Check proper-name spelling in visible text against evidence; ASR alone is NOT proof of a name spelling. Flag uncertain names instead of inventing corrections.',
    'Caption/title/graphic placement must stay in the 9:16 safe area and avoid the visible face and mouth; if face location is unknown, use conservative non-center-face areas and flag for visual review.',
  ].join(' ')
}
