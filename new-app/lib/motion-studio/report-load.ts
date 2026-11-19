/** Best-effort timing telemetry. Never transmit URLs, credentials or project content. */
export function reportMotionStudioLoad(stage:string,elapsedMs:number,requestMs?:number,projectId?:string,sceneId?:string,
  metrics?:{count?:number;maxMs?:number}){
  if(typeof window==='undefined')return
  const payload={stage,elapsedMs:Math.round(elapsedMs),
    navigationElapsedMs:Math.round(performance.now()),
    navigationStartEpochMs:Math.round(performance.timeOrigin),
    ...(projectId?{projectId}:{}),
    ...(sceneId?{sceneId}:{}),
    ...(metrics?.count!==undefined?{count:metrics.count}:{}),
    ...(metrics?.maxMs!==undefined?{maxMs:metrics.maxMs}:{}),
    ...(requestMs===undefined?{}:{requestMs:Math.round(requestMs)})}
  void fetch('/api/motion-studio/diagnostics/load',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),keepalive:true,
  }).catch(()=>undefined)
}
