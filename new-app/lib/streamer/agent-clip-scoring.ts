/** Per-finished-clip score. A missing audio track, transcript or speech
 * is never a negative signal: the finder and QA judge the modalities present.
 * All supplied numbers are 0-100 and must be source-observed, not guessed. */
export type FinishedClipEvidence={
  qaRating?:number
  finderRating:number
  objective:{sourceBounded:boolean;noOverlaps:boolean;durationMs:number;
    maxDurationMs:number;hasOutput:boolean}
}
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)))
export function scoreFinishedAgentClip(e:FinishedClipEvidence){
  const qa=Number.isFinite(e.qaRating)?clamp(e.qaRating!):null
  const finder=clamp(e.finderRating)
  // Objective checks relate to editorial integrity and source truthfulness,
  // not presence of dialogue: a silent gameplay moment can score 100 here.
  const checks=[
    e.objective.sourceBounded,
    e.objective.noOverlaps,
    e.objective.durationMs>0&&e.objective.durationMs<=e.objective.maxDurationMs,
    e.objective.hasOutput,
  ]
  const objective=25*checks.filter(Boolean).length
  // If QA does not provide a numeric rating, report unrated instead of
  // laundering an arbitrary pass/fail default into a made-up weighted score.
  if(qa===null)return {score:null,qaRating:null,finderRating:finder,
    objectiveRating:objective,weights:{qa:45,finder:35,objective:20}}
  return {score:clamp(.45*qa+.35*finder+.20*objective),
    qaRating:qa,finderRating:finder,objectiveRating:objective,
    weights:{qa:45,finder:35,objective:20}}
}
