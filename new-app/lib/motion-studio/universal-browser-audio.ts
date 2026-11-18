'use client'
import type {UniversalAudio} from './universal-timeline'
import {gainFromDb} from './universal-timeline'

type Started={source:AudioBufferSourceNode;gain:GainNode;clip:UniversalAudio}
type Stream={element:HTMLAudioElement;clip:UniversalAudio}
const AUDIO_BUFFER_MAX_MS=20_000

/**
 * Shared browser audio transport for normal footage projects and generated
 * scenes. Short stems use sample-accurate Web Audio. Long stems stream via
 * HTMLAudioElement instead of decoding an entire documentary into memory.
 * Call play() only from a user gesture (browser autoplay policy).
 */
export class UniversalBrowserAudio {
  private ctx:AudioContext|null=null
  private clips:UniversalAudio[]=[]
  private urls:Record<string,string>={}
  private decoded=new Map<string,AudioBuffer>()
  private streams=new Map<string,Stream>()
  private started:Started[]=[]
  private gains=new Map<string,number>()
  private muted=new Map<string,boolean>()
  private anchorMs=0
  private startedAt=0
  private speed=1
  private running=false
  private generation=0

  configure(clips:UniversalAudio[],urls:Record<string,string>){
    this.pause()
    for(const entry of this.streams.values()){entry.element.pause();entry.element.removeAttribute('src');entry.element.load()}
    this.streams.clear()
    this.clips=clips
    this.urls=urls
    this.decoded.clear()
    this.generation++
  }
  async prepare(){
    if(!this.clips.length)return
    const ctx=this.ctx||(this.ctx=new AudioContext())
    const run=this.generation
    // Bounded four-at-once network/decode work, avoiding very long PCM buffers.
    const short=[...new Set(this.clips.filter(c=>c.durationMs<=AUDIO_BUFFER_MAX_MS)
      .map(c=>c.assetId))].filter(id=>!this.decoded.has(id))
    for(let i=0;i<short.length;i+=4){
      const result=await Promise.all(short.slice(i,i+4).map(async id=>{
        const url=this.urls[id]
        if(!url)throw Error('Audio track has no registered media: '+id)
        const response=await fetch(url,{credentials:'omit'})
        if(!response.ok)throw Error('Audio download failed for '+id)
        return {id,buffer:await ctx.decodeAudioData(await response.arrayBuffer())}
      }))
      if(this.generation!==run)return
      for(const item of result)this.decoded.set(item.id,item.buffer)
    }
    for(const clip of this.clips.filter(c=>c.durationMs>AUDIO_BUFFER_MAX_MS)){
      const url=this.urls[clip.assetId]
      if(!url)throw Error('Audio track has no registered media: '+clip.assetId)
      const element=new Audio(url)
      element.preload='metadata'
      element.crossOrigin='anonymous'
      this.streams.set(clip.id,{element,clip})
    }
  }
  private context(){return this.ctx||(this.ctx=new AudioContext())}
  /** Invoke directly inside the Play click, before any awaited network work. */
  unlock(){return this.context().resume()}
  async play(fromMs:number,speed=1){
    this.pause()
    const ctx=this.context()
    await ctx.resume()
    const at=ctx.currentTime+0.035
    this.anchorMs=fromMs
    this.startedAt=at
    this.speed=speed
    this.running=true
    for(const clip of this.clips){
      if(clip.startMs+clip.durationMs<=fromMs)continue
      const buffer=this.decoded.get(clip.assetId)
      if(!buffer)continue
      const source=ctx.createBufferSource()
      const gain=ctx.createGain()
      source.buffer=buffer
      source.playbackRate.value=speed
      gain.gain.value=this.gainOf(clip)
      source.connect(gain).connect(ctx.destination)
      const beginMs=Math.max(fromMs,clip.startMs)
      const offset=(clip.inMs+beginMs-clip.startMs)/1000
      const remaining=(clip.startMs+clip.durationMs-beginMs)/1000
      if(offset<buffer.duration&&remaining>0){
        source.start(at+Math.max(0,clip.startMs-fromMs)/1000/speed,offset,
          Math.min(remaining,buffer.duration-offset))
        this.started.push({source,gain,clip})
      }else{source.disconnect();gain.disconnect()}
    }
    this.syncStreams(fromMs)
  }
  private gainOf(clip:UniversalAudio){
    return clip.muted||this.muted.get(clip.trackId)===true?0:
      gainFromDb(clip.gainDb+(this.gains.get(clip.trackId)||0))
  }
  timeMs(){
    if(!this.running||!this.ctx)return this.anchorMs
    return Math.max(0,this.anchorMs+
      Math.max(0,this.ctx.currentTime-this.startedAt)*this.speed*1000)
  }
  syncStreams(atMs=this.timeMs()){
    for(const {element,clip} of this.streams.values()){
      const inside=atMs>=clip.startMs&&atMs<clip.startMs+clip.durationMs
      if(!inside||!this.running){
        if(!element.paused)element.pause()
        continue
      }
      const target=(clip.inMs+atMs-clip.startMs)/1000
      if(Number.isFinite(element.duration)&&target>=element.duration){element.pause();continue}
      if(Math.abs(element.currentTime-target)>0.15){
        try{element.currentTime=target}catch{/* Wait for metadata to decode. */}
      }
      element.volume=Math.max(0,Math.min(1,this.gainOf(clip)))
      element.playbackRate=this.speed
      if(element.paused)void element.play().catch(()=>undefined)
    }
  }
  seek(atMs:number){
    const wasPlaying=this.running
    const speed=this.speed
    this.pause()
    this.anchorMs=Math.max(0,atMs)
    if(wasPlaying)void this.play(this.anchorMs,speed)
    else for(const stream of this.streams.values()){
      const {clip,element}=stream
      if(atMs>=clip.startMs&&atMs<clip.startMs+clip.durationMs){
        try{element.currentTime=(clip.inMs+atMs-clip.startMs)/1000}catch{}
      }
    }
  }
  pause(){
    if(this.running)this.anchorMs=this.timeMs()
    this.running=false
    for(const item of this.started){
      try{item.source.stop()}catch{}
      item.source.disconnect();item.gain.disconnect()
    }
    this.started=[]
    for(const {element} of this.streams.values())element.pause()
  }
  setRate(rate:number){
    if(!Number.isFinite(rate)||rate<0.25||rate>4)return
    const t=this.timeMs()
    const running=this.running
    this.pause();this.speed=rate;this.anchorMs=t
    if(running)void this.play(t,rate)
  }
  setTrackGain(trackId:string,db:number){
    this.gains.set(trackId,db)
    for(const started of this.started.filter(s=>s.clip.trackId===trackId))
      started.gain.gain.value=this.gainOf(started.clip)
    this.syncStreams()
  }
  setTrackMuted(trackId:string,muted:boolean){
    this.muted.set(trackId,muted)
    for(const started of this.started.filter(s=>s.clip.trackId===trackId))
      started.gain.gain.value=this.gainOf(started.clip)
    this.syncStreams()
  }
  isPlaying(){return this.running}
  dispose(){
    this.pause()
    for(const {element} of this.streams.values()){
      element.pause();element.removeAttribute('src');element.load()
    }
    this.streams.clear();this.decoded.clear();this.clips=[]
    const ctx=this.ctx;this.ctx=null
    if(ctx)void ctx.close()
  }
}
