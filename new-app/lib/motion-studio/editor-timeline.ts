import type {MsPortableManifest} from '@/lib/motion-studio/portable-contract'
import {normalizeUniversalTimeline} from '@/lib/motion-studio/universal-timeline'
import { defaultEdits, type ClipEditsV2, type ClipMotionStudioExt } from '@/lib/clips/edits'
import type { ClipAudioMusic } from '@/lib/clips/audio'
import type { Marker } from '@/lib/clips/editor/markers'

/**
 * FE-6 / BE-9: map an assembled Motion Studio program onto the EXISTING Compact Editor timeline (ClipEditsV2).
 *
 * - Canvas (main source) = picture + dialog (narration, footage sound, SFX) when the worker wrote editor stems,
 *   else the full master (older assemblies).
 * - Scenes and footage inserts = Video-lane split points (`videoSplits`) at every segment boundary, so each scene /
 *   insert is its own selectable, trimmable, deletable item. Narration lives in the canvas, so deleting a scene
 *   removes its words too and captions stay in sync.
 * - Music = the Compact Music lane (`audio.music`, a project-media upload): volume, fades, duck, swap, remove.
 * - Chapters = chapter markers. `edits.motionStudio` keeps the labelled lanes for the Motion Studio strip.
 *
 * Re-sync (new timelineVersion after a scene re-render) keeps the user's own edits; Motion Studio-owned pieces
 * (splits, chapter markers, our music item) are refreshed. A music item the user swapped or removed stays as they left it.
 */

export const MS_MUSIC_ID_PREFIX = 'msmu'
const MS_MARKER_PREFIX = 'ms_ch_'

export type MsEditorStems = { canvas?: 'dialog'; musicKey?: string; gainDb?: number; durationMs?: number }

type Segment = { startMs?: number; endMs?: number }

export function sceneSplitsMs(ext: ClipMotionStudioExt | undefined, durationMs: number): number[] {
  const segs = (ext?.segments ?? []) as Segment[]
  const out = new Set<number>()
  for (const s of segs) {
    const t = Math.round(Number(s.startMs))
    if (Number.isFinite(t) && t > 0 && t < durationMs) out.add(t)
  }
  return [...out].sort((a, b) => a - b)
}

/**
 * Agent films have a fully assembled master MP4 as the editor canvas. Each
 * manifest scene is a cut on THAT canvas, never a partial secondary source
 * replacement. Preserve customer-authored source overrides across reimports.
 */
export function agentCanvasVideoLayout(base: ClipEditsV2, ext: ClipMotionStudioExt, durationMs: number):
  Pick<ClipEditsV2, 'videoSplits' | 'sourceSegments'> {
  return {
    videoSplits: sceneSplitsMs(ext, durationMs),
    sourceSegments: (base.sourceSegments ?? []).filter(item => !item.id.startsWith('ms_')),
  }
}

export type BuildEditorEditsInput = {
  base: ClipEditsV2 | null
  durationMs: number
  patch: { markers?: Marker[]; motionStudio?: ClipMotionStudioExt }
  /** Upload id of this version's music stem (already registered as project media), or null. */
  musicUploadId: string | null
  /** Music upload id we placed last time (clip aiMeta), to tell "user removed it" from "never had it". */
  lastPlacedMusicUploadId: string | null
}

export function buildMotionStudioEditorEdits(i: BuildEditorEditsInput): ClipEditsV2 {
  const d = i.durationMs
  const base = i.base ?? defaultEdits({ clipStartMs: 0, clipEndMs: d, trimMinMs: 0, trimMaxMs: d })
  const userMarkers = (base.markers ?? []).filter(m => !String(m.id).startsWith(MS_MARKER_PREFIX))
  const markers = [...userMarkers, ...(i.patch.markers ?? [])].sort((a, b) => a.ms - b.ms)

  const prev = base.audio?.music ?? null
  const prevIsOurs = Boolean(prev?.uploadId && prev.uploadId.startsWith(MS_MUSIC_ID_PREFIX))
  const userRemoved = !prev && Boolean(i.lastPlacedMusicUploadId) && Boolean(i.base)
  let music: ClipAudioMusic | null = null
  if (prev && !prevIsOurs) {
    music = prev                                        // the user's own music: never overwritten
  } else if (!userRemoved && i.musicUploadId) {
    music = {
      generationId: i.musicUploadId,
      uploadId: i.musicUploadId,
      volume: prev?.volume ?? 1,                        // the stem is already at the master's mix level
      duckDepth: prev?.duckDepth ?? 0.55,
      fadeInMs: prev?.fadeInMs ?? 0,                    // the score has its own intro / resolve
      fadeOutMs: prev?.fadeOutMs ?? 0,
      startMs: 0,
      endMs: d,
      inMs: 0,
      ...(prev?.pan != null ? { pan: prev.pan } : {}),
    }
  }

  // A producer re-render (new timelineVersion) must not disturb the customer's
  // own timeline decisions: keep their trim, canvas and splits; only the
  // Motion Studio-owned scene boundaries are replaced.
  const prevMsSplits = new Set(sceneSplitsMs(base.motionStudio, Number.MAX_SAFE_INTEGER))
  const userSplits = i.base ? (base.videoSplits ?? []).filter(t => !prevMsSplits.has(t) && t > 0 && t < d) : []
  const prevEnd = Number(base.motionStudio?.durationMs) ||
    Math.max(0, ...((base.motionStudio?.segments ?? []) as Segment[]).map(s => Number(s.endMs) || 0))
  let trim = { in: 0, out: d }
  if (i.base && base.trim) {
    const out = prevEnd > 0 && base.trim.out >= prevEnd - 1 ? d : Math.min(d, Math.max(1, base.trim.out))
    trim = { in: Math.max(0, Math.min(base.trim.in, out - 1)), out }
  }
  return {
    ...base,
    trim,
    aspectRatio: i.base ? (base.aspectRatio ?? '16:9') : '16:9',
    layout: { ...(base.layout ?? { shotOverrides: [] }), mode: 'full_frame', shotOverrides: base.layout?.shotOverrides ?? [] },
    markers,
    videoSplits: [...new Set([...sceneSplitsMs(i.patch.motionStudio, d), ...userSplits])].sort((a, b) => a - b),
    audio: { music, sfx: base.audio?.sfx ?? [], ...(base.audio?.studioSound !== undefined ? { studioSound: base.audio.studioSound } : {}) },
    motionStudio: i.patch.motionStudio,
  }
}

