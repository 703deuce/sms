'use client'
import {useCallback,useEffect,useMemo,useState} from 'react'
import type {MsPortableManifest} from '@/lib/motion-studio/portable-contract'
import {normalizeUniversalTimeline} from '@/lib/motion-studio/universal-timeline'
import {UniversalTimelinePlayer,type BrowserSceneSession} from './universal-timeline-player'

/** Adapter from persisted Motion Studio scenes into the same browser player
 * used for native footage, audio and caption tracks. Signed sessions are
 * loaded in windows of three, not one network call per source frame.
 */
export function PortableLiveFilmPlayer({projectId,versionId,manifest,theme,overrides,
  scenePatch={},onSceneChange}:{
    projectId:string;versionId:string;manifest:MsPortableManifest;
    theme:Record<string,unknown>;overrides:Record<string,unknown>;
    scenePatch?:Record<string,Record<string,unknown>>;
    onSceneChange?:(sceneId:string)=>void
  }){
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
    const controller=new AbortController()
    let alive=true
    fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/portable/scene-sessions',{
      method:'POST',cache:'no-store',signal:controller.signal,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({versionId,sceneIds:ids}),
    }).then(async response=>{
      if(!response.ok)throw new Error('Could not load editable scene sources')
      return response.json() as Promise<{sessions:BrowserSceneSession[];mediaUrls?:Record<string,string>}>
    }).then(data=>{
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
    return()=>{alive=false;controller.abort()}
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
    <UniversalTimelinePlayer timeline={timeline} sessions={sessions}
      assetUrls={assetUrls} theme={theme} overrides={overrides}
      scenePatch={validLivePatch} onSceneChange={selected}/>
    {failure?<p role="status" className="text-xs text-destructive">{failure}</p>:null}
  </div>
}
