/** Billing policy for clip-agent runs. Credits must not burn on failed or
 * empty results — a major competitor complaint (Opus bills per imported minute
 * even when nothing is kept). Enforcement may still be off in production;
 * this is the rule to apply when billing is turned on.
 */
export function processCreditsForClipRun(input:{
  status:string
  publishedClipCount:number
  sourceDurationMs?:number
}):number{
  const status=(input.status||'').toLowerCase()
  if(status==='failed'||status==='canceled'||status==='capped')return 0
  if(!Number.isFinite(input.publishedClipCount)||input.publishedClipCount<=0)return 0
  // Charge per kept clip, not per imported source minute.
  return input.publishedClipCount
}

export function shouldChargeClipRun(input:{
  status:string
  publishedClipCount:number
}):boolean{
  return processCreditsForClipRun(input)>0
}
