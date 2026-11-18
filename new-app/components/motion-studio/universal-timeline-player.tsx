'use client'
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from 'react'
import type {UniversalTimeline,UniversalVisual,UniversalCaption} from '@/lib/motion-studio/universal-timeline'
import {captionsAt,visualsAt} from '@/lib/motion-studio/universal-timeline'
import {readTimelineCaptions} from '@/lib/motion-studio/universal-captions'
import {UniversalBrowserAudio} from '@/lib/motion-studio/universal-browser-audio'

export type BrowserSceneSession={sceneId:string;sceneUrl:string;expiresAt:string;
  assetUrls:Record<string,string>;assetRecords:Record<string,unknown>;
  fonts:Record<string,unknown>}
type Wire={ms?:number;event?:string;id?:number;ok?:boolean;error?:string}
const safeMs=(ms:number,max:number)=>Math.max(0,Math.min(max,Number.isFinite(ms)?ms:0))
function sceneAt(timeline:UniversalTimeline,t:number):UniversalVisual|null{
  const candidate=visualsAt(timeline,t).filter(v=>v.type==='scene')
  return candidate.at(-1)||null
}
/**
 * Shared timeline compositor: original video/image assets, sandboxed original
 * scene runtimes, WebAudio stems, and host-rendered caption text. No full MP4
 * is needed to display or change the project.
 *
 * This component is intentionally renderer-neutral: ordinary user footage and
 * AI-generated scenes are two kinds of visual item on the SAME timeline.
 */
