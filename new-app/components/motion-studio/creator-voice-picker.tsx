'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
import {AudioLines,Check,ChevronDown,Mic,Pause,Play,Plus,RefreshCw,Star,Trash2,UploadCloud,Volume2,X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import type {MotionStudioClient} from '@/lib/motion-studio/client'

type Voice={id?:string;voiceId:string;name:string;description?:string;gender?:string|null;accent?:string|null;previewUrl?:string;isDefault?:boolean;source:'cloned'|'stock'}
type Data={myVoices:Voice[];stockVoices:Voice[];defaultVoiceId:string|null}
export type VoiceSelection={voiceId:string;voiceName:string;voiceSource:'cloned'|'stock'|'auto'}
const call=async(url:string,method='GET',body?:unknown)=>{
 const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:'no-store'})
 const data=await response.json().catch(()=>({})) as Record<string,unknown>
 if(!response.ok)throw Error(typeof data.error==='string'?data.error:'Voice request failed')
 return data
}
const base='/api/motion-studio/voices'
export function CreatorVoicePicker({client,value,onChange,onError,refreshKey=0}:{
 client:MotionStudioClient;value:VoiceSelection|null;onChange:(voice:VoiceSelection|null)=>void
 onError:(message:string)=>void;refreshKey?:number
}){
 const [library,setLibrary]=useState<Data|null>(null)
 const [loading,setLoading]=useState(false)
 const [dialog,setDialog]=useState(false)
 const [editing,setEditing]=useState<string|null>(null)
 const [busy,setBusy]=useState<string|null>(null)
 const [preview,setPreview]=useState<string|null>(null)
 const audioRef=useRef<HTMLAudioElement|null>(null)
 const initializedDefault=useRef(false)
 const callbacks=useRef({onChange,onError,value})
 callbacks.current={onChange,onError,value}
 const refresh=useCallback(async()=>{
  if(client.mode!=='live')return
  setLoading(true)
  try{
   const data=await call(base) as unknown as Data
   setLibrary(data)
   if(!initializedDefault.current&&data.defaultVoiceId&&!callbacks.current.value){
    const match=[...data.myVoices,...data.stockVoices].find(v=>v.voiceId===data.defaultVoiceId)
    if(match)callbacks.current.onChange({voiceId:match.voiceId,voiceName:match.name,voiceSource:match.source})
   }
   initializedDefault.current=true
  }
  catch(e){callbacks.current.onError(e instanceof Error?e.message:'Cannot load voices')}
  finally{setLoading(false)}
 },[client.mode])
 useEffect(()=>{void refresh()},[refresh,refreshKey])
 const choose=(v:Voice)=>onChange({voiceId:v.voiceId,voiceName:v.name,voiceSource:v.source})
 const play=(v:Voice)=>{
  if(!v.previewUrl)return onError('Preview is not available for this voice yet.')
  if(preview===v.voiceId){audioRef.current?.pause();setPreview(null);return}
  if(audioRef.current)audioRef.current.pause()
  const audio=new Audio(v.previewUrl)
  audioRef.current=audio
  audio.onended=()=>setPreview(null)
  void audio.play().then(()=>setPreview(v.voiceId)).catch(()=>onError('Could not play voice preview.'))
 }
 const update=async(id:string,body:unknown)=>{
  setBusy(id)
  try{await call(base+'/'+encodeURIComponent(id),'PATCH',body);await refresh()}
  catch(e){onError(e instanceof Error?e.message:'Voice update failed')}
  finally{setBusy(null)}
 }
 const makeDefault=async(voice:Voice|null)=>{
  setBusy(voice?.voiceId||'clear')
  try{await call(base+'/default','POST',{voiceId:voice?.voiceId||null,source:voice?.source||'cloned'});await refresh()}
  catch(e){onError(e instanceof Error?e.message:'Could not update default')}
  finally{setBusy(null)}
 }
 const remove=async(voice:Voice)=>{
  if(!voice.id||!window.confirm('Delete your saved voice "'+voice.name+'"?'))return
  setBusy(voice.id)
  try{
   await call(base+'/'+encodeURIComponent(voice.id),'DELETE')
   if(value?.voiceId===voice.voiceId)onChange(null)
   await refresh()
  }catch(e){onError(e instanceof Error?e.message:'Could not delete voice')}
  finally{setBusy(null)}
 }
 return <div className="space-y-4" data-testid="ms-narrator-picker">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div><h4 className="text-sm font-semibold">Narrator library</h4><p className="text-xs text-muted-foreground">Choose a signature voice or let Transovo direct the narration.</p></div>
   <Button type="button" variant="outline" size="sm" onClick={()=>setDialog(true)}><Plus className="mr-1 size-4"/>Create a voice</Button>
  </div>
  <div className="rounded-xl border border-border/80 bg-background/50 p-3">
   <button type="button" onClick={()=>onChange({voiceId:'',voiceName:'Auto-select narrator',voiceSource:'auto'})}
    className={`flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm ${(!value||value.voiceSource==='auto')?'bg-primary/10 ring-1 ring-primary/30':'hover:bg-muted/40'}`}>
    <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><AudioLines className="size-4"/></span>
    <span className="flex-1"><b>Auto-select narrator</b><span className="block text-xs text-muted-foreground">Best voice for the finished story</span></span>
    {(!value||value.voiceSource==='auto')?<Check className="size-4 text-primary"/>:null}
   </button>
  </div>
  <div className="space-y-3">
   <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Star className="size-3.5"/>My voices</div>
   {!library?.myVoices.length?<p className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">Your saved voices appear here. Record one to narrate future videos in your own voice.</p>:null}
   {library?.myVoices.map(v=><div key={v.id} className={`rounded-xl border p-3 ${value?.voiceId===v.voiceId?'border-primary/60 bg-primary/5':'border-border bg-card'}`}>
    <div className="flex flex-wrap items-center gap-3">
     <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Mic className="size-4"/></span>
     <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-sm font-semibold">{v.name}{v.isDefault?<span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">Default</span>:null}</div><p className="text-xs text-muted-foreground">Your {v.source==='cloned'?'cloned':'saved'} narrator</p></div>
     <Button type="button" size="sm" variant="outline" disabled={!v.previewUrl} onClick={()=>play(v)}>{preview===v.voiceId?<Pause className="size-4"/>:<Play className="size-4"/>}</Button>
     <Button type="button" size="sm" variant={value?.voiceId===v.voiceId?'default':'secondary'} onClick={()=>choose(v)}>{value?.voiceId===v.voiceId?'Selected':'Use'}</Button>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-border/60 pt-2">
     <button className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted" onClick={()=>void makeDefault(v)} disabled={!!busy}>{v.isDefault?'Current default':'Make default'}</button>
     {v.isDefault?<button className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted" onClick={()=>void makeDefault(null)}>Clear default</button>:null}
     {v.source==='cloned'?<><button className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted" onClick={()=>setEditing(editing===v.id?null:v.id||null)}>Rename</button><button className="ml-auto rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10" onClick={()=>void remove(v)}><Trash2 className="size-3.5"/></button></>:null}
    </div>
    {editing===v.id?<form className="mt-2 flex gap-2" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void update(v.id!,{name:data.get('name')});setEditing(null)}}>
     <input name="name" defaultValue={v.name} minLength={2} maxLength={80} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm"/><Button size="sm">Save</Button>
    </form>:null}
   </div>)}
   <div className="flex items-center justify-between gap-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><span className="flex items-center gap-2"><Volume2 className="size-3.5"/>Studio voices</span>{loading?<RefreshCw className="size-3.5 animate-spin"/>:null}</div>
   <div className="grid gap-2 sm:grid-cols-2">
    {library?.stockVoices.map(v=><div key={v.voiceId} className={`flex min-w-0 items-center gap-2 rounded-xl border p-3 transition-colors ${value?.voiceId===v.voiceId?'border-primary/60 bg-primary/5':'border-border bg-card hover:border-foreground/20'}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground"><AudioLines className="size-4"/></span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{v.name}</p><p className="truncate text-xs text-muted-foreground">{v.description}</p></div>
      <button aria-label={'Preview '+v.name} disabled={!v.previewUrl} className="grid size-8 place-items-center rounded-md hover:bg-muted disabled:opacity-30" onClick={()=>play(v)}>{preview===v.voiceId?<Pause className="size-4"/>:<Play className="size-4"/>}</button>
      <button aria-label={'Use '+v.name} className={`grid size-8 place-items-center rounded-md ${value?.voiceId===v.voiceId?'bg-primary text-primary-foreground':'bg-muted hover:bg-primary/15'}`} onClick={()=>choose(v)}>{value?.voiceId===v.voiceId?<Check className="size-4"/>:<Plus className="size-4"/>}</button>
    </div>)}
   </div>
  </div>
  {dialog?<CloneVoiceDialog client={client} onClose={()=>setDialog(false)} onCreated={async(v)=>{
    await refresh();onChange({voiceId:v.voiceId,voiceName:v.name,voiceSource:'cloned'});setDialog(false)
   }} onError={onError}/>:null}
 </div>
}
function CloneVoiceDialog({client,onClose,onCreated,onError}:{client:MotionStudioClient;onClose:()=>void;onCreated:(voice:{voiceId:string;name:string})=>void;onError:(message:string)=>void}){
 const [name,setName]=useState('')
 const [tab,setTab]=useState<'record'|'upload'>('record')
 const [file,setFile]=useState<File|null>(null)
 const [recording,setRecording]=useState(false)
 const [duration,setDuration]=useState(0)
 const [busy,setBusy]=useState(false)
 const recorder=useRef<MediaRecorder|null>(null)
 const tracks=useRef<MediaStream|null>(null)
 const chunks=useRef<BlobPart[]>([])
 const started=useRef(0)
 const clock=useRef<ReturnType<typeof setInterval>|null>(null)
 const stop=()=>{
  if(clock.current)clearInterval(clock.current)
  if(recorder.current?.state==='recording')recorder.current.stop()
  tracks.current?.getTracks().forEach(t=>t.stop())
  setRecording(false)
 }
 useEffect(()=>()=>{if(clock.current)clearInterval(clock.current);recorder.current?.state==='recording'&&recorder.current.stop();tracks.current?.getTracks().forEach(t=>t.stop())},[])
 const record=async()=>{
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true})
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t))||''
   const media=new MediaRecorder(stream,mime?{mimeType:mime}:undefined)
   tracks.current=stream;recorder.current=media;chunks.current=[]
   media.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)}
   media.onstop=()=>{
    const blob=new Blob(chunks.current,{type:media.mimeType||'audio/webm'})
    setFile(new File([blob],'my-voice.'+(media.mimeType.includes('mp4')?'m4a':'webm'),{type:blob.type}))
   }
   setFile(null);setDuration(0);started.current=Date.now()
   media.start(1000);setRecording(true)
   clock.current=setInterval(()=>{
    const sec=Math.floor((Date.now()-started.current)/1000)
    setDuration(sec)
    if(sec>=120)stop()
   },250)
  }catch{onError('Microphone blocked. Use the Upload tab to add your recording.');setTab('upload')}
 }
 const submit=async()=>{
  if(name.trim().length<2||!file||recording)return
  if(tab==='record'&&duration<10)return onError('Record at least 10 seconds of clear speech.')
  setBusy(true)
  try{
   const sample=await client.uploadFile(file,()=>{})
   const response=await call(base,'POST',{name:name.trim(),sampleUploadId:sample.uploadId}) as {voice:{voiceId:string;name:string}}
   onCreated(response.voice)
  }catch(e){onError(e instanceof Error?e.message:'Could not clone your voice')}
  finally{setBusy(false)}
 }
 return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Create a voice">
  <div className="w-full max-w-xl space-y-5 rounded-2xl border border-border bg-card p-6 shadow-2xl">
   <div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-semibold">Create your voice</h3><p className="mt-1 text-sm text-muted-foreground">Record or upload a clear sample. Save it to use across your videos.</p></div>
    <button onClick={()=>{stop();onClose()}} aria-label="Close"><X className="size-5"/></button></div>
   <label className="block space-y-2 text-sm font-medium">Voice name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} placeholder="e.g. My documentary voice" className="h-11 w-full rounded-lg border border-input bg-background px-3"/></label>
   <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
    {(['record','upload'] as const).map(t=><button key={t} className={`rounded-md px-4 py-2 text-sm font-medium ${tab===t?'bg-card shadow-sm':''}`} onClick={()=>{stop();setTab(t);setFile(null)}}>{t==='record'?'Record microphone':'Upload a sample'}</button>)}
   </div>
   {tab==='record'?<div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5">
     <span className="grid size-14 place-items-center rounded-full bg-primary/15 text-primary"><Mic className="size-7"/></span>
     <p className="font-mono text-xl tabular-nums">{String(Math.floor(duration/60)).padStart(2,'0')}:{String(duration%60).padStart(2,'0')}</p>
     <p className="text-xs text-muted-foreground">Aim for 30 seconds of clear, natural speech</p>
     <Button type="button" onClick={()=>recording?stop():void record()}>{recording?'Stop recording':'Start recording'}</Button>
    </div>:<label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 text-sm">
     <UploadCloud className="size-8 text-primary"/><strong>Choose an audio recording</strong>
     <span className="text-xs text-muted-foreground">MP3, WAV, M4A, WEBM or OGG</span>
     <input className="sr-only" type="file" accept=".mp3,.wav,.m4a,.webm,.ogg,audio/*" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>}
   {file?<div className="rounded-lg border border-border p-3"><p className="truncate text-xs text-muted-foreground">{file.name}</p><audio controls className="mt-2 w-full" src={URL.createObjectURL(file)}/></div>:null}
   <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>{stop();onClose()}}>Cancel</Button><Button disabled={busy||recording||name.trim().length<2||!file} onClick={()=>void submit()}>{busy?'Creating your voice…':'Create voice'}</Button></div>
  </div>
 </div>
}
