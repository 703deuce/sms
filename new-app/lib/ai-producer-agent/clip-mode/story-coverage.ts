/** Clip-only checks. Producer timelines deliberately do not use these gates. */
export type SourcePassage = { startMs: number; endMs: number }

/** A real multi-moment story must jump between distinct regions of the source.
 * Splitting a continuous trim into several adjacent passages is not a story.
 */
export function storyCoverage(passages: readonly SourcePassage[], targetSeconds = 60) {
  const ordered = [...passages].sort((a,b) => a.startMs-b.startMs)
  const durationSeconds = ordered.reduce((n,p)=>n+Math.max(0,p.endMs-p.startMs),0)/1000
  const gapsMs = ordered.slice(1).map((p,i)=>p.startMs-ordered[i]!.endMs)
  const separated = ordered.length >= 2 &&
    ordered.every(p=>p.endMs>p.startMs) &&
    gapsMs.every(g=>g>=2500)
  const durationPenalty = durationSeconds >= targetSeconds-10 &&
    durationSeconds <= targetSeconds+10 ? 0
    : Math.min(35,Math.round(Math.abs(durationSeconds-targetSeconds)*0.7))
  return { separated, gapsMs, durationSeconds, durationPenalty }
}
