'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import type {MsPortableScene} from '@/lib/motion-studio/portable-contract'
const protocol='transovo-motion-scene/1'
type Result={issues?:{code:string;message?:string}[];ok?:boolean}
type HostMsg={protocol:string;type:string;nonce:string;payload?:unknown}
/**
 * Producer HTML never shares the application's origin or DOM.
 * Its origin must serve pre-published, inspected scene bundle assets.
 * sandbox without allow-same-origin gives the frame an opaque origin.
 */
export function PortableSceneLivePreview({projectId,versionId,scene,theme,overrides,patch,seconds}:{
 projectId:string;versionId:string;scene:MsPortableScene;
 theme:Record<string,unknown>;overrides:Record<string,unknown>;
 patch:Record<string,Record<string,unknown>>;seconds:number
}){
 const element=useRef<HTMLIFrameElement>(null)
 const nonce=useRef('')
 const [ready,setReady]=useState(false)
 const [frameLoaded,setFrameLoaded]=useState(false)
 const [error,setError]=useState('')
 const [urls,setUrls]=useState<Record<string,string>|null>(null)
 const origin=process.env.NEXT_PUBLIC_MOTION_STUDIO_SCENE_HOST_ORIGIN||''
 const link=useMemo(()=>{
   if(!origin)return ''
   try{
     const u=new URL(origin)
     if(u.protocol!=='https:'||u.username||u.password||!u.hostname)return ''
     u.pathname='/bundles/'+encodeURIComponent(scene.bundleAssetId)+'/index.html'
     u.search=''
     u.hash=''
     return u.toString()
   }catch{return ''}
 },[origin,scene.bundleAssetId])
 useEffect(()=>{
   if(!link)return
   let current=true
   setReady(false);setFrameLoaded(false);setError('');setUrls(null)
   nonce.current=crypto.randomUUID()
   fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+
     '/portable/assets?versionId='+encodeURIComponent(versionId),{cache:'no-store'})
     .then(async response=>{
       if(!response.ok)throw new Error('Source assets are unavailable')
       return response.json() as Promise<{assetUrls:Record<string,string>;unavailableAssetIds:string[]}>
     })
     .then(v=>{
       if(!current)return
       if(v.unavailableAssetIds.length)throw new Error('Some original assets are not available')
       setUrls(v.assetUrls)
     }).catch(e=>{if(current)setError(e instanceof Error?e.message:'Preview unavailable')})
   return()=>{current=false}
 },[projectId,versionId,link])
 useEffect(()=>{
   const handler=(event:MessageEvent)=>{
     if(event.source!==element.current?.contentWindow)return
     const msg=event.data as HostMsg|null
     if(!msg||msg.protocol!==protocol||msg.nonce!==nonce.current)return
     if(msg.type==='ready')setReady(true)
     if(msg.type==='error'){
       const p=msg.payload as {message?:unknown}|undefined
       setError(typeof p?.message==='string'?p.message:'Scene preview reported an error')
     }
     if(msg.type==='validation'){
       const p=msg.payload as Result|undefined
       if(p?.ok===false&&p.issues?.length)setError(p.issues.slice(0,2).map(i=>i.code).join(', '))
       else setError('')
     }
   }
   window.addEventListener('message',handler)
   return()=>window.removeEventListener('message',handler)
 },[])
 const send=(type:string,payload:unknown)=>{
   element.current?.contentWindow?.postMessage({protocol,type,nonce:nonce.current,payload},'*')
 }
 useEffect(()=>{
   if(!ready||!urls)return
   const live:Record<string,Record<string,unknown>>={}
   for(const [elId,values] of Object.entries(patch)){
     const spec=scene.manifest.elements.find(e=>e.id===elId)
     if(!spec)continue
     const allowed=Object.fromEntries(Object.entries(values).filter(([name])=>
       spec.properties[name]?.tier==='live_editable'))
     if(Object.keys(allowed).length)live[elId]=allowed
   }
   send('setProps',{scenes:{[scene.id]:{elements:live}}})
 },[ready,patch,scene,urls])
 useEffect(()=>{if(ready)send('seek',{seconds:Math.max(0,seconds)})},[ready,seconds])
 if(!link)return null
 if(!urls)return <p className="text-xs text-muted-foreground">{error||'Loading original scene assets…'}</p>
 useEffect(()=>{
   if(!frameLoaded||!urls)return
   setReady(false)
   send('init',{theme,overrides,assetUrls:urls,mode:'live'})
 },[frameLoaded,urls,theme,overrides])
 return <section className="flex flex-col gap-1" aria-label="Original scene live preview">
   <p className="text-xs font-medium">Live scene preview</p>
   <iframe ref={element} title={'Editable '+scene.id} src={link}
     sandbox="allow-scripts" referrerPolicy="no-referrer" onLoad={()=>setFrameLoaded(true)}
     className="aspect-video w-full rounded-md border border-border bg-black"/>
   {error?<p role="status" className="text-xs text-destructive">{error}</p>:null}
   {!ready&&!error?<p className="text-xs text-muted-foreground">Initializing scene…</p>:null}
 </section>
}
