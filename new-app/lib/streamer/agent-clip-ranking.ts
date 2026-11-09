/** Ranked discovery candidates are independent of clip assembly. The old
 * picker supplied multiple ranked results; this module only preserves that
 * PRODUCT contract. Evidence comes from the new video+audio+ASR finder. */
export type AgentClipCandidate={
  id:string;rangeMs:[number,number];score:number
  reason:string;category:string;title:string
}
type RawMoment=Record<string,unknown>
function score100(raw:unknown):number{
  const n=Number(raw)
  if(!Number.isFinite(n))return 0
  return Math.max(0,Math.min(100,Math.round(n<=1?n*100:n)))
}
function overlapFraction(a:[number,number],b:[number,number]):number{
  const intersect=Math.max(0,Math.min(a[1],b[1])-Math.max(a[0],b[0]))
  return intersect/Math.max(1,Math.min(a[1]-a[0],b[1]-b[0]))
}
/** Only source-grounded model moments; no invented clips, random sampling or
 * transcript keyword scores. Each promising event receives an ample separate
 * original-source window for the Story/Footage/Flow/QA specialists. */
export function rankAgentClipCandidates(raw:unknown,
  sourceRange:[number,number],targetSeconds:number,maxCandidates=7):AgentClipCandidate[]{
  if(!Array.isArray(raw))return []
  const [sourceStart,sourceEnd]=sourceRange
  const all:AgentClipCandidate[]=[]
  for(const row of raw){
    if(!row||typeof row!=='object')continue
    const m=row as RawMoment
    const start=Number(m.start_s)*1000,end=Number(m.end_s)*1000
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue
    const span:[number,number]=[Math.max(sourceStart,Math.round(start)),
      Math.min(sourceEnd,Math.round(end))]
    if(span[1]-span[0]<1000)continue
    const score=score100(m.score??m.gemini_score)
    const reason=String(m.why_it_works??m.what_happened??m.hook??'').slice(0,450)
    if(!reason.trim()&&score===0)continue
    const peak=Number(m.peak_s)
    const center=Number.isFinite(peak)?Math.max(span[0],Math.min(span[1],Math.round(peak*1000))):
      Math.round((span[0]+span[1])/2)
    // Story mode needs room to assemble several related beats; continuous
    // mode must still produce exactly one source-contiguous finished cut.
    const contextualMs=Math.min(20*60_000,Math.max(75_000,
      targetSeconds*1000*2,span[1]-span[0]+30_000))
    let lo=Math.max(sourceStart,center-Math.round(contextualMs/2))
    let hi=Math.min(sourceEnd,lo+contextualMs)
    lo=Math.max(sourceStart,hi-contextualMs)
    if(hi-lo<15_000)continue
    all.push({id:'candidate_'+Math.round(span[0])+'_'+Math.round(span[1]),
      rangeMs:[lo,hi],score,reason,
      category:String(m.category??m.content_type??'moment').slice(0,90),
      title:String(m.title??m.what_happened??'AI clip').slice(0,110)})
  }
  all.sort((a,b)=>b.score-a.score||a.rangeMs[0]-b.rangeMs[0])
  const selected:AgentClipCandidate[]=[]
  for(const candidate of all){
    // Deduplicate *events* (not context windows, which legitimately overlap).
    const event=candidate.id.match(/^candidate_(\d+)_(\d+)$/)
    const span:[number,number]=event?[Number(event[1]),Number(event[2])]:candidate.rangeMs
    if(selected.some(kept=>{
      const other=kept.id.match(/^candidate_(\d+)_(\d+)$/)
      const keptSpan:[number,number]=other?[Number(other[1]),Number(other[2])]:kept.rangeMs
      return overlapFraction(span,keptSpan)>0.65
    }))continue
    selected.push(candidate)
    if(selected.length>=maxCandidates)break
  }
  return selected
}
export function rankedCompletedAgentClips<T extends {score?:number;startMin:number;qaPass?:boolean}>(
  results:readonly T[]):Array<T&{rank:number}>{
  return [...results].sort((a,b)=>Number(b.qaPass===true)-Number(a.qaPass===true)||
    (b.score??0)-(a.score??0)||
    a.startMin-b.startMin).map((r,i)=>({...r,rank:i+1}))
}
