'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import type {LayoutSegment,ProducerBox} from '@/lib/clips/layout-segments'
import {videoTimeFromSourceMs} from '@/lib/clips/editor-playback'
import {buildZoomKeyframes} from '@/lib/clips/zoom-keyframes'
import {corsMediaProps} from '@/components/clips/editor/g4/media-cors'

type Pane={key:string;rect:{x:number;y:number;w:number;h:number};box:ProducerBox|null}
const whole:ProducerBox={x:0,y:0,w:1,h:1}

/** Match the native renderer's speaker order, panes and split ratios. */
export function producerLayoutPanes(segment:LayoutSegment):Pane[]{
  const people=segment.people??[]
  const order=segment.order??[]
  const ordered=[...people].sort((a,b)=>{
    const ai=order.indexOf(a.speakerId),bi=order.indexOf(b.speakerId)
    return (ai<0?99:ai)-(bi<0?99:bi)
  })
  if(segment.mode==='split'&&ordered.length>=2){
    const ratio=Math.min(.9,Math.max(.1,segment.splitRatio??.5))
    const vertical=segment.orientation==='vertical'
    return ordered.slice(0,2).map((p,i)=>({
      key:p.speakerId+':'+i,box:p.box,
      rect:vertical
        ?{x:0,y:i===0?0:ratio,w:1,h:i===0?ratio:1-ratio}
        :{x:i===0?0:ratio,y:0,w:i===0?ratio:1-ratio,h:1},
    }))
  }
  if((segment.mode==='grid3'||segment.mode==='grid4')&&ordered.length>=2){
    return ordered.slice(0,4).map((p,i)=>({
      key:p.speakerId+':'+i,box:p.box,
      rect:{x:i%2*.5,y:Math.floor(i/2)*.5,w:.5,h:.5},
    }))
  }
  const focus=ordered.find(p=>p.speakerId===segment.focusSpeaker)
  return [{key:'main',rect:{x:0,y:0,w:1,h:1},box:segment.cropBox??focus?.box??null}]
}

/** Source-ms face positions are interpolated; crop dimensions must remain fixed for worker parity. */
export function producerCropAt(segment:LayoutSegment,sourceMs:number):ProducerBox|null{
  const track=segment.faceTrack
  if(!track?.length){
    if(segment.cropBox)return segment.cropBox
    if(segment.zoomAnchor){
      const x=Math.max(0,Math.min(.15,segment.zoomAnchor.x-.425))
      const y=Math.max(0,Math.min(.15,segment.zoomAnchor.y-.425))
      return {x,y,w:.85,h:.85}
    }
    return null
  }
  const first=track[0]!,last=track[track.length-1]!
  if(sourceMs<=first.sourceMs)return first.box
  if(sourceMs>=last.sourceMs)return last.box
  const idx=track.findIndex(k=>k.sourceMs>=sourceMs)
  if(idx<=0)return first.box
  const a=track[idx-1]!,b=track[idx]!
  const t=(sourceMs-a.sourceMs)/Math.max(1,b.sourceMs-a.sourceMs)
  return {x:a.box.x+(b.box.x-a.box.x)*t,y:a.box.y+(b.box.y-a.box.y)*t,
    w:a.box.w+(b.box.w-a.box.w)*t,h:a.box.h+(b.box.h-a.box.h)*t}
}

function PaneVideo({url,pane,width,height,sourceMs,mediaOffsetMs,playing,fit=false}:{
  url:string;pane:Pane;width:number;height:number;sourceMs:number;mediaOffsetMs:number;
  playing:boolean;fit?:boolean
}){
  const video=useRef<HTMLVideoElement|null>(null)
  const [sourceSize,setSourceSize]=useState({w:1920,h:1080})
  const destW=Math.max(1,width*pane.rect.w),destH=Math.max(1,height*pane.rect.h)
  const box=pane.box??whole
  const cropW=sourceSize.w*box.w,cropH=sourceSize.h*box.h
  // Split/grid panes use the worker's scale=W:H (stretch); fill uses
  // aspect-preserving cover, and fit_blur foreground uses contain.
  const stretch=!fit&&pane.key!=='main'
  const scale=(fit?Math.min:Math.max)(destW/cropW,destH/cropH)
  const scaleX=stretch?destW/cropW:scale
  const scaleY=stretch?destH/cropH:scale
  const displayW=sourceSize.w*scaleX,displayH=sourceSize.h*scaleY
  const x=(destW-cropW*scaleX)/2-box.x*displayW
  const y=(destH-cropH*scaleY)/2-box.y*displayH
  useEffect(()=>{
    const el=video.current
    if(!el)return
    const t=Math.max(0,videoTimeFromSourceMs(sourceMs,mediaOffsetMs))
    if(Number.isFinite(t)&&Math.abs(el.currentTime-t)>.08){
      try{el.currentTime=t}catch{/* metadata pending */}
    }
    if(playing&&el.paused)void el.play().catch(()=>{})
    if(!playing&&!el.paused)el.pause()
  },[sourceMs,mediaOffsetMs,playing,url])
  return <div className="absolute overflow-hidden" data-testid="producer-layout-pane"
      style={{left:pane.rect.x*100+'%',top:pane.rect.y*100+'%',
        width:pane.rect.w*100+'%',height:pane.rect.h*100+'%'}}>
    <video ref={video} {...corsMediaProps(url)} src={url}
      muted playsInline preload="auto" aria-hidden tabIndex={-1}
      onLoadedMetadata={e=>setSourceSize({w:e.currentTarget.videoWidth||1920,
        h:e.currentTarget.videoHeight||1080})}
      style={{position:'absolute',maxWidth:'none',width:displayW,height:displayH,
        left:x,top:y,objectFit:'fill',pointerEvents:'none'}}/>
  </div>
}

