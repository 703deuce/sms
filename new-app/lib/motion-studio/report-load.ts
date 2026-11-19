/** Best-effort timing telemetry. Never transmit URLs, credentials or project content. */
export function reportMotionStudioLoad(stage:string,elapsedMs:number,requestMs?:number){
  if(typeof window==='undefined')return
  const payload={stage,elapsedMs:Math.round(elapsedMs),
    ...(requestMs===undefined?{}:{requestMs:Math.round(requestMs)})}
  void fetch('/api/motion-studio/diagnostics/load',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),keepalive:true,
  }).catch(()=>undefined)
}