/**
 * Live producer scenes belong to the existing Compact Editor timeline.
 * Persist each original scene, footage layer and editable graphic as a
 * time-aligned Motion Studio lane; never flatten native scene layers into
 * another MP4 or invent media replacement uploads.
 *
 * The scene runtime remains responsible for executing JS-backed graphics.
 * Native clip renderers must not try to draw those from opaque layer metadata.
 */
export function buildLiveMotionStudioEditorEdits(base:ClipEditsV2,manifest:MsPortableManifest,
  projectId:string,timelineVersion:number):ClipEditsV2{
  const live=normalizeUniversalTimeline(manifest)
  const durationMs=Math.max(1,live.durationMs)
  const grouped=new Map<string,ClipMotionStudioExt['tracks'][number]>()
  const add=(trackId:string,kind:string,label:string,item:Record<string,unknown>)=>{
    let track=grouped.get(trackId)
    if(!track){track={id:trackId,kind,label,items:[]};grouped.set(trackId,track)}
    track.items.push(item)
  }
  for(const v of live.visuals){
    add(v.sceneId?'ms-scenes':'ms-footage','visual',v.sceneId?'Main Visuals':'Footage',
      {id:v.id,sceneId:v.sceneId||null,assetId:v.assetId||null,startMs:v.startMs,
       endMs:v.startMs+v.durationMs,sourceInMs:v.inMs,kind:v.type})
  }
  const represented=new Set<string>()
  for(const layer of live.sceneLayers){
    represented.add(layer.sceneId+':'+layer.elementId)
    add('ms-layer-'+layer.trackId,layer.kind||'graphic',
      layer.kind==='text'?'Text and titles':'Motion graphics',
      {id:layer.id,sceneId:layer.sceneId,elementId:layer.elementId,
       startMs:layer.startMs,endMs:layer.endMs,label:layer.label,
       kind:layer.kind,editable:true})
  }
  // Some producer scenes only publish their native elements/motion tree,
  // rather than duplicating each element in liveProject.tracks.
  for(const visual of live.visuals){
    if(!visual.sceneId)continue
    const scene=manifest.scenes.find(x=>x.id===visual.sceneId)
    if(!scene)continue
    for(const element of scene.manifest.elements){
      const identity=scene.id+':'+element.id
      if(represented.has(identity)||element.id===scene.manifest.motionTree?.rootId)continue
      represented.add(identity)
      const node=scene.manifest.motionTree?.nodes.find(n=>n.id===element.id)
      const startMs=visual.startMs+Math.max(0,node?.startMs??Math.round((element.timing?.inSec??0)*1000))
      const endMs=visual.startMs+Math.min(visual.durationMs,
        node?.endMs??Math.round((element.timing?.outSec??visual.durationMs/1000)*1000))
      if(endMs<=startMs)continue
      add('ms-native-'+scene.id,element.kind,'Motion graphics and titles',
        {id:identity,sceneId:scene.id,elementId:element.id,
         startMs,endMs,label:node?.name||element.id,kind:element.kind,editable:true})
    }
  }
  for(const a of live.audio){
    add('ms-audio-'+a.trackId,'audio','Audio / narration / music',
      {id:a.id,assetId:a.assetId,startMs:a.startMs,endMs:a.startMs+a.durationMs,
       sourceInMs:a.inMs,gainDb:a.gainDb,muted:a.muted})
  }
  for(const c of live.captions){
    add('ms-captions','caption','Captions',
      {id:c.id,startMs:c.startMs,endMs:c.endMs,text:c.text})
  }
  const ext:ClipMotionStudioExt={v:1,projectId,timelineVersion,durationMs,
    fps:live.fps,tracks:[...grouped.values()],
    segments:live.visuals.filter(v=>v.sceneId).map(v=>({
      id:v.id,sceneId:v.sceneId,startMs:v.startMs,endMs:v.startMs+v.durationMs,
    }))}
  // Preserve Compact's own edits and user-selected music/overlays.
  const previousSplits=new Set(sceneSplitsMs(base.motionStudio,Number.MAX_SAFE_INTEGER))
  const ownSplits=(base.videoSplits??[]).filter(ms=>!previousSplits.has(ms)&&ms>0&&ms<durationMs)
  const changes:ClipEditsV2={...base,motionStudio:ext,
    videoSplits:[...new Set([...sceneSplitsMs(ext,durationMs),...ownSplits])].sort((a,b)=>a-b)}
  // Preserve captions in their original native track. The approved master
  // might already display them; copying them into Clip captionLines here
  // would burn a second identical caption over the picture.
  return changes
}