export function ProducerLayoutPreview({segment,videoUrl,sourceMs,mediaOffsetMs,playing,width,height,
  zoom,captionWords,emphasis,outputMs,outputDurationMs}:{
  segment:LayoutSegment;videoUrl:string;sourceMs:number;mediaOffsetMs:number;
  playing:boolean;width:number;height:number
  zoom?:{enabled?:boolean;intensity?:number;anchor?:{x:number;y:number}}
  captionWords?:{w:string;s:number;e:number;i?:number}[]
  emphasis?:number[]
  outputMs?:number
  outputDurationMs?:number
}){
  const panes=useMemo(()=>producerLayoutPanes(segment),[segment])
  const zoomFrames=useMemo(()=>zoom?.enabled&&captionWords?.length
    ?buildZoomKeyframes(captionWords,emphasis??[],(outputDurationMs??0)/1000,
      zoom.intensity??1.12):[],[zoom?.enabled,zoom?.intensity,captionWords,emphasis,outputDurationMs])
  const t=(outputMs??0)/1000
  const before=[...zoomFrames].reverse().find(frame=>frame.t<=t)
  const after=zoomFrames.find(frame=>frame.t>t)
  const mix=before&&after?(t-before.t)/Math.max(.001,after.t-before.t):0
  const zoomScale=zoom?.enabled
    ?(before?.z??1)+((after?.z??before?.z??1)-(before?.z??1))*mix:1
  const anchor=zoom?.anchor??segment.zoomAnchor??{x:.5,y:.5}
  const animatedCrop=producerCropAt(segment,sourceMs)
  const activePanes=panes.length===1&&animatedCrop
    ?[{...panes[0]!,box:animatedCrop}]:panes
  const vertical=segment.orientation==='vertical',ratio=segment.splitRatio??.5
  const divider=segment.divider
  const line=Math.max(0,Math.min(32,divider?.width??0))*width/1080
  return <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden bg-black"
      style={{transform:zoomScale===1?undefined:'scale('+zoomScale.toFixed(5)+')',
        transformOrigin:(anchor.x*100)+'% '+(anchor.y*100)+'%'}}
      data-testid="producer-layout-preview" data-layout-mode={segment.mode}
      data-split-orientation={vertical?'vertical':'horizontal'}>
    {segment.mode==='fit_blur'?<>
      <video {...corsMediaProps(videoUrl)} src={videoUrl} muted playsInline aria-hidden
        className="absolute inset-0 size-full scale-110 object-cover blur-2xl"
        ref={el=>{if(!el)return;const t=videoTimeFromSourceMs(sourceMs,mediaOffsetMs);
          if(Number.isFinite(t)&&Math.abs(el.currentTime-t)>.1)try{el.currentTime=t}catch{}
          if(playing&&el.paused)void el.play().catch(()=>{})
          if(!playing&&!el.paused)el.pause()
        }}/>
      <PaneVideo key="fit" url={videoUrl} pane={activePanes[0]!} width={width} height={height}
        sourceMs={sourceMs} mediaOffsetMs={mediaOffsetMs} playing={playing} fit/>
    </>:activePanes.map(p=><PaneVideo key={p.key} url={videoUrl} pane={p}
      width={width} height={height} sourceMs={sourceMs}
      mediaOffsetMs={mediaOffsetMs} playing={playing}/>)}
    {segment.mode==='split'&&line>0&&panes.length>=2?<div aria-hidden
      className="absolute" style={{
        backgroundColor:divider?.style==='dashed'?'transparent':(divider?.color??'#FFFFFF'),
        opacity:divider?.opacity??1,
        ...(vertical?{top:'calc('+ratio*100+'% - '+line/2+'px)',left:0,right:0,height:line}:
          {left:'calc('+ratio*100+'% - '+line/2+'px)',top:0,bottom:0,width:line}),
        ...(divider?.style==='dashed'?{
          backgroundImage:'repeating-linear-gradient('+(vertical?'90deg':'0deg')+','+
            (divider?.color??'#FFFFFF')+' 0 ' + (14*width/1080)+'px,transparent '+
            (14*width/1080)+'px '+(24*width/1080)+'px)',
        }:{})
      }}/>:null}
  </div>
}
