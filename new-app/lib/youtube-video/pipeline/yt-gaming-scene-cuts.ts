import type { YtObservation, YtSelectedCut, YtWindowContext } from './yt-types'

/** All editing decisions here are YouTube gaming ONLY. Audio can nominate a
 * scene, but never authorizes an independent word-aligned output cut. */
const DEAD = /\b(?:loading|menu|afk|brb|queue|idle|nothing happening|paused|waiting in lobby)\b/i
const KEY = /SCENE_KEY\s*[:=]\s*([^;\n]+)/i
const PHASE = /ACTION_PHASE\s*[:=]\s*(start|middle|resolved)/i
const ACTION = /\b(chase|pursuit|police|escape|heist|mission|carjack|vehicle|fight|battle|shootout|robbery|regroup|race|airplane|flight|flying|stealth)\b/ig
const STOP = new Set(['scene','key','action','phase','start','middle','resolved','video','gameplay',
  'there','their','which','while','after','before','during','about','player','streamer','vehicle',
  'then','with','from','this','that','same','continues','moving','going','gets','into'])

function identity(observation: YtObservation): string | null {
  const match = KEY.exec(observation.description)
  const key = match?.[1]?.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim()
  return key || null
}
function tokens(description: string): Set<string> {
  return new Set((description.toLowerCase().match(/[a-z0-9]{4,}/g)??[])
    .filter(token=>!STOP.has(token)))
}
function sameAction(a: YtObservation,b: YtObservation): boolean {
  const ka=identity(a),kb=identity(b)
  // Two explicitly distinct activities MUST NOT merge even in the same location.
  if(ka&&kb)return ka===kb
  // Without stable watcher keys, use only a conservative corroboration.
  const aa=new Set(a.description.toLowerCase().match(ACTION)??[])
  const bb=new Set(b.description.toLowerCase().match(ACTION)??[])
  if(![...aa].some(word=>bb.has(word)))return false
  const shared=[...tokens(a.description)].filter(word=>tokens(b.description).has(word))
  return shared.length>=2
}
function isDead(o:YtObservation):boolean {
  return DEAD.test(o.description) && !/\b(chase|fight|pursuit|escape|shootout|near.miss)\b/i.test(o.description)
}
export function ytVisualCoverage(ctx:YtWindowContext,startMs:number,endMs:number):boolean {
  if(!Number.isSafeInteger(startMs)||!Number.isSafeInteger(endMs)||
    startMs<ctx.startMs||endMs>ctx.endMs||endMs<=startMs)return false
  const rows=ctx.observations.filter(o=>o.startMs<endMs&&o.endMs>startMs&&!isDead(o))
    .sort((a,b)=>a.startMs-b.startMs||b.endMs-a.endMs)
  if(!rows.length||rows[0]!.startMs>startMs+2000)return false
  let covered=rows[0]!.endMs
  for(const row of rows.slice(1)){
    if(row.startMs>covered+20_000)return false
    covered=Math.max(covered,row.endMs)
  }
  return covered>=endMs-2000
}
function observationAt(ctx:YtWindowContext,ms:number):YtObservation|undefined {
  return ctx.observations.filter(o=>o.startMs<=ms&&o.endMs>=ms&&!isDead(o))
    .sort((a,b)=>(b.endMs-b.startMs)-(a.endMs-a.startMs))[0]
}
function lastObservation(ctx:YtWindowContext,cut:YtSelectedCut):YtObservation|undefined {
  return observationAt(ctx,Math.max(cut.startMs,cut.endMs-1000))
}
function firstObservation(ctx:YtWindowContext,cut:YtSelectedCut):YtObservation|undefined {
  return observationAt(ctx,Math.min(cut.endMs,cut.startMs+1000))
}

/** A speech event is expanded to the visually observed enclosing action;
 * without corroborated on-screen evidence it must be REJECTED, never emitted. */
