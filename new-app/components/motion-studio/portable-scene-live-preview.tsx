'use client'
import {useEffect,useRef,useState} from 'react'
import type {MsPortableScene} from '@/lib/motion-studio/portable-contract'

type SceneReply={ms?:number;id?:number;event?:string;ok?:boolean;error?:string;result?:unknown}
type SceneIssue={code?:string;message?:string}
type SceneResult={ok?:boolean;rejected?:boolean;issues?:SceneIssue[]}
type Session={
  sceneUrl:string;expiresAt:string;assetUrls:Record<string,string>;
  assetRecords:Record<string,unknown>;fonts:Record<string,unknown>;
}
export function PortableSceneLivePreview({projectId,versionId,scene,theme,overrides,patch,themeColors,seconds,onUnavailable}:{
  projectId:string;versionId:string;scene:MsPortableScene;
  theme:Record<string,unknown>;overrides:Record<string,unknown>;
  patch:Record<string,Record<string,unknown>>;themeColors:Record<string,string>;seconds:number
  /** No preview host or a render-only scene: the parent shows a still-frame layer picker instead of an error. */
  onUnavailable?:()=>void
}){
  const frame=useRef<HTMLIFrameElement>(null)
  const serial=useRef(0)
  const initialized=useRef(false)
  const [session,setSession]=useState<Session|null>(null)
  const [hello,setHello]=useState(false)
  const [ready,setReady]=useState(false)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const send=(method:string,...args:unknown[])=>{
    frame.current?.contentWindow?.postMessage({ms:1,id:++serial.current,method,args},'*')
  }
  useEffect(()=>{
    let active=true
    setSession(null);setHello(false);setReady(false);setError('');setLoading(true)
    initialized.current=false
    // Avoid the scene-session request entirely when a separate host is not configured.
    if(!process.env.NEXT_PUBLIC_MOTION_STUDIO_SCENE_HOST_ORIGIN){
      setLoading(false)
      onUnavailable?.()
      return
    }
    const controller=new AbortController()
    const timeout=window.setTimeout(()=>controller.abort(),5000)
    const url='/api/motion-studio/projects/'+encodeURIComponent(projectId)+
      '/portable/scene-session?versionId='+encodeURIComponent(versionId)+
      '&sceneId='+encodeURIComponent(scene.id)
    fetch(url,{cache:'no-store',signal:controller.signal}).then(async response=>{
      if(!response.ok){
        const failure=await response.json().catch(()=>({message:'Scene preview unavailable'}))
        throw new Error(failure.message||'Scene preview unavailable')
      }
      return response.json() as Promise<Session>
    }).then(data=>{
      if(!active)return
      const link=new URL(data.sceneUrl)
      const allowed=process.env.NEXT_PUBLIC_MOTION_STUDIO_SCENE_HOST_ORIGIN||''
      if(!allowed||new URL(allowed).origin!==link.origin||
         link.protocol!=='https:'||link.origin===window.location.origin)
        throw new Error('Scene code must load on a separate, configured HTTPS preview origin')
      // This query belongs to the iframe document; files fetch via the signed
      // URL path, so their capabilities survive relative module imports.
      link.searchParams.set('host',window.location.origin)
      setSession({...data,sceneUrl:link.toString()})
    }).catch(e=>{
      if(!active)return
      if(onUnavailable){onUnavailable();return}
      setError(e instanceof Error?e.message:'Scene preview unavailable')
    })
      .finally(()=>{window.clearTimeout(timeout);if(active)setLoading(false)})
    return()=>{active=false;window.clearTimeout(timeout);controller.abort()}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[projectId,versionId,scene.id])

  // A reachable iframe can still fail to boot its renderer. Never leave the editor waiting forever.
  useEffect(()=>{
    if(!session||ready||error)return
    const timeout=window.setTimeout(()=>{
      if(onUnavailable)onUnavailable()
      else setError('Original scene host did not become ready; use the browser fallback.')
    },8000)
    return()=>window.clearTimeout(timeout)
  },[session,ready,error,onUnavailable])

  useEffect(()=>{
    if(!session)return
    const onMessage=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow)return
      if(event.origin!=='null'&&event.origin!==new URL(session.sceneUrl).origin)return
      const value=event.data as SceneReply|null
      if(!value||value.ms!==1)return
      if(value.event==='hello')setHello(true)
      if(value.event==='ready'){setReady(true);setError('')}
      if(value.ok===false&&typeof value.error==='string')
        setError(value.error.slice(0,250))
      if(value.ok===true&&value.result&&typeof value.result==='object'){
        const r=value.result as SceneResult
        if(r.rejected||r.ok===false)
          setError((r.issues||[]).slice(0,2).map(x=>x.message||x.code||'Edit rejected').join('; '))
      }
    }
    window.addEventListener('message',onMessage)
    return()=>window.removeEventListener('message',onMessage)
  },[session])

  useEffect(()=>{
    if(!hello||!session||initialized.current)return
    initialized.current=true
    send('init',{theme,overrides,assetUrls:session.assetUrls,
      fonts:session.fonts,assets:session.assetRecords,mode:'live'})
  },[hello,session,theme,overrides])

  useEffect(()=>{
    if(!ready)return
    const live:Record<string,Record<string,unknown>>={}
    for(const [elementId,values] of Object.entries(patch)){
      const element=scene.manifest.elements.find(el=>el.id===elementId)
      if(!element)continue
      const allowed=Object.fromEntries(Object.entries(values).filter(([name])=>
        element.properties[name]?.tier==='live_editable'))
      if(Object.keys(allowed).length)live[elementId]=allowed
    }
    send('setProps',{schema:'transovo.edit-patch/1',theme:{colors:themeColors},
      scenes:{[scene.id]:{elements:live}}})
  },[ready,patch,themeColors,scene])
  useEffect(()=>{if(ready)send('seek',Math.max(0,seconds))},[ready,seconds])

  return <section className="flex flex-col gap-1" aria-label="Original scene live preview">
    <p className="text-xs font-medium">Live scene preview</p>
    {session?<iframe key={session.sceneUrl} ref={frame}
      title={'Editable '+scene.id} src={session.sceneUrl}
      sandbox="allow-scripts" referrerPolicy="no-referrer"
      onLoad={()=>setHello(true)}
      className="aspect-video w-full rounded-md border border-border bg-black"/>:null}
    {error?<p role="status" className="text-xs text-destructive">{error}</p>:null}
    {(loading||(session&&!ready))&&!error?
      <p className="text-xs text-muted-foreground">Initializing original scene…</p>:null}
  </section>
}
