'use client'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import type {MsPortableManifest} from '@/lib/motion-studio/portable-contract'
import {LiveCanvasLayerOverlay} from './live-canvas-layer-overlay'
import {PlayerErrorBoundary} from './player-error-boundary'
import {normalizeUniversalTimeline} from '@/lib/motion-studio/universal-timeline'
import {UniversalTimelinePlayer,type BrowserSceneSession} from './universal-timeline-player'

type SessionResponse={sessions:BrowserSceneSession[];mediaUrls?:Record<string,string>}
const sessionRequests=new Map<string,{promise:Promise<SessionResponse>;expiresAt:number}>()
function sceneSessionRequest(projectId:string,versionId:string,sceneIds:string[]):Promise<SessionResponse>{
  const key=JSON.stringify([projectId,versionId,sceneIds])
  const now=Date.now()
  for(const [id,entry] of sessionRequests)if(entry.expiresAt<=now)sessionRequests.delete(id)
  const cached=sessionRequests.get(key)
  if(cached)return cached.promise
  // Share one request across effect cleanup/remount and React Strict Mode.
  // No abort: a completed request can be reused by the next mount.
  const promise=fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/portable/scene-sessions',{
    method:'POST',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({versionId,sceneIds}),
  }).then(async response=>{
    if(!response.ok)throw new Error('Could not load editable scene sources ('+response.status+')')
    return response.json() as Promise<SessionResponse>
  })
  sessionRequests.set(key,{promise,expiresAt:now+30_000})
  void promise.catch(()=>{if(sessionRequests.get(key)?.promise===promise)sessionRequests.delete(key)})
  return promise
}

/** Adapter from persisted Motion Studio scenes into the same browser player
 * used for native footage, audio and caption tracks. Signed sessions are
 * loaded in windows of three, not one network call per source frame.
 */
export function PortableLiveFilmPlayer({projectId,versionId,manifest,theme,overrides,
  scenePatch={},onSceneChange,selectedLayer='',onSelectLayer,onLayerChange}:{
    projectId:string;versionId:string;manifest:MsPortableManifest;
    theme:Record<string,unknown>;overrides:Record<string,unknown>;
    scenePatch?:Record<string,Record<string,unknown>>;
    onSceneChange?:(sceneId:string)=>void
    selectedLayer?:string
    onSelectLayer?:(id:string)=>void
    onLayerChange?:(elementId:string,key:string,value:number)=>void
  }){
  const loadStart=useRef<number>(performance.now())
  const timeline=useMemo(()=>normalizeUniversalTimeline(manifest),[manifest])
  const sceneIds=useMemo(()=>[...new Set(timeline.visuals.filter(v=>v.type==='scene')
    .map(v=>v.sceneId).filter((x):x is string=>Boolean(x)))],[timeline])
  const [active,setActive]=useState(sceneIds[0]||'')
  const [sessions,setSessions]=useState<Record<string,BrowserSceneSession>>({})
  const [failure,setFailure]=useState('')
  const [mediaUrls,setMediaUrls]=useState<Record<string,string>>({})
  const index=Math.max(0,sceneIds.indexOf(active))
  useEffect(()=>{setSessions({});setMediaUrls({});setActive(sceneIds[0]||'');setFailure('')},
    [versionId,sceneIds])
  useEffect(()=>{
    const ids=sceneIds.slice(index,index+3).filter(id=>{
      const item=sessions[id]
      return !item||Date.parse(item.expiresAt)<Date.now()+60_000
    })
    if(!ids.length)return
    let alive=true
    const requestedAt=performance.now()
    console.info('[motion-studio:browser-load]',{stage:'session-request',sceneCount:ids.length,elapsedMs:Math.round(requestedAt-loadStart.current)})
    sceneSessionRequest(projectId,versionId,ids).then(data=>{
      console.info('[motion-studio:browser-load]',{stage:'session-response',sceneCount:ids.length,requestMs:Math.round(performance.now()-requestedAt),elapsedMs:Math.round(performance.now()-loadStart.current)})
      if(!alive)return
      const safe=data.sessions.filter(item=>{
        try{
          const url=new URL(item.sceneUrl)
          return url.origin===window.location.origin&&
            url.pathname.startsWith('/api/motion-studio/_scene/')
        }catch{return false}
      }).map(item=>{
        const url=new URL(item.sceneUrl)
        url.searchParams.set('host',window.location.origin)
        return [item.sceneId,{...item,sceneUrl:url.toString()}] as const
      })
      if(safe.length!==ids.length)throw new Error('Scene source URL validation failed')
      setSessions(previous=>({...previous,...Object.fromEntries(safe)}))
      if(data.mediaUrls)setMediaUrls(previous=>({...previous,...data.mediaUrls}))
      setFailure('')
    }).catch(err=>{if(alive)setFailure(err instanceof Error?err.message:'Scene session error')})
    return()=>{alive=false}
  },[projectId,versionId,index,sceneIds,sessions])

  const assetUrls=useMemo(()=>{
    const result:Record<string,string>={}
    for(const session of Object.values(sessions)){
      for(const [id,url] of Object.entries(session.assetUrls))result[id]=url
    }
    return {...result,...mediaUrls}
  },[sessions,mediaUrls])
  const currentScene=manifest.scenes.find(scene=>scene.id===active)
  const validLivePatch=useMemo(()=>{
    const result:Record<string,Record<string,unknown>>={}
    for(const [elementId,values] of Object.entries(scenePatch)){
      const element=currentScene?.manifest.elements.find(e=>e.id===elementId)
      if(!element)continue
      const allowed=Object.fromEntries(Object.entries(values).filter(([key])=>
        element.properties[key]?.tier==='live_editable'))
      if(Object.keys(allowed).length)result[elementId]=allowed
    }
    return result
  },[scenePatch,currentScene])
  const selected=useCallback((sceneId:string)=>{
    setActive(sceneId)
    onSceneChange?.(sceneId)
  },[onSceneChange])
  return <div className="flex flex-col gap-1">
    <PlayerErrorBoundary resetKey={versionId}>
    <UniversalTimelinePlayer timeline={timeline} sessions={sessions}
      assetUrls={assetUrls} theme={theme} overrides={overrides}
      scenePatch={validLivePatch} onSceneChange={selected}
      overlay={currentScene&&onSelectLayer&&onLayerChange?
        <LiveCanvasLayerOverlay scene={currentScene}
          width={timeline.width} height={timeline.height}
          selected={selectedLayer} onSelect={onSelectLayer}
          savedElements={(() => {
            const scenes=overrides.scenes&&typeof overrides.scenes==='object'
              ? overrides.scenes as Record<string,unknown>:{}
            const saved=scenes[currentScene.id]
            const object=saved&&typeof saved==='object'&&!Array.isArray(saved)
              ? saved as Record<string,unknown>:{}
            const values=object.elements
            return values&&typeof values==='object'&&!Array.isArray(values)
              ? values as Record<string,unknown>:{}
          })()}
          patch={scenePatch} onChange={onLayerChange}/>
        :null}/>
    </PlayerErrorBoundary>
    {failure?<p role="status" className="text-xs text-destructive">{failure}</p>:null}
  </div>
}
