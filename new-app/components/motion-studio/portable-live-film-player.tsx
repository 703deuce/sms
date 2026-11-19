'use client'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import type {MsPortableManifest} from '@/lib/motion-studio/portable-contract'
import {LiveCanvasLayerOverlay} from './live-canvas-layer-overlay'
import {PlayerErrorBoundary} from './player-error-boundary'
import {normalizeUniversalTimeline} from '@/lib/motion-studio/universal-timeline'
import {UniversalTimelinePlayer,type BrowserSceneSession} from './universal-timeline-player'
import {reportMotionStudioLoad} from '@/lib/motion-studio/report-load'

type SessionResponse={sessions:BrowserSceneSession[];mediaUrls?:Record<string,string>}
function initialSessions(data:SessionResponse|null|undefined):Record<string,BrowserSceneSession>{
  if(!data||typeof window==='undefined')return {}
  const safe:Record<string,BrowserSceneSession>={}
  for(const item of data.sessions){
    try{
      const url=new URL(item.sceneUrl)
      if(url.origin!==window.location.origin||!url.pathname.startsWith('/api/motion-studio/_scene/'))continue
      url.searchParams.set('host',window.location.origin)
      safe[item.sceneId]={...item,sceneUrl:url.toString()}
    }catch{}
  }
  return safe
}
const sessionRequests=new Map<string,{promise:Promise<SessionResponse>;expiresAt:number}>()
function sceneSessionRequest(projectId:string,versionId:string,sceneIds:string[]):Promise<SessionResponse>{
  const key=JSON.stringify([projectId,versionId,sceneIds])
  const now=Date.now()
  for(const [id,entry] of sessionRequests)if(entry.expiresAt<=now)sessionRequests.delete(id)
  const cached=sessionRequests.get(key)
  if(cached)return cached.promise
  // Report only actual network fetches, not duplicate React effect subscribers.
  const networkStarted=performance.now()
  reportMotionStudioLoad('session-request',networkStarted,undefined,projectId)
  // Share one request across effect cleanup/remount and React Strict Mode.
  // No abort: a completed request can be reused by the next mount.
  const promise=fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/portable/scene-sessions',{
    method:'POST',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({versionId,sceneIds}),
  }).then(async response=>{
    if(!response.ok)throw new Error('Could not load editable scene sources ('+response.status+')')
    return response.json() as Promise<SessionResponse>
  }).then(data=>{
    reportMotionStudioLoad('session-response',performance.now(),
      performance.now()-networkStarted,projectId)
    return data
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
  scenePatch={},onSceneChange,selectedLayer='',onSelectLayer,onLayerChange,previewVideoUrl=null,initialPlayback=null,
  embeddedCanvas=false,externalTimeMs}:{
    projectId:string;versionId:string;manifest:MsPortableManifest;
    theme:Record<string,unknown>;overrides:Record<string,unknown>;
    scenePatch?:Record<string,Record<string,unknown>>;
    onSceneChange?:(sceneId:string)=>void
    selectedLayer?:string
    previewVideoUrl?:string|null
    initialPlayback?:SessionResponse|null
    embeddedCanvas?:boolean
    externalTimeMs?:number
    onSelectLayer?:(id:string)=>void
    onLayerChange?:(elementId:string,key:string,value:number)=>void
  }){
  const loadStart=useRef<number>(performance.now())
  const timeline=useMemo(()=>normalizeUniversalTimeline(manifest),[manifest])
  const sceneIds=useMemo(()=>[...new Set(timeline.visuals.filter(v=>v.type==='scene')
    .map(v=>v.sceneId).filter((x):x is string=>Boolean(x)))],[timeline])
  const [active,setActive]=useState(sceneIds[0]||'')
  const [sessions,setSessions]=useState<Record<string,BrowserSceneSession>>(()=>initialSessions(initialPlayback))
  const [failure,setFailure]=useState('')
  const [mediaUrls,setMediaUrls]=useState<Record<string,string>>(()=>initialPlayback?.mediaUrls||{})
  const index=Math.max(0,sceneIds.indexOf(active))
  const shortFilm=sceneIds.length<=3
  useEffect(()=>{
    setSessions(initialSessions(initialPlayback))
    setMediaUrls(initialPlayback?.mediaUrls||{})
    setActive(sceneIds[0]||'');setFailure('')
  // Initial signed sessions are fixed for this immutable version; refreshing
  // props must not discard sessions fetched after bootstrap.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[versionId,sceneIds])
  useEffect(()=>{
    const windowIds=shortFilm?sceneIds:sceneIds.slice(index,index+3)
    const ids=windowIds.filter(id=>{
      const item=sessions[id]
      return !item||Date.parse(item.expiresAt)<Date.now()+60_000
    })
    if(!ids.length)return
    let alive=true
    sceneSessionRequest(projectId,versionId,ids).then(data=>{
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
  // On short films the requested scene IDs stay fixed; sessions state is
  // retained so a completed request cannot trigger a second signing call.
  },[projectId,versionId,shortFilm,sceneIds,index,sessions])

  const assetUrls=useMemo(()=>{
    const result:Record<string,string>={}
    for(const session of Object.values(sessions)){
      for(const [id,url] of Object.entries(session.assetUrls))result[id]=url
    }
    return {...result,...mediaUrls}
  },[sessions,mediaUrls])
  const masterAssetId=useMemo(()=>{
    const producer=manifest.producerDocument
    const master=producer?.master
    const nativeId=master&&typeof master==='object'&&!Array.isArray(master)?
      (master as Record<string,unknown>).asset:null
    return typeof nativeId==='string'?(manifest.producerAssetMap?.[nativeId]||nativeId):''
  },[manifest])
  const signedPreviewUrl=masterAssetId?mediaUrls[masterAssetId]:undefined
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
  return <div className={embeddedCanvas?'absolute inset-0':'flex flex-col gap-1'}>
    <PlayerErrorBoundary resetKey={versionId}>
    <UniversalTimelinePlayer projectId={projectId} timeline={timeline} sessions={sessions}
      embeddedCanvas={embeddedCanvas} externalTimeMs={externalTimeMs}
      previewVideoUrl={signedPreviewUrl||previewVideoUrl}
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
    {failure&&!embeddedCanvas?<p role="status" className="text-xs text-destructive">{failure}</p>:null}
  </div>
}
