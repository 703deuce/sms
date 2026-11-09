import type { Timebase } from '@/lib/clips/editor/clip-timeline'
import type { VisualMomentEvidence } from '@/lib/ai-producer-agent/visual-evidence'

/** Intersect real video observations with approved kept source intervals.
 * Each overlap becomes its own output-timeline observation; removed footage
 * and out-of-order cuts never become evidence for a graphic. */
export function visualObservationsInOutput(
  observations: readonly VisualMomentEvidence[],
  tb: Timebase,
): Array<{startMs:number;endMs:number;observation:string}> {
  const mapped:Array<{startMs:number;endMs:number;observation:string}>=[]
  for(const observation of observations){
    const [start,end]=observation.sourceRangeMs
    for(let i=0;i<tb.segs.length;i++){
      const [a,b]=tb.segs[i]!
      const lo=Math.max(a,start),hi=Math.min(b,end)
      if(hi-lo<250)continue
      mapped.push({
        startMs:Math.round(tb.starts[i]!+lo-a),
        endMs:Math.round(tb.starts[i]!+hi-a),
        observation:observation.observation.slice(0,650),
      })
    }
  }
  return mapped.sort((a,b)=>a.startMs-b.startMs).slice(0,32)
}
