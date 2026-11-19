'use client'
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from 'react'
import type {UniversalTimeline,UniversalVisual,UniversalCaption} from '@/lib/motion-studio/universal-timeline'
import {captionsAt,visualsAt} from '@/lib/motion-studio/universal-timeline'
import {readTimelineCaptions} from '@/lib/motion-studio/universal-captions'
import {UniversalBrowserAudio} from '@/lib/motion-studio/universal-browser-audio'
import {reportMotionStudioLoad} from '@/lib/motion-studio/report-load'

export type BrowserSceneSession={sceneId:string;sceneUrl:string;expiresAt:string;
  assetUrls:Record<string,string>;assetRecords:Record<string,unknown>;
  fonts:Record<string,unknown>}
type Wire={ms?:number;event?:string;id?:number;ok?:boolean;error?:string;
  stage?:string;elapsedMs?:number;count?:number;maxMs?:number}
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
export function UniversalTimelinePlayer({projectId,timeline,sessions,assetUrls,theme,overrides,previewVideoUrl,
  scenePatch={},onSceneChange,overlay}:{
    projectId?:string;timeline:UniversalTimeline;sessions:Record<string,BrowserSceneSession>;
    assetUrls:Record<string,string>;theme:Record<string,unknown>;
    previewVideoUrl?:string|null;
    overrides:Record<string,unknown>;
    scenePatch?:Record<string,Record<string,unknown>>;
    onSceneChange?:(sceneId:string)=>void
    overlay?:ReactNode
  }){
  const loadStart=useRef<number>(performance.now())
  const firstFrameLogged=useRef(false)
  const [firstFrameRendered,setFirstFrameRendered]=useState(false)
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
      if(message.event==='boot-timing'){
        const allowed=new Set(['runtime-start','runtime-init-message','first-render-call',
          'dom-ready','window-load','fonts-ready','images-ready',
          'cpu-snapshot-6s','cpu-snapshot-11s'])
        if(typeof message.stage==='string'&&allowed.has(message.stage)){
          const local=Number(message.elapsedMs)
          if(Number.isFinite(local)&&local>=0&&local<120000){
            console.info('[motion-studio:browser-load]',{stage:message.stage,sceneId,
              iframeElapsedMs:Math.round(local),parentElapsedMs:Math.round(performance.now()-loadStart.current),
              resourceCount:message.count,maxResourceMs:message.maxMs})
            reportMotionStudioLoad('iframe-'+message.stage,performance.now()-loadStart.current,
              local,projectId,sceneId,{count:message.count,maxMs:message.maxMs})
          }
        }
        return
      }
      if(message.event==='hello'){
        reportMotionStudioLoad('iframe-hello',performance.now()-loadStart.current,undefined,projectId,sceneId)
        const session=sessions[sceneId]
        if(session){
          send(sceneId,'init',{theme,overrides,assetUrls:session.assetUrls,
            fonts:session.fonts,assets:session.assetRecords,mode:'live'})
          reportMotionStudioLoad('iframe-init-sent',performance.now()-loadStart.current,undefined,projectId,sceneId)
        }
      }else if(message.event==='ready'){
        console.info('[motion-studio:browser-load]',{stage:'scene-ready',sceneId,elapsedMs:Math.round(performance.now()-loadStart.current)})
        reportMotionStudioLoad('scene-ready',performance.now()-loadStart.current,undefined,projectId,sceneId)
        // Request the opening frame immediately, without waiting for React's
        // ready-state render/effect cycle. Future scenes get their own first
        // frame ready before playback reaches the cut.
        const item=timelineRef.current.visuals.find(v=>v.sceneId===sceneId)
        if(item&&!pending.current[sceneId]){
          const playhead=position.current
          const localMs=item.inMs+(playhead>=item.startMs&&playhead<item.startMs+item.durationMs?
            playhead-item.startMs:0)
          const id=send(sceneId,'seek',Math.max(0,localMs)/1000)
          if(id!==null){
            pending.current[sceneId]=id
            requested.current[sceneId]=localMs
            reportMotionStudioLoad('iframe-first-seek-sent',performance.now()-loadStart.current,
              undefined,projectId,sceneId)
          }
        }
        setReady(old=>({...old,[sceneId]:true}))
        setSeekEpoch(n=>n+1)
      }else if(message.ok===false&&typeof message.error==='string'){
        if(typeof message.id==='number'&&pending.current[sceneId]===message.id)
          delete pending.current[sceneId]
        setError(message.error.slice(0,240))
      }else if(message.ok===true&&typeof message.id==='number'&&
        pending.current[sceneId]===message.id){
        delete pending.current[sceneId]
        if(!firstFrameLogged.current){
          firstFrameLogged.current=true
          setFirstFrameRendered(true)
          console.info('[motion-studio:browser-load]',{stage:'first-frame-drawn',sceneId,elapsedMs:Math.round(performance.now()-loadStart.current)})
          reportMotionStudioLoad('first-frame-drawn',performance.now()-loadStart.current,undefined,projectId,sceneId)
        }
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
    // Prepare each future scene's first frame, not just the next cut.
    // Otherwise S3 can be initialized but still black when playback reaches it.
    for(const next of timeline.visuals.filter(v=>v.type==='scene'&&v.startMs>now)){
      if(!next.sceneId||!ready[next.sceneId]||pending.current[next.sceneId]||
        requested.current[next.sceneId]!==undefined)continue
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
    const allScenes=timeline.visuals.filter(v=>v.type==='scene').map(v=>v.sceneId!).filter(Boolean)
    // Starting before the upcoming scene initializes made playback freeze at a cut.
    if(allScenes.length<=3&&allScenes.some(id=>!ready[id]||!drawn[id])){
      setError('Preparing all scenes for uninterrupted playback…')
      return
    }
    if(activeId&&!ready[activeId]){setError('Current scene is still loading');return}
    setError('')
    if(position.current>=timeline.durationMs-1){
      position.current=0
      setTimeMs(0)
      engine.seek(0)
      setSeekEpoch(n=>n+1)
    }
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
  },[playing,pause,activeId,ready,drawn,rate,timeline])

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
  // Prioritize the first picture: do not flood the scene host with S2/S3
  // scripts, fonts and frame packs before S1 has drawn its opening frame.
  // Once S1 draws, mount every remaining scene in parallel. Play stays gated
  // on readiness of all short-film scenes to avoid buffering at the cut.
  const allSceneIds=timeline.visuals.filter(v=>v.type==='scene').map(v=>v.sceneId!).filter(Boolean)
  const firstSceneId=allSceneIds[0]||''
  const sessionScenes=[...new Set(allSceneIds)].filter(id=>Boolean(sessions[id])&&
    (firstFrameRendered||id===firstSceneId))
  // Report actual paint readiness, not just the iframe's draw acknowledgement.
  const hasVisibleScene=Boolean(displayedScene)
  useEffect(()=>{
    if(!hasVisibleScene||!firstFrameRendered)return
    let cancelled=false
    const id=requestAnimationFrame(()=>{
      if(!cancelled)reportMotionStudioLoad('first-frame-visible',performance.now()-loadStart.current,undefined,projectId)
    })
    return()=>{cancelled=true;cancelAnimationFrame(id)}
  },[firstFrameRendered,hasVisibleScene,projectId])
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
          src={sessions[id]!.sceneUrl} loading="eager" sandbox="allow-scripts" referrerPolicy="no-referrer"
          onLoad={()=>reportMotionStudioLoad('iframe-document-load',
            performance.now()-loadStart.current,undefined,projectId,id)}
          className="absolute inset-0 size-full border-0"
          style={{zIndex:(item?.layer??0)+1,opacity:visible?1:0,pointerEvents:'none'}}/>
      })}
      {previewVideoUrl&&!firstFrameRendered?
        <video key={previewVideoUrl} src={previewVideoUrl} autoPlay muted playsInline loop
          preload="auto" aria-label="Rendered preview while editable scenes load"
          className="pointer-events-none absolute inset-0 size-full object-contain"
          style={{zIndex:30}}/>:null}
      {overlay}
      {captionText?<div aria-label="Preview captions" className="pointer-events-none absolute inset-x-3 bottom-[8%] z-50 whitespace-pre-line text-center text-lg font-extrabold text-white drop-shadow-[0_2px_3px_black]">
        {captionText}</div>:null}
      {activeId&&!ready[activeId]&&!displayedScene&&!previewVideoUrl?
        <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-black/75 text-xs text-white">
          Loading editable scene…
        </div>:null}
    </div>
    <div className="flex items-center gap-2">
      <button type="button" onClick={()=>void togglePlay()}
        className="rounded-md border border-input px-3 py-1 text-xs"
        disabled={Boolean(activeId&&!ready[activeId]) || (allSceneIds.length<=3 && allSceneIds.some(id=>!ready[id]||!drawn[id]))}>
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
