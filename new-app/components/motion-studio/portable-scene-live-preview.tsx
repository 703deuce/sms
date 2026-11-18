'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MsPortableScene } from '@/lib/motion-studio/portable-contract'

/**
 * Producer's actual transovo.editable-elements/1 ms-bridge protocol.
 * Frame must be served from an independently isolated, CSP-restricted scene host;
 * it has an opaque origin because allow-same-origin is deliberately absent.
 */
type SceneReply = {ms?:number; id?:number;event?:string;ok?:boolean;
  error?:string;result?:unknown;describe?:unknown}
type SceneIssue = {severity?:string;code?:string;message?:string}
type SceneResult = {ok?:boolean;rejected?:boolean;issues?:SceneIssue[]}
const sceneOrigin = process.env.NEXT_PUBLIC_MOTION_STUDIO_SCENE_HOST_ORIGIN || ''

export function PortableSceneLivePreview({projectId,versionId,scene,theme,overrides,patch,themeColors,seconds}:{
  projectId:string;versionId:string;scene:MsPortableScene;
  theme:Record<string,unknown>;overrides:Record<string,unknown>;
  patch:Record<string,Record<string,unknown>>;themeColors:Record<string,string>;seconds:number
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const serial = useRef(0)
  const [hello,setHello] = useState(false)
  const [ready,setReady] = useState(false)
  const [error,setError] = useState('')
  const [assets,setAssets] = useState<Record<string,string>|null>(null)
  const [assetLoading,setAssetLoading] = useState(true)
  const link=useMemo(()=>{
    if(!sceneOrigin)return ''
    try {
      const url=new URL(sceneOrigin)
      if(url.protocol!=='https:' || url.username || url.password || !url.hostname)return ''
      url.pathname='/bundles/'+encodeURIComponent(scene.bundleAssetId)+'/index.html'
      url.search=''
      // The producer's ms-bridge.js explicitly requires this query argument.
      if(typeof window!=='undefined')url.searchParams.set('host',window.location.origin)
      return url.toString()
    }catch {return ''}
  },[scene.bundleAssetId])

  const call=(method:string,...args:unknown[])=>{
    // Only our own child frame; no direct execution in Transovo's application DOM.
    frame.current?.contentWindow?.postMessage({ms:1,id:++serial.current,method,args},'*')
  }
  useEffect(()=>{
    if(!link)return
    let active=true
    setAssets(null);setAssetLoading(true);setHello(false);setReady(false);setError('')
    fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+
      '/portable/assets?versionId='+encodeURIComponent(versionId),{cache:'no-store'})
      .then(async r=>{
        if(!r.ok)throw new Error('Original scene assets are unavailable')
        return r.json() as Promise<{assetUrls:Record<string,string>;unavailableAssetIds:string[]}>
      })
      .then(result=>{
        if(!active)return
        if(result.unavailableAssetIds.length)throw new Error('Missing original scene dependencies')
        setAssets(result.assetUrls)
      })
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Cannot open original scene')})
      .finally(()=>{if(active)setAssetLoading(false)})
    return()=>{active=false}
  },[projectId,versionId,link])

  useEffect(()=>{
    const onMessage=(event:MessageEvent)=>{
      // The child has an opaque origin. Both source and origin must match.
      if(event.source!==frame.current?.contentWindow)return
      if(event.origin!=='null' && event.origin!==new URL(sceneOrigin).origin)return
      const data=event.data as SceneReply|null
      if(!data || data.ms!==1)return
      if(data.event==='hello')setHello(true)
      if(data.event==='ready'){setHello(true);setReady(true);setError('')}
      if(data.ok===false && typeof data.error==='string')
        setError(data.error.slice(0,250))
      if(data.ok===true && data.result && typeof data.result==='object'){
        const result=data.result as SceneResult
        if(result.rejected || result.ok===false)
          setError((result.issues||[]).slice(0,2).map(x=>x.message||x.code||'Edit rejected').join('; '))
      }
    }
    if(!link)return
    window.addEventListener('message',onMessage)
    return()=>window.removeEventListener('message',onMessage)
  },[link])

  useEffect(()=>{
    // Wait for the producer to call startBridge.waitInit() and send 'hello'.
    if(!hello || !assets)return
    call('init',{theme,overrides,assetUrls:assets,mode:'live',fonts:{},assets:{}})
  },[hello,assets,theme,overrides])

  useEffect(()=>{
    if(!ready || !assets)return
    const live:Record<string,Record<string,unknown>>={}
    for(const [elementId,values] of Object.entries(patch)){
      const element=scene.manifest.elements.find(el=>el.id===elementId)
      if(!element)continue
      const allowed=Object.fromEntries(Object.entries(values).filter(([key])=>
        element.properties[key]?.tier==='live_editable'))
      if(Object.keys(allowed).length)live[elementId]=allowed
    }
    // Scene-local producer protocol. Full editor patch uses schema + scenes.
    call('setProps',{schema:'transovo.edit-patch/1',theme:{colors:themeColors},
      scenes:{[scene.id]:{elements:live}}})
  },[ready,assets,patch,themeColors,scene])

  useEffect(()=>{if(ready)call('seek',Math.max(0,seconds))},[ready,seconds])

  if(!link)return null
  return <section className="flex flex-col gap-1" aria-label="Original scene live preview">
    <p className="text-xs font-medium">Live scene preview</p>
    {assets && <iframe ref={frame} title={'Editable '+scene.id} src={link}
      sandbox="allow-scripts" referrerPolicy="no-referrer"
      className="aspect-video w-full rounded-md border border-border bg-black"/>}
    {error?<p role="status" className="text-xs text-destructive">{error}</p>:null}
    {(assetLoading || (assets&&!ready)) && !error ?
      <p className="text-xs text-muted-foreground">Initializing original scene…</p>:null}
  </section>
}
