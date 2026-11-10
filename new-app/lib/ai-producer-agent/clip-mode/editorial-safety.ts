/** Clip-only editorial guardrails. Transcript markers identify risks for Flow/QA;
 * they do not prove semantic meaning, so the specialist must judge context.
 * Source word timestamps are seconds; selection timestamps are milliseconds.
 */
export type TimedWord={w:string;s:number;e:number}
export type ClipSpan={startMs:number;endMs:number;kind?:string}
export type EditorialRiskCode=
  |'referential_opening'|'missing_qualification'|'unfinished_ending'
  |'chronology'|'invalid_passage'|'false_start_opening'|'cut_context_reference'
  |'dangling_pronoun_opening'|'continuation_opening'|'incoherent_passage'|'mid_phrase_opening'
export type EditorialRisk={
  code:EditorialRiskCode
  detail:string
  passageIndex:number
}
const REF_OPEN=/^(?:that(?:'s| is) why|like i said|as i said|as we said|as mentioned|so|and|this|that|those|these|it|they|he|she|which|because|but|anyway|again)\b/i
const QUAL_OPEN=/^(?:but|however|unless|except|only if|as long as|provided that|on the other hand|the catch is|with one exception|not if)\b/i
const CONCLUDING_FOLLOW=/^(?:and those|and that(?:'s| is)|and this is|so (?:that|those) are|that(?:'s| is) (?:the|why|what|one)|the point is)\b/i
const DANGLING=/\b(?:but|because|if|unless|although|however|which|so|and|the thing is|what i mean is)\s*[,—-]?$/i
const FILLER_OPEN=/^(?:i mean[,.]?\s*)+(?:um|uh|like|you know|so)?[,.]?\s*/i
const FALSE_START=/^(?:i mean[,.]?\s+)+/i
const LEADING_FILLER=/^(?:(?:uh|um|ah|er|like|you know)[,.]?\s*)+/i
const CONTINUATION_OPEN=/^(?:(?:uh|um|ah|er)[,.]?\s*)*(?:also|and|but|so|which|because|anyway|again)\b/i
const DANGLING_PRONOUN_OPEN=/^(?:(?:uh|um|ah|er)[,.]?\s*)*(?:her|his|their|they|she|he)\b/i
const CUT_CONTEXT_OPEN=/^(?:you keep(?: talking)?|that(?:'s| is) not (?:what|why)|i(?:'m| am) (?:not )?talking about|as i (?:said|mentioned)|going back to|to (?:your|that) (?:question|point)|like i(?: said| mentioned))\b/i
const SENTENCE_END=/[.!?]["']?$/
const PUBLISH_VETO_CODES=new Set<EditorialRiskCode>([
  'referential_opening','unfinished_ending','missing_qualification',
  'chronology','invalid_passage','false_start_opening','cut_context_reference',
  'dangling_pronoun_opening','continuation_opening','incoherent_passage','mid_phrase_opening',
])
const QA_VETO=/qualif|mislead|misrepresent|changed meaning|false impression|missing setup|payoff before|unresolved referen|context missing|mid-sentence|mid sentence|unfinished ending|false start|stammer|broken opening|cut (?:question|exchange|context)|backward refer|not self-contained|dangling|antecedent|continuation opener|unrelated passage|incoherent|mid-phrase|mid phrase/i
const STOPWORDS=new Set('the a an and or but for nor so if as at by to of in on with from this that these those he she it they them his her their its my our your we us i you was were are is be been being have has had do did does not no yes just like know think really very then than when what who whom which where how why also too still even only into about over after before because while there here one two three come came said say going gone want well yeah right kind sort thing things people'.split(' '))
const WEAK_OVERLAP=new Set('first time make made come came remember remembers tell telling told year years day days way ways good great want wants need needs really much back going gone take takes took give gave given'.split(' '))

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
    const first=stripLeadingFiller(phrase(inside.slice(0,8))).toLowerCase()
    const priorText=phrase(ordered.slice(0,i).flatMap(c=>at(words,c.startMs,c.endMs)))
    if(startsMidPhrase(words,cut.startMs)){
      issues.push({code:'mid_phrase_opening',detail:'Passage starts mid-phrase: '+first.slice(0,75),passageIndex:i})
    }
    if(FALSE_START.test(first)||FILLER_OPEN.test(first)){
      issues.push({code:'false_start_opening',detail:'Opening starts mid-thought or with a false start: '+first.slice(0,75),passageIndex:i})
    }
    if(isStrongContinuation(first)||(isSoftContinuation(first)&&i===0)){
      issues.push({code:'continuation_opening',detail:'Passage opens with a continuation word that needs earlier context: '+first.slice(0,75),passageIndex:i})
    }
    if(DANGLING_PRONOUN_OPEN.test(first)&&!pronounHasAntecedent(first,priorText)){
      issues.push({code:'dangling_pronoun_opening',detail:'Opening pronoun has no antecedent in earlier output: '+first.slice(0,75),passageIndex:i})
    }else if(i===0&&(REF_OPEN.test(first))){
      issues.push({code:'referential_opening',detail:'Opening may refer to missing setup or start mid-thought: '+first.slice(0,75),passageIndex:i})
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
  for(const risk of passageCoherenceRisks(ordered,words))issues.push(risk)
  return issues
}

function stripLeadingFiller(text:string):string{
  return text.replace(LEADING_FILLER,'').trim()
}
function startsMidPhrase(words:readonly TimedWord[],startMs:number):boolean{
  const prev=words.filter(w=>w.e*1000<=startMs+20).at(-1)
  if(!prev)return false
  const token=prev.w.trim()
  if(!token)return false
  if(SENTENCE_END.test(token))return false
  // A pause after a complete word is still mid-sentence without punctuation.
  const next=words.find(w=>w.s*1000>=startMs-20)
  if(!next)return false
  return true
}
function pronounHasAntecedent(opening:string,priorText:string):boolean{
  const lead=(stripLeadingFiller(opening).split(/\s+/)[0]??'').toLowerCase().replace(/[^a-z]/g,'')
  const prior=priorText.toLowerCase()
  if(!prior.trim())return false
  if(/^(?:she|her)$/.test(lead))return /\b(?:she|her|hers|woman|women|mother|mom|grandmother|grandma|tete|sister|daughter|wife|girl|lady)\b/i.test(prior)
  if(/^(?:he|his)$/.test(lead))return /\b(?:he|his|him|man|men|father|dad|grandfather|grandpa|brother|son|husband|boy)\b/i.test(prior)
  if(/^(?:they|their|these|those)$/.test(lead))return /\b(?:they|them|their|people|folks|both|two|women|men|family|parents)\b/i.test(prior)
  if(/^(?:it|this|that)$/.test(lead))return /\b(?:it|this|that|idea|thing|issue|story|point)\b/i.test(prior)
  return prior.split(/\s+/).length>=8
}
const TOKEN_ALIASES:Record<string,string>={
  grandma:'grandmother',grandpa:'grandfather',mom:'mother',dad:'father',
  tete:'grandmother',kids:'children',kid:'children',
}
function normalizeToken(raw:string):string{
  const alias=TOKEN_ALIASES[raw]
  if(alias)return alias
  if(raw.length>=7&&raw.endsWith('s'))return raw.slice(0,-1)
  return raw
}
function contentTokens(text:string):Set<string>{
  const out=new Set<string>()
  for(const raw of text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/)){
    if(raw.length<4||STOPWORDS.has(raw))continue
    out.add(normalizeToken(raw))
  }
  return out
}
function passageCoherenceRisks(cuts:readonly ClipSpan[],words:readonly TimedWord[]):EditorialRisk[]{
  const issues:EditorialRisk[]=[]
  const texts=cuts.map(c=>phrase(at(words,c.startMs,c.endMs)))
  const tokens=texts.map(contentTokens)
  for(let i=0;i<cuts.length;i++){
    const dur=cuts[i]!.endMs-cuts[i]!.startMs
    if(dur<8000||tokens[i]!.size<6)continue
    const others=new Set<string>()
    for(let j=0;j<cuts.length;j++)if(j!==i)for(const tok of tokens[j]!)others.add(tok)
    if(others.size<6)continue
    const later=new Set<string>()
    for(let j=i+1;j<cuts.length;j++)for(const tok of tokens[j]!)later.add(tok)
    const shared=sharedCount(tokens[i]!,others)
    const sharedLater=later.size?sharedCount(tokens[i]!,later):shared
    // Early passages must earn their place in the later payoff, not just
    // sit next to a weakly related family mention.
    if(i<cuts.length-1&&sharedLater<1&&shared<2){
      issues.push({code:'incoherent_passage',detail:'Passage does not clearly belong to the later story payoff: '+texts[i]!.slice(0,90),passageIndex:i})
    }
  }
  return issues
}
function lastSentenceStart(words:readonly TimedWord[],beforeMs:number,floorMs:number):number|null{
  // Exclusive of beforeMs so a start already on a sentence boundary
  // walks to the previous sentence, not back to itself.
  const region=at(words,floorMs,beforeMs)
  if(!region.length)return null
  for(let i=region.length-1;i>=0;i--){
    if(SENTENCE_END.test(region[i]!.w)){
      const next=region[i+1]
      if(next&&next.s*1000<beforeMs)return Math.round(next.s*1000)
      if(!next){
        // Sentence ended at the close of this region; the next word is at/after beforeMs.
        continue
      }
    }
  }
  return Math.round(region[0]!.s*1000)
}
// And/But/So + a personal pronoun ("And he was a great student") is a
// strong continuation: the referent almost always lives in omitted prior
// speech. Demonstratives and "it" ("And that", "So this", "But it") are
// not: they often start self-contained hooks or dummy-subject sentences
// ("And that was the point.", "So this is how we start.", "But it didn't
// matter."). A first-passage And/So/But is still a soft continuation.
const CONTINUATION_PRONOUN_OPEN=/^(?:(?:uh|um|ah|er)[,.]?\s*)*(?:and|but|so)\s+(?:he|she|they|him|her|his|their)\b/i
/** "And he was a great student" is a failure even when the previous word ends a sentence. */
function isContinuationPronounOpen(opening:string):boolean{
  return CONTINUATION_PRONOUN_OPEN.test(stripLeadingFiller(opening))
}
function isStrongContinuation(opening:string):boolean{
  const t=stripLeadingFiller(opening)
  if(isContinuationPronounOpen(t))return true
  if(/^(?:also|which|because|anyway|again)\b/i.test(t))return true
  if(/^(?:but|and|so)\s+also\b/i.test(t))return true
  return false
}
function isSoftContinuation(opening:string):boolean{
  const t=stripLeadingFiller(opening)
  return /^(?:and|so|but)\b/i.test(t)&&!isStrongContinuation(t)
}
function sentenceEndsIn(words:readonly TimedWord[],startMs:number,endMs:number):number[]{
  return at(words,startMs,endMs)
    .filter(w=>SENTENCE_END.test(w.w)&&!/\.{2,}$|…$/.test(w.w))
    .map(w=>Math.round(w.e*1000))
}
function sharedCount(a:Set<string>,b:Set<string>):number{
  let n=0
  for(const tok of a)if(b.has(tok)&&!WEAK_OVERLAP.has(tok))n++
  return n
}
function snapToSelfContainedStart(words:readonly TimedWord[],startMs:number,floorMs:number,endMs:number):number|null{
  let start=startMs
  if(startsMidPhrase(words,start)){
    const snapped=lastSentenceStart(words,start,floorMs)
    if(snapped!=null&&snapped<start&&snapped<endMs-3000)start=snapped
  }
  // If the sentence we landed on still needs a short identifier
  // ("My grandmother." before "She was the ninth..."), include it.
  for(let n=0;n<2;n++){
    const opening=stripLeadingFiller(phrase(at(words,start,start+8000)))
    const prior=phrase(at(words,floorMs,start))
    const needsMore=DANGLING_PRONOUN_OPEN.test(opening)||CONTINUATION_OPEN.test(opening)||REF_OPEN.test(opening.toLowerCase())
    if(!needsMore)break
    if(needsMore&&DANGLING_PRONOUN_OPEN.test(opening)&&pronounHasAntecedent(opening,prior)){
      // antecedent is in the not-yet-included prior region; pull in the previous sentence
    }else if(!DANGLING_PRONOUN_OPEN.test(opening)&&!CONTINUATION_OPEN.test(opening))break
    const earlier=lastSentenceStart(words,start,floorMs)
    if(earlier==null||earlier>=start||earlier>=endMs-3000)break
    start=earlier
  }
  return start!==startMs&&start<endMs-3000?start:null
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
  const tailLock=new WeakMap<ClipSpan,number>()
  const next:ClipSpan[]=cuts.map(c=>({...c}))
  for(let i=0;i<next.length;i++){
    const cut=next[i]!
    const prevEnd=i>0?next[i-1]!.endMs:cut.startMs-earlier
    const floor=i===0?cut.startMs-earlier:Math.max(prevEnd,cut.startMs-earlier)
    const ceiling=i+1<next.length?Math.min(next[i+1]!.startMs,cut.endMs+later):cut.endMs+later
    const opening=stripLeadingFiller(phrase(at(words,cut.startMs,cut.startMs+8000)))
    const priorText=phrase(next.slice(0,i).flatMap(c=>at(words,c.startMs,c.endMs)))
    const needsOpenFix=startsMidPhrase(words,cut.startMs)||FALSE_START.test(opening)||FILLER_OPEN.test(opening)||isStrongContinuation(opening)||(isSoftContinuation(opening)&&i===0)||(DANGLING_PRONOUN_OPEN.test(opening)&&!pronounHasAntecedent(opening,priorText))||(i===0&&REF_OPEN.test(opening.toLowerCase()))
    if(needsOpenFix){
      const snapped=snapToSelfContainedStart(words,cut.startMs,floor,cut.endMs)
      if(snapped!=null&&snapped<cut.startMs){
        cut.startMs=snapped
        notes.push('Snapped opening back to a self-contained sentence start')
      }else{
        const start=nextSentenceStart(words,cut.startMs,Math.min(cut.startMs+earlier,cut.endMs-3000))
        if(start!=null&&start>cut.startMs&&start<cut.endMs-3000){
          notes.push('Trimmed a mid-phrase, continuation, or referential opening to a self-contained sentence')
          cut.startMs=start
        }
      }
    }
    if(i>0){
      const first=phrase(at(words,cut.startMs,cut.startMs+8000))
      if(CUT_CONTEXT_OPEN.test(first)&&gapHasQuestion(words,prevEnd,cut.startMs)){
        const question=at(words,prevEnd,cut.startMs)
        const qDur=((question.at(-1)?.e??0)-(question[0]?.s??0))*1000
        const qStart=Math.round(question[0]!.s*1000)
        if(question.length&&qDur>0&&qDur<=8000&&qStart>=prevEnd){
          cut.startMs=qStart
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
          tailLock.set(cut,trimmed)
          notes.push('Trimmed a mid-sentence ending back to the last complete sentence')
        }
      }
    }
    const qualifier=at(words,cut.endMs,Math.min(ceiling,cut.endMs+later))
      .filter(w=>!next.some((other,j)=>j!==i&&w.s*1000>=other.startMs&&w.e*1000<=other.endMs))
    if(QUAL_OPEN.test(phrase(qualifier.slice(0,9)).toLowerCase())){
      const end=nextCompletedEnd(words,cut.endMs,Math.min(ceiling,cut.endMs+later))
      if(end!=null){cut.endMs=end;notes.push('Included a meaning-changing qualifier after the ending')}
    }else if(CONCLUDING_FOLLOW.test(phrase(qualifier.slice(0,10)))){
      const end=nextCompletedEnd(words,cut.endMs,Math.min(ceiling,cut.endMs+later))
      if(end!=null&&end>cut.endMs){
        cut.endMs=end
        notes.push('Included a concluding sentence after a complete landing')
      }
    }
  }
  for(let i=0;i<next.length-1;i++){
    const cut=next[i]!
    const dur=cut.endMs-cut.startMs
    if(dur<12_000)continue
    const laterTokens=contentTokens(phrase(next.slice(i+1).flatMap(c=>at(words,c.startMs,c.endMs))))
    if(laterTokens.size<6)continue
    const ends=sentenceEndsIn(words,cut.startMs,cut.endMs)
    let trimTo:number|null=null
    for(const end of ends){
      if(end-cut.startMs<5000||cut.endMs-end<6000)continue
      const tail=contentTokens(phrase(at(words,end,cut.endMs)))
      const head=contentTokens(phrase(at(words,cut.startMs,end)))
      if(tail.size>=5&&sharedCount(tail,laterTokens)<1&&sharedCount(tail,head)<2)trimTo=end
    }
    if(trimTo!=null){
      cut.endMs=trimTo
      tailLock.set(cut,trimTo)
      notes.push('Trimmed a trailing detour that did not connect to the later payoff')
    }
  }
  let valid=next.filter(c=>c.endMs-c.startMs>=3000)
  const coherence=passageCoherenceRisks(valid,words)
  if(coherence.length&&valid.length>=3){
    const drop=new Set(coherence.map(r=>r.passageIndex))
    // Keep the ending payoff; drop earlier unrelated setup when the
    // remaining story still has at least two passages.
    const kept=valid.filter((c,idx)=>!drop.has(idx)||idx>=valid.length-2)
    if(kept.length>=2&&kept.reduce((n,c)=>n+c.endMs-c.startMs,0)>=8000){
      notes.push('Dropped an unrelated passage that did not connect to the later payoff')
      valid=kept
      // Dropping an early passage can leave "And he…" as the new opening.
      // Re-snap using source words so the antecedent can be pulled back in.
      applyOpeningRepairs(valid,words,earlier,notes)
    }
  }
  const sourceEnd=sourceDurationMs(words)
  for(let i=0;i<valid.length;i++){
    const cut=valid[i]!
    ensureMinTail(cut,words,tailCeiling(cut,i,valid,next,words,sourceEnd,tailLock))
  }
  return {cuts:valid,repaired:notes.length>0,notes,contextBridges}
}

const MIN_CLIP_TAIL_MS=300
/** Last known source time from the transcript; empty input is 0. */
function sourceDurationMs(words:readonly TimedWord[]):number{
  let max=0
  for(const w of words){
    const end=Math.round(w.e*1000)
    if(end>max)max=end
  }
  return max
}
/** Start of the next source token at or after the last kept word (kept or dropped). */
function nextSourceBoundaryMs(words:readonly TimedWord[],afterMs:number):number|null{
  let best:number|null=null
  for(const w of words){
    const start=Math.round(w.s*1000)
    if(start>=afterMs&&(best==null||start<best))best=start
  }
  return best
}
/**
 * Hard cap for tail padding: never cross a locked trim, the next kept or
 * dropped segment, the next source token, or the end of the source. If
 * there is not 300ms of room, use a shorter tail.
 */
function tailCeiling(
  cut:ClipSpan,
  index:number,
  kept:readonly ClipSpan[],
  original:readonly ClipSpan[],
  words:readonly TimedWord[],
  sourceEnd:number,
  tailLock:WeakMap<ClipSpan,number>,
):number{
  let cap=sourceEnd
  if(index+1<kept.length)cap=Math.min(cap,kept[index+1]!.startMs)
  const inside=at(words,cut.startMs,cut.endMs)
  const lastEnd=inside.length?Math.round(inside.at(-1)!.e*1000):cut.endMs
  const nextTok=nextSourceBoundaryMs(words,lastEnd)
  if(nextTok!=null)cap=Math.min(cap,nextTok)
  const locked=tailLock.get(cut)
  if(locked!=null)cap=Math.min(cap,locked)
  for(const other of original){
    if(other===cut)continue
    if(other.startMs>lastEnd)cap=Math.min(cap,other.startMs)
  }
  return cap
}
/** Keep up to 300ms of source after the last spoken word, without crossing a bound. */
function ensureMinTail(cut:ClipSpan,words:readonly TimedWord[],ceiling:number):void{
  const inside=at(words,cut.startMs,cut.endMs)
  if(!inside.length)return
  const lastEnd=Math.round(inside.at(-1)!.e*1000)
  const want=lastEnd+MIN_CLIP_TAIL_MS
  if(cut.endMs>=want)return
  const room=Math.min(ceiling,want)
  if(room>cut.endMs)cut.endMs=room
}

function applyOpeningRepairs(
  cuts:ClipSpan[],
  words:readonly TimedWord[],
  earlier:number,
  notes:string[],
):void{
  for(let i=0;i<cuts.length;i++){
    const cut=cuts[i]!
    const prevEnd=i>0?cuts[i-1]!.endMs:cut.startMs-earlier
    const floor=i===0?cut.startMs-earlier:Math.max(prevEnd,cut.startMs-earlier)
    const opening=stripLeadingFiller(phrase(at(words,cut.startMs,cut.startMs+8000)))
    const priorText=phrase(cuts.slice(0,i).flatMap(c=>at(words,c.startMs,c.endMs)))
    const needsOpenFix=startsMidPhrase(words,cut.startMs)||FALSE_START.test(opening)||FILLER_OPEN.test(opening)||isStrongContinuation(opening)||(isSoftContinuation(opening)&&i===0)||(DANGLING_PRONOUN_OPEN.test(opening)&&!pronounHasAntecedent(opening,priorText))||(i===0&&REF_OPEN.test(opening.toLowerCase()))
    if(!needsOpenFix)continue
    const snapped=snapToSelfContainedStart(words,cut.startMs,floor,cut.endMs)
    if(snapped!=null&&snapped<cut.startMs){
      cut.startMs=snapped
      notes.push('Snapped opening back to a self-contained sentence start')
    }else{
      const start=nextSentenceStart(words,cut.startMs,Math.min(cut.startMs+earlier,cut.endMs-3000))
      if(start!=null&&start>cut.startMs&&start<cut.endMs-3000){
        notes.push('Trimmed a mid-phrase, continuation, or referential opening to a self-contained sentence')
        cut.startMs=start
      }
    }
  }
}

/** Brief crossfades on stitched joins, keyed by the following segment's source in-point. */
export function stitchJoinTransitions(cuts:readonly ClipSpan[],durMs=350):Array<{type:'crossfade';durMs:number;srcMs:number}>{
  const out:Array<{type:'crossfade';durMs:number;srcMs:number}>=[]
  for(let i=1;i<cuts.length;i++){
    const dur=Math.min(400,Math.max(200,durMs),Math.floor((cuts[i]!.endMs-cuts[i]!.startMs)/4))
    if(dur>=200)out.push({type:'crossfade',durMs:dur,srcMs:cuts[i]!.startMs})
  }
  return out
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
  // Never trim or drop the ending payoff just to hit a duration request.
  // If the story is long, drop one earlier passage; otherwise keep the natural length.
  if(next.length>2){
    const trial=next.slice(1)
    const trialDur=trial.reduce((n,c)=>n+Math.max(0,c.endMs-c.startMs),0)/1000
    if(trial.length>=2&&trialDur<=targetSeconds*1.25){
      return {cuts:trial,tightened:true,
        note:`Dropped an earlier passage so the story could honor the ${targetSeconds}s request without cutting the ending.`}
    }
  }
  return {cuts:cuts.map(c=>({...c})),tightened:false,
    note:`Natural length ${Math.round(dur())}s exceeds the ${targetSeconds}s request; kept a complete story rather than cutting the ending.`}
}

/** Listening-only or duration-only QA remarks are warnings, not publish blockers. */
export function isNonBlockingEditorialQaIssue(issue:string):boolean{
  const t=issue.trim()
  if(/^(?:the )?(?:selected |final |clip |edit |story )?(?:intervals? total |duration |runtime |length |clip is too short|clip is too long|below the requested|above the requested)/i.test(t))return true
  if(/duration (?:is |of |below |above )|seconds? (?:below |above )|length target|runtime target/i.test(t)
    &&!/omit|missing|mid-sentence|dangling|unfinished|qualifier|antecedent|payoff|not self-contained/i.test(t))return true
  const listen=/listen(?:ing)? required|no (?:rendered )?(?:audio|waveform)|cannot (?:be )?(?:verified|verif(?:y|ied)) without listen|audition (?:the )?(?:source |audio )?join|acoustic (?:timing|joins?)|no audio was (?:supplied|provided|auditioned|available)/i.test(t)
  const crossfadeOnly=/^(?:the )?(?:\d+ ?ms )?crossfade\b/i.test(t)||/\bcrossfade(?:s)? (?:cannot|does not|do not|can't) (?:verify|prove|establish)/i.test(t)
  const meaning=/omit(?:s|ted|ting)?|missing (?:setup|payoff|antecedent|question)|mid-sentence|dangling|unfinished|qualifier|not self-contained|changed meaning|false start/i.test(t)
  if((listen||crossfadeOnly)&&!meaning)return true
  return false
}

export function clipEditorialInstructions():string{
  return [
    'CLIP EDITORIAL CONTRACT — applies to this clip only:',
    'Before selecting or shortening any footage, state the intended POINT in ONE clear sentence (claim, story or joke), and preserve that same point through every cut.',
    'A first line starting with “that’s why”, “so”, “and”, “also”, “but”, “which”, “this”, “her/his/they” without an antecedent, “like I said”, “I mean,” or another backward reference, continuation, dangling pronoun, or mid-phrase start is NOT self-contained. Snap to the sentence start (including a short identifier like “My grandmother.” if it supplies the antecedent). Never add a long preamble or dead air.',
    'Check EVERY stitched segment opening, not only the first. “also coming to understand” or “but also…” is a continuation of an omitted thought and must be repaired or rejected. A first line such as “And he was a great student,” “But she…,” or “So they…” is not self-contained even if the previous source word ends a sentence: snap back to the antecedent or reject the opening. “And that,” “So this,” and “But it” are not treated as that same strong continuation — demonstratives and “it” often open a self-contained hook or dummy-subject sentence — though a first-passage And/So/But may still be a soft continuation.',
    'Hook with the strongest authentic line that raises a question or tension, but do not move the payoff before its explanation or fabricate/reorder spoken meaning.',
    'For stitched stories, every section must be understandable from the earlier sections in the OUTPUT, not from unplayed original source, and must belong to the same story as the later payoff. If an early passage (for example a childhood anecdote) does not serve the ending, drop it. If an answer refers to a removed interviewer exchange, include that question or do not use the answer.',
    'Smooth jump cuts at stitch joins with a brief crossfade (and optional punch-in), but never use a transition to hide a broken sentence or missing antecedent. A brief intentional crossfade is not itself a failure. If no rendered audio was supplied, list acoustic joins as a listening warning and do not fail the review for that reason alone.',
    'Never remove a but, only if, unless, exception, caveat, negation or qualifier when it changes the speaker’s actual meaning.',
    'Inspect at least the NEXT 6.5 SECONDS of original source after every proposed END for a late qualifier or concluding thought, and INCLUDE it when materially needed.',
    'End exactly after the authentic full conclusion or joke landing. Mid-sentence endings are a failure. Keep at least 300 milliseconds of tail after the last spoken word when there is room, but never extend that pad across a trimmed boundary, the next kept or dropped segment, or past the end of the source; use a shorter tail when there is not enough room. Short is fine; never pad to the target duration. Cut filler and search detours, not meaning.',
    'Every distinct clip must stand alone, have its own reason to exist, and not be a near-duplicate.',
    'QA must explicitly FAIL a meaning-changing omission, a stammered or referential opening, a mid-sentence ending, or payoff-before-setup and identify the original words/source times to repair. Fix at the source word IDs, not via generated dialogue. Never cut a recorded ending or concluding sentence to honor a duration request.',
    'Check proper-name spelling in visible text against evidence; ASR alone is NOT proof of a name spelling. Flag uncertain names instead of inventing corrections.',
    'Caption/title/graphic placement must stay in the 9:16 safe area and avoid the visible face and mouth; if face location is unknown, use conservative non-center-face areas and flag for visual review.',
  ].join(' ')
}
