'use client'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import type {MsPortableManifest,MsPortableScene} from '@/lib/motion-studio/portable-contract'

type SceneSession={sceneId:string;sceneUrl:string;expiresAt:string;assetUrls:Record<string,string>;assetRecords:Record<string,unknown>;fonts:Record<string,unknown>}
type Slot={scene:MsPortableScene;startMs:number;durationMs:number;sceneInMs:number}
type Wire={ms?:number;event?:string;id?:number;ok?:boolean;error?:string}
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:NaN

/** Visual-only first stage of the live-player integration.
 * Uses the real producer source, not its old master MP4. The producer's
 * independent WebAudio/live-project contract is deliberately not emulated.
 */
export function PortableLiveFilmPlayer({projectId,versionId,manifest,theme,overrides,scenePatch={},onSceneChange}:{
  projectId:string;versionId:string;manifest:MsPortableManifest;
  theme:Record<string,unknown>;overrides:Record<string,unknown>;
  scenePatch?:Record<string,Record<string,unknown>>;
  onSceneChange?:(sceneId:string)=>void
}){
  const slots=useMemo(()=>{
    const timeline=obj(manifest.timeline)
    const placements=Array.isArray(timeline.nativeScenePlacements)?timeline.nativeScenePlacements:[]
    let cursor=0
    return manifest.scenes.map(scene=>{
      const placement=obj(placements.find(p=>obj(p).sceneId===scene.id))
      const t=obj(placement.timeline)
      const duration=finite(t.durationMs)||finite(t.durationSec)*1000||
        scene.manifest.motionTree?.durationMs||2000
      const start=finite(t.startMs)||finite(t.startSec)*1000||cursor
      const sceneInMs=finite(t.sceneInMs)||finite(t.inMs)||0
      const slot={scene,startMs:Math.max(0,start),durationMs:Math.max(1,duration),sceneInMs}
      cursor=Math.max(cursor,slot.startMs+slot.durationMs)
      return slot
    }).sort((a,b)=>a.startMs-b.startMs)
  },[manifest])
  const totalMs=slots.reduce((max,s)=>Math.max(max,s.startMs+s.durationMs),0)
  const [timeMs,setTimeMs]=useState(0)
  const [playing,setPlaying]=useState(false)
  const [sessions,setSessions]=useState<Record<string,SceneSession>>({})
  const [ready,setReady]=useState<Record<string,boolean>>({})
  const [errors,setErrors]=useState<Record<string,string>>({})
  const [visible,setVisible]=useState('')
  const frames=useRef<Record<string,HTMLIFrameElement|null>>({})
  const serial=useRef(0)
  const inflight=useRef<Record<string,number>>({})
  const clock=useRef<{since:number;from:number}|null>(null)
  const clockTick=useRef<number|null>(null)
  const current=slots.find(s=>timeMs>=s.startMs&&timeMs<s.startMs+s.durationMs)||slots.at(-1)
  const index=current?slots.findIndex(s=>s.scene.id===current.scene.id):-1
  const activeId=current?.scene.id||''
  const send=useCallback((id:string,method:string,...args:unknown[])=>{
    const frame=frames.current[id]?.contentWindow
    if(!frame)return null
    const serial=++serial.current
    frame.postMessage({ms:1,id:serial,method,args},'*')
    return serial
  },[])

  useEffect(()=>{
    // Keep the current plus next two scene runtimes warm for seamless cuts.
    const needed=slots.slice(Math.max(0,index),Math.max(0,index)+3)
      .map(s=>s.scene.id).filter(id=>!sessions[id])
    if(!needed.length)return
    const controller=new AbortController()
    let active=true
    fetch('/api/motion-studio/projects/'+encodeURIComponent(projectId)+'/portable/scene-sessions',{
      method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
      body:JSON.stringify({versionId,sceneIds:needed}),signal:controller.signal,
    }).then(async r=>{
      if(!r.ok)throw new Error('Could not load original scene code')
      return r.json() as Promise<{sessions:SceneSession[]}>
    }).then(data=>{
      if(!active)return
      const allowed=Object.fromEntries(data.sessions.filter(s=>{
        try{const u=new URL(s.sceneUrl)
          return u.origin===window.location.origin&&u.pathname.startsWith('/api/motion-studio/_scene/')
        }catch{return false}
      }).map(s=>[s.sceneId,{...s,sceneUrl:appendHost(s.sceneUrl)}]))
      setSessions(old=>({...old,...allowed}))
    }).catch(e=>{
      if(!active)return
      setErrors(old=>({...old,[activeId]:e instanceof Error?e.message:'Scene could not load'}))
    })
    return()=>{active=false;controller.abort()}
  },[projectId,versionId,index,slots,sessions,activeId])

  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.origin!=='null')return
      const id=Object.keys(frames.current).find(key=>frames.current[key]?.contentWindow===event.source)
      if(!id)return
      const data=event.data as Wire|null
      if(!data||data.ms!==1)return
      if(data.event==='hello'){
        const session=sessions[id]
        if(session)send(id,'init',{theme,overrides,assetUrls:session.assetUrls,
          fonts:session.fonts,assets:session.assetRecords,mode:'live'})
      }
      if(data.event==='ready'){
        setReady(old=>({...old,[id]:true}))
        setErrors(old=>({...old,[id]:''}))
      }
      if(data.ok===false){
        setErrors(old=>({...old,[id]:String(data.error||'Scene command failed').slice(0,200)}))
        delete inflight.current[id]
      }
      if(data.ok===true&&typeof data.id==='number'&&inflight.current[id]===data.id){
        delete inflight.current[id]
        if(id===activeId)setVisible(id)
      }
    }
    window.addEventListener('message',receive)
    return()=>window.removeEventListener('message',receive)
  },[sessions,theme,overrides,send,activeId])

  useEffect(()=>{
    if(!current||!ready[activeId]||inflight.current[activeId])return
    const localSec=Math.max(0,(timeMs-current.startMs+current.sceneInMs)/1000)
    const request=send(activeId,'seek',localSec)
    if(request!==null)inflight.current[activeId]=request
  },[timeMs,current,ready,activeId,send])

  // Pre-seek the next scene's first frame, even while the current one plays.
  useEffect(()=>{
    const next=slots[index+1]
    if(next&&ready[next.scene.id]&&!inflight.current[next.scene.id]){
      const req=send(next.scene.id,'seek',next.sceneInMs/1000)
      if(req!==null)inflight.current[next.scene.id]=req
    }
  },[index,slots,ready,send])

  useEffect(()=>{
    if(!activeId||!ready[activeId])return
    const allowed=Object.fromEntries(Object.entries(scenePatch).map(([id,values])=>{
      const element=current?.scene.manifest.elements.find(e=>e.id===id)
      const editable=Object.fromEntries(Object.entries(values).filter(([key])=>
        element?.properties[key]?.tier==='live_editable'))
      return [id,editable]
    }).filter(([,v])=>Object.keys(v).length))
    if(Object.keys(allowed).length)
      send(activeId,'setProps',{schema:'transovo.edit-patch/1',
        scenes:{[activeId]:{elements:allowed}}})
  },[scenePatch,activeId,ready,current,send])

  useEffect(()=>{
    if(!playing){clock.current=null;return}
    clock.current={since:performance.now(),from:timeMs}
    const tick=(now:number)=>{
      if(!clock.current)return
      const next=Math.min(totalMs,clock.current.from+now-clock.current.since)
      setTimeMs(next)
      if(next>=totalMs){setPlaying(false);return}
      clockTick.current=requestAnimationFrame(tick)
    }
    clockTick.current=requestAnimationFrame(tick)
    return()=>{if(clockTick.current!==null)cancelAnimationFrame(clockTick.current);clockTick.current=null}
  // Never restart the clock each time a frame updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[playing,totalMs])

  useEffect(()=>{if(activeId)onSceneChange?.(activeId)},[activeId,onSceneChange])
  useEffect(()=>{
    setSessions({});setReady({});setVisible('');setTimeMs(0);setPlaying(false)
    inflight.current={}
  },[versionId])

  const root=current?.scene.manifest.motionTree?.nodes.find(n=>n.id===current.scene.manifest.motionTree?.rootId)
  const width=Number(root?.properties.width?.value)||1920
  const height=Number(root?.properties.height?.value)||1080
  const running=Boolean(playing&&ready[activeId])
  return <section aria-label="Live film visual preview" className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="font-medium">Live browser scenes · no MP4 render</span>
      <span className="text-muted-foreground">{current?.scene.id||'No scene'}</span>
    </div>
    <div className="relative w-full overflow-hidden rounded-md border border-border bg-black"
      style={{aspectRatio:`${width}/${height}`}}>
      {slots.filter((s,i)=>sessions[s.scene.id]&&Math.abs(i-index)<=2).map(s=>{
        const session=sessions[s.scene.id]!
        const shown=(visible||activeId)===s.scene.id
        return <iframe key={session.sceneUrl} title={'Live scene '+s.scene.id}
          ref={element=>{frames.current[s.scene.id]=element}}
          src={session.sceneUrl} sandbox="allow-scripts" referrerPolicy="no-referrer"
          className="absolute inset-0 size-full border-0" style={{
            opacity:shown?1:0,pointerEvents:'none',zIndex:shown?1:0
          }}/>
      })}
      {!ready[activeId]||!visible?<div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/70 p-4 text-center text-xs text-white">
        {errors[activeId]||'Loading original editable scene…'}
      </div>:null}
    </div>
    <div className="flex items-center gap-2">
      <button type="button" className="rounded-md border border-input px-3 py-1 text-xs"
        onClick={()=>setPlaying(v=>!v)} disabled={!ready[activeId]}>
        {running?'Pause':'Play'}
      </button>
      <input type="range" aria-label="Scrub live film" min={0} max={totalMs||1}
        value={timeMs} step={1000/30} className="min-w-0 flex-1"
        onChange={e=>{setPlaying(false);setTimeMs(Number(e.target.value))}}/>
      <span className="text-xs tabular-nums">{(timeMs/1000).toFixed(2)} / {(totalMs/1000).toFixed(2)}s</span>
    </div>
    <p className="text-[11px] text-muted-foreground">
      This visual preview runs original scene code. Full audio-track synchronization,
      captions, and final export parity require the producer's live-project package.
    </p>
  </section>
}
function appendHost(url:string){
  const u=new URL(url)
  u.searchParams.set('host',window.location.origin)
  return u.toString()
}