export function ytExpandSpeechToScene(ctx:YtWindowContext,cut:YtSelectedCut):YtSelectedCut|null {
  const midpoint=(cut.startMs+cut.endMs)/2
  let anchor=observationAt(ctx,midpoint)
  if(!anchor){
    anchor=ctx.observations.filter(o=>!isDead(o)&&o.endMs>cut.startMs&&o.startMs<cut.endMs)
      .sort((a,b)=>(b.endMs-b.startMs)-(a.endMs-a.startMs))[0]
  }
  if(!anchor)return null
  const observations=ctx.observations.filter(o=>!isDead(o))
    .sort((a,b)=>a.startMs-b.startMs||b.endMs-a.endMs)
  let startMs=anchor.startMs,endMs=anchor.endMs
  // Expand until different action/location, a substantial unobserved hole,
  // or a verified on-screen resolution, not a word boundary.
  for(let changed=true;changed;){
    changed=false
    for(const next of observations){
      if(next===anchor||!sameAction(anchor,next))continue
      if(next.endMs<=startMs&&startMs-next.endMs<=45_000&&
        ytVisualCoverage(ctx,next.startMs,endMs)){
        startMs=next.startMs;changed=true
      }
      if(next.startMs>=endMs&&next.startMs-endMs<=45_000&&
        ytVisualCoverage(ctx,startMs,next.endMs)){
        endMs=next.endMs;changed=true
      }
    }
  }
  if(!ytVisualCoverage(ctx,startMs,endMs))return null
  return {...cut,kind:'visual',startMs,endMs,
    groundedEvidence:ctx.observations.filter(o=>o.endMs>startMs&&o.startMs<endMs)
      .map(o=>o.description).join(' | ').slice(0,2400),
    reason:'Audio/reaction preserved inside visually observed scene: '+cut.reason}
}

/** Merge through at most 45s of visually verified continuing action;
 * do not infer an action bridge when a loading/idle event intervenes. */
function canBridge(ctx:YtWindowContext,a:YtSelectedCut,b:YtSelectedCut):boolean {
  if(a.sourceId!==b.sourceId||b.startMs-a.endMs>45_000)return false
  const first=lastObservation(ctx,a),second=firstObservation(ctx,b)
  if(!first||!second||!sameAction(first,second))return false
  const start=Math.min(a.startMs,b.startMs),end=Math.max(a.endMs,b.endMs)
  if(!ytVisualCoverage(ctx,start,end))return false
  if(ctx.observations.some(o=>o.startMs<end&&o.endMs>start&&
      o.startMs>=a.endMs&&o.endMs<=b.startMs&&isDead(o)))return false
  // Never let a genuinely resolved event merge into a second mission.
  if(PHASE.exec(first.description)?.[1]==='resolved'&&b.startMs>=a.endMs)return false
  return true
}

/** Scene-first priority: a 155s chase beats the 13s line which starts earlier.
 * Output is ALWAYS visual and nonoverlapping. */
export function ytResolveVisualScenes(
  ctx:YtWindowContext,
  candidates:YtSelectedCut[],
):{cuts:YtSelectedCut[];rejected:Array<{startMs:number;endMs:number;code:string}>}{
  const rejected:Array<{startMs:number;endMs:number;code:string}>=[]
  const visual:YtSelectedCut[]=[]
  for(const item of candidates){
    if(item.kind==='speech'){
      const expanded=ytExpandSpeechToScene(ctx,item)
      if(expanded)visual.push(expanded)
      else rejected.push({startMs:item.startMs,endMs:item.endMs,code:'yt_speech_missing_visual_scene'})
    }else if(ytVisualCoverage(ctx,item.startMs,item.endMs))visual.push({...item})
    else rejected.push({startMs:item.startMs,endMs:item.endMs,code:'yt_scene_visual_coverage_missing'})
  }
  // Choose the longest verified visual scenes FIRST, rather than first start.
  visual.sort((a,b)=>(b.endMs-b.startMs)-(a.endMs-a.startMs)||a.startMs-b.startMs)
  const kept:YtSelectedCut[]=[]
  for(const candidate of visual){
    const collisions=kept.filter(k=>k.startMs<candidate.endMs&&k.endMs>candidate.startMs)
    if(collisions.length){
      if(collisions.length===1&&canBridge(ctx,collisions[0]!,candidate)){
        const old=collisions[0]!
        old.startMs=Math.min(old.startMs,candidate.startMs)
        old.endMs=Math.max(old.endMs,candidate.endMs)
        old.groundedEvidence=[old.groundedEvidence,candidate.groundedEvidence]
          .filter(Boolean).join(' | ').slice(0,2400)
      }else{
        rejected.push({startMs:candidate.startMs,endMs:candidate.endMs,
          code:'yt_covered_by_longer_visual_scene'})
      }
      continue
    }
    kept.push({...candidate})
  }
  kept.sort((a,b)=>a.startMs-b.startMs)
  const out:YtSelectedCut[]=[]
  for(const cut of kept){
    const previous=out[out.length-1]
    if(previous&&canBridge(ctx,previous,cut)){
      previous.endMs=Math.max(previous.endMs,cut.endMs)
      previous.groundedEvidence=[previous.groundedEvidence,cut.groundedEvidence]
        .filter(Boolean).join(' | ').slice(0,2400)
    }else out.push(cut)
  }
  return {cuts:out,rejected}
}
