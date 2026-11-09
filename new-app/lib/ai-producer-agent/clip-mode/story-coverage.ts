/** Clip-only story coverage. Duration is informative, never a veto or penalty. */
export type SourcePassage = {startMs:number;endMs:number}
export function storyCoverage(selections:readonly SourcePassage[],targetSeconds=60){
  const ordered=[...selections].sort((a,b)=>a.startMs-b.startMs)
  const valid=ordered.every(p=>Number.isFinite(p.startMs)&&Number.isFinite(p.endMs)&&p.endMs>p.startMs)
  const gapsMs=ordered.slice(1).map((p,i)=>p.startMs-ordered[i]!.endMs)
  // Nearby cuts can belong to the same moment. A story needs at least two
  // distinct moment clusters, not a large gap after every single edit.
  const distinctMoments=valid&&ordered.length>0
    ? 1+gapsMs.filter(g=>g>=2500).length:0
  const separated=valid&&distinctMoments>=2
  let coveredMs=0,lo=-1,hi=-1
  for(const p of ordered){
    if(p.startMs>hi){if(hi>lo)coveredMs+=hi-lo;lo=p.startMs;hi=p.endMs}
    else hi=Math.max(hi,p.endMs)
  }
  if(hi>lo)coveredMs+=hi-lo
  const durationSeconds=coveredMs/1000
  void targetSeconds // purely an optional editorial request, not a quality gate
  return {separated,distinctMoments,durationSeconds,gapsMs,durationPenalty:0}
}
