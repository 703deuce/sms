/** Clip-only source separation and duration scoring. Never imported by Producer. */
export type SourcePassage = {startMs:number;endMs:number}
export function storyCoverage(selections:readonly SourcePassage[],targetSeconds=60){
  const ordered=[...selections].sort((a,b)=>a.startMs-b.startMs)
  const durationSeconds=ordered.reduce((n,p)=>n+Math.max(0,p.endMs-p.startMs),0)/1000
  const gapsMs=ordered.slice(1).map((p,i)=>p.startMs-ordered[i]!.endMs)
  const separated=ordered.length>=2&&ordered.every(p=>p.endMs>p.startMs)&&gapsMs.every(g=>g>=2500)
  const durationPenalty=Math.min(35,Math.round(Math.max(0,Math.abs(durationSeconds-targetSeconds)-10)*.7))
  return {separated,durationSeconds,gapsMs,durationPenalty}
}