export function UniversalTimelinePlayer({timeline,sessions,assetUrls,theme,overrides,
  scenePatch={},onSceneChange,overlay}:{
    timeline:UniversalTimeline;sessions:Record<string,BrowserSceneSession>;
    assetUrls:Record<string,string>;theme:Record<string,unknown>;
    overrides:Record<string,unknown>;
    scenePatch?:Record<string,Record<string,unknown>>;
    onSceneChange?:(sceneId:string)=>void
    overlay?:ReactNode
  }){
  const [timeMs,setTimeMs]=useState(0)
  const [playing,setPlaying]=useState(false)
  const [rate,setRate]=useState(1)
  const [ready,setReady]=useState<Record<string,boolean>>({})
  const [drawn,setDrawn]=useState<Record<string,number>>({})
  const [error,setError]=useState('')
  const [captionsOn,setCaptionsOn]=useState(true)
  const [sidecarCaptions,setSidecarCaptions]=useState<UniversalCaption[]>([])
  const [mutedTracks,setMutedTracks]=useState<Record<string,boolean>>({})
  const [gainTracks,setGainTracks]=useState<Record<string,number>>({})
  const [seekEpoch,setSeekEpoch]=useState(0)
  const frames=useRef<Record<string,HTMLIFrameElement|null>>({})
  const media=useRef<Record<string,HTMLVideoElement|null>>({})
  const audio=useRef<UniversalBrowserAudio|null>(null)
  if(!audio.current)audio.current=new UniversalBrowserAudio()
  const pending=useRef<Record<string,number>>({})
  const requested=useRef<Record<string,number>>({})
  const sequence=useRef(0)
  const clock=useRef<number|null>(null)
  const position=useRef(timeMs)
  position.current=timeMs
  const readyRef=useRef(ready)
  readyRef.current=ready
  const active=sceneAt(timeline,timeMs)
  const activeId=active?.sceneId||''
  const lastDrawnScene=useRef('')
  if(activeId&&ready[activeId]&&Boolean(drawn[activeId]))
    lastDrawnScene.current=activeId
  const displayedScene=activeId&&ready[activeId]&&drawn[activeId]
    ? activeId:lastDrawnScene.current
  const timelineRef=useRef(timeline)
  timelineRef.current=timeline
  const nextScenes=useMemo(()=>{
    const now=timeMs
    const scenes=timeline.visuals.filter(item=>item.type==='scene')
    const previous=scenes.filter(item=>item.startMs<=now).slice(-2)
    const future=scenes.filter(item=>item.startMs>now).slice(0,1)
    return [...previous,...future].map(v=>v.sceneId!).filter(Boolean)
  },[timeline,timeMs])
  const trackIds=useMemo(()=>[...new Set(timeline.audio.map(a=>a.trackId))],[timeline.audio])

  const send=useCallback((sceneId:string,method:string,...args:unknown[])=>{
    const target=frames.current[sceneId]?.contentWindow
    if(!target)return null
    const id=++sequence.current
    target.postMessage({ms:1,id,method,args},'*')
    return id
  },[])

  useEffect(()=>{
    audio.current?.configure(timeline.audio,assetUrls)
    return()=>audio.current?.pause()
  // Changes to source tracks reset the transport; freshly signed URLs do not.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[timeline.audio])
  useEffect(()=>audio.current?.updateUrls(assetUrls),[assetUrls])
  useEffect(()=>()=>{audio.current?.dispose();audio.current=null},[])

  useEffect(()=>{
    let alive=true
    if(!timeline.captionsAssetIds.length){setSidecarCaptions([]);return}
    Promise.all(timeline.captionsAssetIds.map(async id=>{
      const url=assetUrls[id]
      if(!url)return []
      const res=await fetch(url,{cache:'no-store',credentials:'omit'})
      if(!res.ok)return []
      return readTimelineCaptions(await res.text())
    })).then(cues=>{
      if(!alive)return
      const seen=new Set<string>()
      const unique=cues.flat().filter(cue=>{
        const key=cue.startMs+':'+cue.endMs+':'+cue.text.trim()
        if(seen.has(key))return false
        seen.add(key)
        return true
      })
      setSidecarCaptions(unique)
    })
      .catch(()=>{if(alive)setError('Caption file could not be loaded')})
    return()=>{alive=false}
  },[timeline.captionsAssetIds,assetUrls])

  // The scene itself never plays: it draws an exact requested scene-local frame.
  // A sandboxed frame may post only its documented bridge protocol.
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.origin!=='null')return
      const sceneId=Object.keys(frames.current).find(id=>
        frames.current[id]?.contentWindow===event.source)
      if(!sceneId)return
      const message=event.data as Wire|null
      if(!message||message.ms!==1)return
      if(message.event==='hello'){
        const session=sessions[sceneId]
        if(session)send(sceneId,'init',{theme,overrides,assetUrls:session.assetUrls,
          fonts:session.fonts,assets:session.assetRecords,mode:'live'})
      }else if(message.event==='ready'){
        setReady(old=>({...old,[sceneId]:true}))
        setSeekEpoch(n=>n+1)
      }else if(message.ok===false&&typeof message.error==='string'){
        if(typeof message.id==='number'&&pending.current[sceneId]===message.id)
          delete pending.current[sceneId]
        setError(message.error.slice(0,240))
      }else if(message.ok===true&&typeof message.id==='number'&&
        pending.current[sceneId]===message.id){
        delete pending.current[sceneId]
        setDrawn(old=>({...old,[sceneId]:Date.now()}))
        // The playhead may have advanced during async draw. Immediately send
        // the latest frame; never build an unbounded queue of seeks.
        setSeekEpoch(n=>n+1)
      }
    }
    window.addEventListener('message',receive)
    return()=>window.removeEventListener('message',receive)
  },[sessions,send,theme,overrides])

  useEffect(()=>{
    const now=timeMs
    const visual=sceneAt(timeline,now)
    if(visual?.sceneId&&ready[visual.sceneId]&&!pending.current[visual.sceneId]){
      const localMs=visual.inMs+now-visual.startMs
      if(Math.abs((requested.current[visual.sceneId]??-Infinity)-localMs)>0.25){
        const id=send(visual.sceneId,'seek',Math.max(0,localMs)/1000)
        if(id!==null){pending.current[visual.sceneId]=id;requested.current[visual.sceneId]=localMs}
      }
    }
    // Prepare the next cut without affecting the displayed scene.
    const next=timeline.visuals.find(v=>v.type==='scene'&&v.startMs>now)
    if(next?.sceneId&&ready[next.sceneId]&&!pending.current[next.sceneId]&&
      requested.current[next.sceneId]===undefined){
      const id=send(next.sceneId,'seek',next.inMs/1000)
      if(id!==null){pending.current[next.sceneId]=id;requested.current[next.sceneId]=next.inMs}
    }
  },[timeMs,ready,send,timeline,seekEpoch])

  useEffect(()=>{
    if(!activeId||!ready[activeId])return
    const values=Object.fromEntries(Object.entries(scenePatch).filter(([,v])=>
      v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length))
    if(Object.keys(values).length)
      send(activeId,'setProps',{schema:'transovo.edit-patch/1',
        scenes:{[activeId]:{elements:values}}})
  },[scenePatch,activeId,ready,send])

  const pause=useCallback(()=>{
    audio.current?.pause()
    setPlaying(false)
  },[])
  const seek=useCallback((ms:number)=>{
    pause()
    const at=safeMs(ms,timeline.durationMs)
    position.current=at
    setTimeMs(at)
    audio.current?.seek(at)
    setSeekEpoch(n=>n+1)
  },[pause,timeline.durationMs])
  const togglePlay=useCallback(async()=>{
    if(playing){pause();return}
    const engine=audio.current
    if(!engine)return
    if(activeId&&!ready[activeId]){setError('Current scene is still loading');return}
    setError('')
    try{
      // Unlock during the click; browsers disallow asynchronous autoplay.
      const unlocked=engine.unlock()
      await unlocked
      await engine.prepare()
      await engine.play(position.current,rate)
      setPlaying(true)
    }catch(e){
      setError(e instanceof Error?e.message:'Could not start soundtrack')
      engine.pause()
    }
  },[playing,pause,activeId,ready,rate])

  useEffect(()=>{
    if(!playing)return
    const tick=()=>{
      const engine=audio.current
      if(!engine)return
      const now=safeMs(engine.timeMs(),timelineRef.current.durationMs)
      const upcoming=sceneAt(timelineRef.current,now)
      if(upcoming?.sceneId&&!readyRef.current[upcoming.sceneId]){
        // Do not allow the audio to pass an undrawn scene boundary.
        engine.pause();setPlaying(false);setError('Buffering next scene…')
        return
      }
      position.current=now
      setTimeMs(now)
      engine.syncStreams(now)
      if(now>=timelineRef.current.durationMs){
        engine.pause();setPlaying(false);return
      }
      clock.current=requestAnimationFrame(tick)
    }
    clock.current=requestAnimationFrame(tick)
    return()=>{if(clock.current!==null)cancelAnimationFrame(clock.current);clock.current=null}
  },[playing])

  // Ordinary video is composited in the SAME visual stage, never flattened
  // into the previous MP4. Its playhead follows the common audio clock.
  useEffect(()=>{
    const items=visualsAt(timeline,timeMs).filter(i=>i.type==='video')
    const activeIds=new Set(items.map(i=>i.id))
    for(const item of timeline.visuals.filter(v=>v.type==='video')){
      const element=media.current[item.id]
      if(!element)continue
      if(!activeIds.has(item.id)){element.pause();continue}
      const sec=(item.inMs+timeMs-item.startMs)/1000
      if(Math.abs(element.currentTime-sec)>0.12&&Number.isFinite(sec))
        try{element.currentTime=Math.max(0,sec)}catch{}
      element.playbackRate=rate
      if(playing&&element.paused)void element.play().catch(()=>setError('Video playback was blocked'))
      if(!playing&&!element.paused)element.pause()
    }
  },[timeline,timeMs,playing,rate])

  useEffect(()=>{
    if(activeId)onSceneChange?.(activeId)
  },[activeId,onSceneChange])

  // Do not alter a committed project when the viewer toggles captions or
  // audio controls. Editing persistence is owned by the timeline editor.
  const visibleCaptions=[
    ...sidecarCaptions.filter(c=>timeMs>=c.startMs&&timeMs<c.endMs),
    ...captionsAt(timeline,timeMs),
  ]
  const captionText=captionsOn?
    [...new Map(visibleCaptions.map(c=>[
      c.startMs+':'+c.endMs+':'+c.text.trim(),c.text,
    ])).values()].join('\n'):''
  const showing=visualsAt(timeline,timeMs)
  const sessionScenes=[...new Set(nextScenes)].filter(id=>sessions[id])
  const bg:CSSProperties={aspectRatio:`${timeline.width}/${timeline.height}`}
  return <section aria-label="Universal video timeline player" className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="font-medium">Live project playback</span>
      <span className="text-muted-foreground">Scene code + footage + audio + captions</span>
    </div>
    <div className="relative w-full overflow-hidden rounded-md border border-border bg-black" style={bg}>
      {showing.filter(v=>v.type!=='scene').map(item=>{
        const url=item.assetId?assetUrls[item.assetId]:null
        if(!url)return null
        return item.type==='image'
          ? <img key={item.id} src={url} alt="" className="absolute inset-0 size-full object-contain"
              style={{zIndex:item.layer}}/>
          : <video key={item.id} ref={el=>{media.current[item.id]=el}} src={url}
              playsInline preload="auto" muted={timeline.audio.length>0}
              className="absolute inset-0 size-full object-contain" style={{zIndex:item.layer}}/>
      })}
      {sessionScenes.map(id=>{
        const item=timeline.visuals.find(v=>v.sceneId===id)
        const visible=id===displayedScene&&ready[id]&&Boolean(drawn[id])
        return <iframe key={sessions[id]!.sceneUrl} title={'Editable scene '+id}
          ref={el=>{frames.current[id]=el}}
          src={sessions[id]!.sceneUrl} sandbox="allow-scripts" referrerPolicy="no-referrer"
          className="absolute inset-0 size-full border-0"
          style={{zIndex:(item?.layer??0)+1,opacity:visible?1:0,pointerEvents:'none'}}/>
      })}
      {overlay}
      {captionText?<div aria-label="Preview captions" className="pointer-events-none absolute inset-x-3 bottom-[8%] z-50 whitespace-pre-line text-center text-lg font-extrabold text-white drop-shadow-[0_2px_3px_black]">
        {captionText}</div>:null}
      {activeId&&!ready[activeId]&&!displayedScene?
        <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-black/75 text-xs text-white">
          Loading editable scene…
        </div>:null}
    </div>
    <div className="flex items-center gap-2">
      <button type="button" onClick={()=>void togglePlay()}
        className="rounded-md border border-input px-3 py-1 text-xs"
        disabled={Boolean(activeId&&!ready[activeId])}>
        {playing?'Pause':'Play'}
      </button>
      <input aria-label="Scrub complete timeline" type="range" className="min-w-0 flex-1"
        min={0} max={timeline.durationMs||1} step={1000/timeline.fps}
        value={timeMs} onChange={e=>seek(Number(e.target.value))}/>
      <span className="shrink-0 text-xs tabular-nums">
        {(timeMs/1000).toFixed(2)} / {(timeline.durationMs/1000).toFixed(2)}s
      </span>
    </div>
    {timeline.sceneLayers.length?<details className="rounded-md border border-border px-2 py-1 text-xs">
      <summary className="cursor-pointer font-medium">
        Main Visuals and editable footage layers ({timeline.sceneLayers.length})
      </summary>
      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        {timeline.sceneLayers.map(layer=><button type="button" key={layer.id}
          onClick={()=>seek(layer.startMs)}
          className="flex w-full items-center justify-between gap-2 rounded border border-input px-2 py-1 text-left">
          <span className="truncate">{layer.label} · {layer.kind}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {(layer.startMs/1000).toFixed(1)}–{(layer.endMs/1000).toFixed(1)}s
          </span>
        </button>)}
      </div>
    </details>:null}
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <label className="flex items-center gap-1">Speed
        <select aria-label="Preview speed" value={rate}
          onChange={e=>{
            const next=Number(e.target.value);setRate(next);audio.current?.setRate(next)
          }} className="rounded border border-input px-1 py-0.5">
          {[0.5,1,1.5,2].map(x=><option key={x} value={x}>{x}×</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={captionsOn} onChange={e=>setCaptionsOn(e.target.checked)}/>
        Captions
      </label>
      {trackIds.map(id=><div key={id} className="flex items-center gap-1">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={!mutedTracks[id]} onChange={e=>{
            const next=!e.target.checked
            setMutedTracks(old=>({...old,[id]:next}))
            audio.current?.setTrackMuted(id,next)
          }}/>
          {id}
        </label>
        <input aria-label={'Gain '+id} type="range" min={-36} max={12} step={1}
          value={gainTracks[id]??0} onChange={e=>{
            const db=Number(e.target.value)
            setGainTracks(old=>({...old,[id]:db}))
            audio.current?.setTrackGain(id,db)
          }}/>
      </div>)}
    </div>
    {error?<p className="text-xs text-destructive" role="status">{error}</p>:null}
  </section>
}
