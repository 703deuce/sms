/** Clip-only editorial guardrails. Transcript markers identify risks for Flow/QA;
 * they do not prove semantic meaning, so the specialist must judge context.
 * Source word timestamps are seconds; selection timestamps are milliseconds.
 */
export type TimedWord={w:string;s:number;e:number}
export type ClipSpan={startMs:number;endMs:number;kind?:string}
export type EditorialRisk={
  code:'referential_opening'|'missing_qualification'|'unfinished_ending'|'chronology'|'invalid_passage'
  detail:string
  passageIndex:number
}
const REF_OPEN=/^(?:that'?s why|like i said|as i said|as we said|as mentioned|so|and|this|that|those|these|it|they|he|she|which|because|but|anyway|again)\b/i
const QUAL_OPEN=/^(?:but|however|unless|except|only if|as long as|provided that|on the other hand|the catch is|with one exception|not if)\b/i
const DANGLING=/\b(?:but|because|if|unless|although|however|which|so|and|the thing is|what i mean is)\s*[,—-]?$/i
function phrase(words:readonly TimedWord[]):string{
  return words.map(x=>x.w).join(' ').replace(/\s+([,.;:!?])/g,'$1').trim()
}
function at(words:readonly TimedWord[],from:number,to:number):TimedWord[]{
  return words.filter(w=>w.e*1000>from&&w.s*1000<to)
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
    const first=phrase(inside.slice(0,5)).toLowerCase()
    if(REF_OPEN.test(first)){
      issues.push({code:'referential_opening',detail:'Opening may refer to missing setup: '+first.slice(0,75),passageIndex:i})
    }
    const tail=phrase(inside.slice(-7))
    if(DANGLING.test(tail))
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
export function clipEditorialInstructions():string{
  return [
    'CLIP EDITORIAL CONTRACT — applies to this clip only:',
    'Before selecting or shortening any footage, state the intended POINT in ONE clear sentence (claim, story or joke), and preserve that same point through every cut.',
    'A first line starting with “that’s why”, “so”, “and”, “this”, “like I said” or another backward reference is NOT self-contained; return to the relevant one or two setup sentences. Never add a long preamble or dead air.',
    'Hook with the strongest authentic line that raises a question or tension, but do not move the payoff before its explanation or fabricate/reorder spoken meaning.',
    'For stitched stories, every section must be understandable from the earlier sections in the OUTPUT, not from unplayed original source.',
    'Never remove a but, only if, unless, exception, caveat, negation or qualifier when it changes the speaker’s actual meaning.',
    'Inspect at least the NEXT 6.5 SECONDS of original source after every proposed END for a late qualifier or concluding thought, and INCLUDE it when materially needed.',
    'End exactly after the authentic full conclusion or joke landing. Short is fine; never pad to the target duration. Cut filler and search detours, not meaning.',
    'Every distinct clip must stand alone, have its own reason to exist, and not be a near-duplicate.',
    'QA must explicitly FAIL a meaning-changing omission or payoff-before-setup and identify the original words/source times to repair. Fix at the source word IDs, not via generated dialogue.',
    'Check proper-name spelling in visible text against evidence; ASR alone is NOT proof of a name spelling. Flag uncertain names instead of inventing corrections.',
    'Caption/title/graphic placement must stay in the 9:16 safe area and avoid the visible face and mouth; if face location is unknown, use conservative non-center-face areas and flag for visual review.',
  ].join(' ')
}
