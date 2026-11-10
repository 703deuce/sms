/** Reuse the original picker concept: find many, preserve distinct spans, score and ship.
 * The five specialist agents, not the old picker, make the final cuts.
 */
import type { SourcePassage } from './story-coverage'
export type ClipCandidate={index:number;startMs:number;endMs:number;peakMs:number;finderScore:number;label:string}
export function clipCandidateLimit(sourceMs:number,base=12):number{
  const hours=Math.max(0,sourceMs)/3_600_000
  return Math.min(18,Math.max(base,Math.round(hours*16)))
}
export function candidateWindows(moments:readonly Record<string,unknown>[],range:[number,number],mode:'moment'|'story',targetS:number,maxCandidates=9):ClipCandidate[]{
  const parse=(m:Record<string,unknown>,i:number):ClipCandidate|null=>{
    const start=Number(m.start_ms??(Number(m.start_s)*1000))
    const end=Number(m.end_ms??(Number(m.end_s)*1000))
    const peak=Number(m.peak_ms??(Number(m.peak_s)*1000))
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return null
    const peakMs=Number.isFinite(peak)?peak:(start+end)/2
    const half=mode==='story'?Math.max(90_000,targetS*1800):Math.max(38_000,targetS*950)
    const a=Math.max(range[0],Math.round(peakMs-half))
    const b=Math.min(range[1],Math.round(peakMs+half))
    if(b-a<15_000)return null
    const raw=Number(m.score??m.final_score??.65)
    const finderScore=Math.max(0,Math.min(100,raw<=1?raw*100:raw))
    return {index:i,startMs:a,endMs:b,peakMs, finderScore,
      label:String(m.what_happened??m.title??m.category??'Moment').slice(0,150)}
  }
  const ranked=moments.map(parse).filter((m):m is ClipCandidate=>Boolean(m))
    .sort((a,b)=>b.finderScore-a.finderScore)
  const selected:ClipCandidate[]=[]
  // Reject multiple finder observations pointing at the exact same event.
  for(const c of ranked){
    if(selected.some(k=>Math.abs(k.peakMs-c.peakMs)<Math.max(8000,targetS*250)))continue
    selected.push(c)
    if(selected.length>=maxCandidates)break
  }
  // If the analyzer only finds a few regions, avoid manufacturing meaningless
  // events. Return only grounded observed candidates.
  return selected.map((c,index)=>({...c,index}))
}
export function overlapStats(a:readonly SourcePassage[],b:readonly SourcePassage[]){
  const duration=(xs:readonly SourcePassage[])=>xs.reduce((n,x)=>n+Math.max(0,x.endMs-x.startMs),0)
  let intersection=0
  for(const x of a)for(const y of b)intersection+=Math.max(0,Math.min(x.endMs,y.endMs)-Math.max(x.startMs,y.startMs))
  const da=duration(a), db=duration(b)
  const shorter=Math.min(da,db), longer=Math.max(da,db)
  return {
    intersection,
    shorter:intersection/Math.max(1,shorter),
    longer:intersection/Math.max(1,longer),
  }
}
export function overlapFraction(a:readonly SourcePassage[],b:readonly SourcePassage[]){
  return overlapStats(a,b).shorter
}
/** True only when the two clips mostly cover the same moments
 * (shared time is most of *both* durations). A short continuous moment
 * sitting inside a long Story is not a duplicate. */
export function isMostlySameContent(a:readonly SourcePassage[],b:readonly SourcePassage[],threshold=0.6){
  const stats=overlapStats(a,b)
  return stats.shorter>threshold && stats.longer>threshold
}
export function rankCandidate(score:{finderScore:number;qaPass:boolean|null;issues:number;durationSeconds:number;targetS:number}){
  // Narrative clarity, independent comprehensibility and truthful completion
  // outweigh the finder reaction. A failed QA should never be redeemed just
  // by a large reaction or the clip approaching its requested runtime.
  const qa=Math.max(0,Math.min(100,(score.qaPass===true?95:score.qaPass===false?20:65)-Math.min(55,score.issues*9)))
  const objective=Number.isFinite(score.durationSeconds)&&score.durationSeconds>0?100:0
  // Soft duration adherence: natural length wins, but large overshoots
  // should not outrank a complete clip that honors the requested target.
  const overshoot=score.targetS>0&&score.durationSeconds>score.targetS*1.25
    ? Math.min(20,(score.durationSeconds-score.targetS*1.25)/score.targetS*20):0
  return Math.max(0,Math.min(100,Math.round(qa*.70+score.finderScore*.15+objective*.15-overshoot)))
}
