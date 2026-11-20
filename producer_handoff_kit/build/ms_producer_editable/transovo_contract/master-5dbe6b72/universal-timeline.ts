/**
 * A renderer-neutral timeline for existing footage AND producer-generated scenes.
 * It contains no URLs, DOM code, or AI-specific rules. Preview and export
 * consume the same ordered items and global millisecond positions.
 */
import type { MsPortableManifest } from './portable-contract'

export type UniversalVisual={
  id:string;sceneId?:string;type:'scene'|'video'|'image';assetId?:string;
  startMs:number;durationMs:number;inMs:number;layer:number;
}
export type UniversalAudio={
  id:string;assetId:string;trackId:string;startMs:number;inMs:number;
  durationMs:number;gainDb:number;muted:boolean
}
export type UniversalCaption={
  id:string;text:string;startMs:number;endMs:number;style?:Record<string,unknown>
}
export type UniversalTimeline={
  durationMs:number;fps:number;width:number;height:number;
  visuals:UniversalVisual[];audio:UniversalAudio[];captions:UniversalCaption[];
  captionsAssetIds:string[]
}
const rec=(x:unknown):Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{}
const list=(x:unknown):unknown[]=>Array.isArray(x)?x:[]
const value=(x:unknown):number|null=>typeof x==='number'&&Number.isFinite(x)?x:null
const id=(x:unknown):string=>typeof x==='string'?x:''
const positive=(x:unknown,fallback:number)=>value(x)!==null&&Number(x)>0?Number(x):fallback
const nonnegative=(x:unknown,fallback=0)=>value(x)!==null&&Number(x)>=0?Number(x):fallback

/** Accept an ordinary media timeline, the producer's live-project/1, or the
 * existing portable scene placements without inventing missing content.
 * References remain asset IDs; signed URLs are resolved only at playback.
 */
export function normalizeUniversalTimeline(manifest:MsPortableManifest):UniversalTimeline{
  const doc=rec(manifest.liveProject)
  const format=rec(doc.format)
  const fps=positive(format.fps,30)
  const nativeRoot=manifest.scenes[0]?.manifest.motionTree?.nodes.find(n=>
    n.id===manifest.scenes[0]?.manifest.motionTree?.rootId)
  const width=positive(format.width,positive(nativeRoot?.properties.width?.value,1920))
  const height=positive(format.height,positive(nativeRoot?.properties.height?.value,1080))
  const visuals:UniversalVisual[]=[]
  const audio:UniversalAudio[]=[]
  const captions:UniversalCaption[]=[]
  const captionsAssetIds:string[]=[]
  const tracks=list(doc.tracks)
  if(tracks.length){
    for(let ti=0;ti<tracks.length;ti++){
      const track=rec(tracks[ti])
      const trackId=id(track.id)||'track-'+ti
      const kind=id(track.kind)
      const captionAsset=id(track.captions)
      if(captionAsset)captionsAssetIds.push(captionAsset)
      const trackGain=value(track.gainDb)??0
      for(let j=0;j<list(track.items).length;j++){
        const item=rec(list(track.items)[j])
        const itemType=id(item.type)
        const itemId=id(item.id)||trackId+'-'+j
        const startMs=nonnegative(item.startMs)
        const durationMs=positive(item.durationMs,0)
        const assetId=id(item.assetId)||id(item.src)
        if((itemType==='scene'||(kind==='visual'&&itemType==='scene'))&&id(item.id)){
          visuals.push({id:itemId,sceneId:id(item.sceneId)||itemId,type:'scene',
            startMs,durationMs,inMs:nonnegative(item.sceneInMs),layer:ti})
        }else if(itemType==='video'||itemType==='image'){
          if(assetId&&durationMs>0)visuals.push({id:itemId,type:itemType,assetId,
            startMs,durationMs,inMs:nonnegative(item.inMs),layer:ti})
        }else if(kind==='audio'||itemType==='audio'){
          if(assetId&&durationMs>0)audio.push({id:itemId,assetId,trackId,startMs,
            inMs:nonnegative(item.inMs),durationMs,
            gainDb:trackGain+(value(item.gainDb)??0),muted:item.muted===true})
        }else if(itemType==='caption'&&typeof item.text==='string'){
          const endMs=positive(item.endMs,startMs+durationMs)
          if(endMs>startMs)captions.push({id:itemId,text:item.text,startMs,endMs,
            style:rec(item.style)})
        }
      }
    }
  }else{
    // Old projects carry scene placements but no independent media tracks.
    const timeline=rec(manifest.timeline)
    const placements=list(timeline.nativeScenePlacements)
    let cursor=0
    for(const scene of manifest.scenes){
      const placement=rec(placements.find(p=>rec(p).sceneId===scene.id))
      const t=rec(placement.timeline)
      const start= value(t.startMs)!==null?Math.max(0,Number(t.startMs)):
        value(t.startSec)!==null?Math.max(0,Number(t.startSec)*1000):cursor
      const end=value(t.endMs)!==null?Number(t.endMs):
        value(t.endSec)!==null?Number(t.endSec)*1000:null
      const duration=positive(t.durationMs,positive(t.durationSec,0)*1000)||
        (end!==null&&end>start?end-start:0)||
        scene.manifest.motionTree?.durationMs||positive(t.frames,0)/fps*1000
      const durationMs=Math.max(1,Math.round(duration||2000))
      visuals.push({id:scene.id,sceneId:scene.id,type:'scene',
        startMs:Math.round(start),durationMs,inMs:nonnegative(t.sceneInMs),layer:0})
      cursor=Math.max(cursor,start+durationMs)
    }
  }
  const declared=positive(format.durationMs,0)
  const calculated=Math.max(0,...visuals.map(x=>x.startMs+x.durationMs),
    ...audio.map(x=>x.startMs+x.durationMs),...captions.map(x=>x.endMs))
  const durationMs=Math.max(declared,calculated)
  return {durationMs:Math.round(durationMs),fps,width,height,
    visuals:visuals.sort((a,b)=>a.startMs-b.startMs||a.layer-b.layer),
    audio:audio.sort((a,b)=>a.startMs-b.startMs),
    captions:captions.sort((a,b)=>a.startMs-b.startMs),captionsAssetIds}
}
export function visualsAt(timeline:UniversalTimeline,timeMs:number):UniversalVisual[]{
  return timeline.visuals.filter(item=>timeMs>=item.startMs&&timeMs<item.startMs+item.durationMs)
}
export function captionsAt(timeline:UniversalTimeline,timeMs:number):UniversalCaption[]{
  return timeline.captions.filter(item=>timeMs>=item.startMs&&timeMs<item.endMs)
}
export function gainFromDb(db:number):number{return Math.pow(10,Math.max(-96,Math.min(24,db))/20)}
