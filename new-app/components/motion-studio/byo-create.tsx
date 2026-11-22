'use client'

import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import Link from 'next/link'
import {toast} from 'sonner'
import {ArrowDown,ArrowLeft,ArrowUp,Clapperboard,FolderOpen,Plus,RefreshCw,Trash2,UploadCloud,WandSparkles} from 'lucide-react'
import {getMotionStudioClient,newIdempotencyKey} from '@/lib/motion-studio'
import {sanitizeProductionBrief,type InputRole} from '@/lib/motion-studio/production-brief'
import type {MsAssetKind} from '@/lib/motion-studio/types'
import {CreatorVoicePicker,type VoiceSelection} from './creator-voice-picker'

type FootageRole='footage'|'angle'|'broll'|'photo'|'narration'|'music'
type UploadRow={id:string;file:File;role:FootageRole;progress:number;uploadId?:string;
  status:'uploading'|'ready'|'failed';error?:string;durationS?:number}
type VoiceAmount='none'|'occasional'|'mostly'
const allowedRoles:{value:FootageRole;label:string}[]=[
  {value:'footage',label:'Main footage'},{value:'angle',label:'Another camera angle'},
  {value:'broll',label:'Extra shots (B-roll)'},{value:'photo',label:'Photo'},
  {value:'music',label:'Music'},{value:'narration',label:'My voiceover'},
]
const typeOptions=['Interview','Podcast','Talking head','Tutorial','Event or vlog','Other']
const fileIdentity=(f:File)=>[f.name,f.size,f.lastModified].join(':')
const typeFor=(f:File):FootageRole=>f.type.startsWith('image/')?'photo':
  f.type.startsWith('audio/')?'music':'footage'
const assetFor=(role:FootageRole):MsAssetKind=>role==='photo'?'photo':
  role==='music'||role==='narration'?'audio':'video'

function probeDuration(file:File,onReady:(durationS:number)=>void){
  if(!file.type.startsWith('video/')&&!file.type.startsWith('audio/'))return
  const media=document.createElement(file.type.startsWith('audio/')?'audio':'video')
  const url=URL.createObjectURL(file)
  media.preload='metadata'
  media.onloadedmetadata=()=>{if(Number.isFinite(media.duration))onReady(media.duration);URL.revokeObjectURL(url)}
  media.onerror=()=>URL.revokeObjectURL(url)
  media.src=url
}
export function ByoCreate(){
  const router=useRouter()
  const client=useMemo(()=>getMotionStudioClient(),[])
  const fileRef=useRef<HTMLInputElement>(null)
  const folderRef=useRef<HTMLInputElement>(null)
  const idem=useRef(newIdempotencyKey('byo'))
  const pending=useRef(false)
  const [rows,setRows]=useState<UploadRow[]>([])
  const [step,setStep]=useState<1|2>(1)
  const [goal,setGoal]=useState('Make this into one clear, polished video')
  const [instructions,setInstructions]=useState('')
  const [videoType,setVideoType]=useState('Interview')
  const [voiceover,setVoiceover]=useState<VoiceAmount>('none')
  const [length,setLength]=useState(0)
  const [voice,setVoice]=useState<VoiceSelection|null>(null)
  const [script,setScript]=useState('')
  const [aspect,setAspect]=useState<'16:9'|'9:16'|'1:1'>('16:9')
  const [music,setMusic]=useState<'elevenlabs'|'none'>('elevenlabs')
  const [captions,setCaptions]=useState(true)
  const [reviewPlan,setReviewPlan]=useState(true)
  const [more,setMore]=useState(false)
  const [audience,setAudience]=useState('')
  const [cta,setCta]=useState('')
  const [keepNotes,setKeepNotes]=useState('')
  const [starting,setStarting]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const videoCount=rows.filter(r=>r.file.type.startsWith('video/')).length
  const busy=rows.some(r=>r.status==='uploading')
  const ready=rows.filter(r=>r.status==='ready'&&r.uploadId)
  const minutes=rows.reduce((sum,r)=>sum+(r.durationS??0),0)/60

  useEffect(()=>{
    folderRef.current?.setAttribute('webkitdirectory','')
    folderRef.current?.setAttribute('directory','')
  },[])
  const updateRow=useCallback((id:string,patch:Partial<UploadRow>)=>{
    setRows(rows=>rows.map(r=>r.id===id?{...r,...patch}:r))
  },[])
  const upload=useCallback(async(row:UploadRow)=>{
    updateRow(row.id,{progress:0,status:'uploading',error:undefined})
    try{
      const result=await client.uploadFile(row.file,percent=>
        updateRow(row.id,{progress:Math.max(0,Math.min(100,percent))}))
      updateRow(row.id,{uploadId:result.uploadId,progress:100,status:'ready'})
    }catch(err){
      updateRow(row.id,{status:'failed',error:err instanceof Error?err.message:'Could not upload this file'})
    }
  },[client,updateRow])
  const addFiles=useCallback((files:FileList|null)=>{
    if(!files?.length)return
    const existing=new Set(rows.map(r=>fileIdentity(r.file)))
    const additions:UploadRow[]=[]
    for(const file of Array.from(files)){
      if(file.name.startsWith('.'))continue
      if(existing.has(fileIdentity(file))){toast.message('Already added: '+file.name);continue}
      if(!/^(video|audio|image)\//.test(file.type)){
        toast.error('We cannot read '+file.name+'. Try MP4, MOV, WebM, audio or a photo.')
        continue
      }
      existing.add(fileIdentity(file))
      additions.push({id:newIdempotencyKey('byofile'),file,role:typeFor(file),
        progress:0,status:'uploading'})
    }
    if(!additions.length)return
    setRows(prev=>[...prev,...additions])
    for(const row of additions){
      probeDuration(row.file,durationS=>updateRow(row.id,{durationS}))
      void upload(row)
    }
  },[rows,updateRow,upload])
  const move=(index:number,delta:number)=>setRows(prev=>{
    const to=index+delta;if(to<0||to>=prev.length)return prev
    const next=[...prev];[next[index],next[to]]=[next[to]!,next[index]!];return next
  })
  const canStart=videoCount>0&&ready.length===rows.length&&goal.trim().length>0&&!starting&&!busy
  const start=async()=>{
    if(!canStart||pending.current)return
    pending.current=true;setStarting(true);setError(null)
    try{
      const inputs=ready.map(r=>({
        uploadId:r.uploadId!,filename:r.file.name,mime:r.file.type,
        role:r.role as InputRole,
      }))
      // 0 = "as long as it needs": the footage itself sets the length.
      const durationSeconds=length>0?length:Math.max(60,Math.round(minutes*60)||180)
      const narrationFile=ready.find(r=>r.role==='narration')
      const narration=voiceover==='none'?{mode:'none'}:
        narrationFile?{mode:'uploaded_narration',uploadId:narrationFile.uploadId}:
        {mode:voice?.voiceSource==='cloned'?'cloned_voice':'ai_voice',
          ...(voice?{voiceId:voice.voiceId,voiceName:voice.voiceName,voiceSource:voice.voiceSource}:{})}
      const productionBrief=sanitizeProductionBrief({
        workflow:'footage',prompt:[goal.trim(),instructions.trim()].filter(Boolean).join('\n'),
        videoType:'video_editing',durationSeconds,
        aspectRatio:aspect,resolution:'1080p',
        style:{id:'automatic'},audience,goal:goal.trim(),footageType:videoType,
        captionsEnabled:captions,callToAction:cta,
        voiceoverAmount:voiceover,reviewPlan,
        narration,
        ...(script.trim()?{script:{text:script.trim(),handling:'improve'}}:{}),
        music:{mode:music},inputs,
        sourcePreferences:{text:keepNotes,preferPrimaryFootage:true},
      })
      const uploads=ready.map(r=>({
        uploadId:r.uploadId!,kind:assetFor(r.role),label:r.file.name,
        role:r.role as InputRole,
      }))
      const project=await client.createProject({
        workflow:'footage',prompt:goal.trim(),uploads,
        script:script.trim()||null,
        mediaPolicy:'uploads_only',durationSeconds,
        format:(aspect+'_1080p') as '16:9_1080p'|'9:16_1080p'|'1:1_1080p',
        creative:{videoType:'video_editing',style:'automatic',brandMode:'none',
          instructions:[instructions,keepNotes,captions?'Captions on':'Captions off'].filter(Boolean).join('\n')},
        productionBrief,idempotencyKey:idem.current,
      })
      // Same production path as Create with AI: the server dispatches the
      // Transovo Agent, whose result opens in the existing Compact Editor.
      if(client.mode==='live'){
        const response=await fetch('/api/motion-studio/agent/jobs',{method:'POST',
          headers:{'Content-Type':'application/json','Idempotency-Key':'create-'+project.id},
          body:JSON.stringify({projectId:project.id})})
        if(!response.ok){
          const issue=await response.json().catch(()=>({})) as {error?:string}
          throw new Error(issue.error||'Could not start your video. Try again.')
        }
      }
      router.push('/app/edit-my-footage/'+encodeURIComponent(project.id))
    }catch(err){
      setError(err instanceof Error?err.message:'Could not start your video. Try again.')
      pending.current=false;setStarting(false)
    }
  }
  return (
    <main className="mx-auto w-full max-w-5xl space-y-7 px-4 py-8 sm:px-6" data-testid="byo-create">
      <Link href="/app" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4"/> All video options
      </Link>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <Clapperboard className="size-4"/> Edit My Footage
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your footage. One finished video.</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Add a recording or several clips. Tell us what you want to make. We will organize the story,
          tighten the cuts and add the finishing touches.
        </p>
      </div>
      <div className="flex gap-2 text-xs" aria-label="Setup steps">
        <span className={'rounded-full px-3 py-1.5 '+(step===1?'bg-primary text-primary-foreground':'bg-muted')}>1. Add footage</span>
        <span className={'rounded-full px-3 py-1.5 '+(step===2?'bg-primary text-primary-foreground':'bg-muted')}>2. Tell us what to make</span>
      </div>
      {step===1?(
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div>
            <h2 className="text-lg font-semibold">Add your recordings</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add one long recording or several pieces. We will put them together.</p>
          </div>
          <div className="flex flex-wrap gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-5">
            <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
              onClick={()=>fileRef.current?.click()}><UploadCloud className="size-4"/> Add files</button>
            <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium"
              onClick={()=>folderRef.current?.click()}><FolderOpen className="size-4"/> Add a folder</button>
            <input ref={fileRef} multiple type="file" accept="video/*,audio/*,image/*" className="hidden"
              onChange={e=>{addFiles(e.target.files);e.target.value=''}}/>
            <input ref={folderRef} multiple type="file" className="hidden"
              onChange={e=>{addFiles(e.target.files);e.target.value=''}}/>
          </div>
          {rows.length>0?(
            <ul className="space-y-3" aria-label="Your footage files">
              {rows.map((r,i)=>(
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3" data-testid="byo-file">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"><Clapperboard className="size-5"/></span>
                  <div className="min-w-[140px] flex-1">
                    <p className="truncate text-sm font-medium">{r.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.durationS?Math.ceil(r.durationS/60)+' min · ':''}
                      {r.status==='ready'?'Ready':r.status==='uploading'?'Uploading '+Math.round(r.progress)+'%':r.error||'Upload failed'}
                    </p>
                    {r.status==='uploading'?<progress max={100} value={r.progress} className="mt-1 h-1.5 w-full"/>:null}
                  </div>
                  <select aria-label={'File role: '+r.file.name} className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                    value={r.role} onChange={e=>updateRow(r.id,{role:e.target.value as FootageRole})}>
                    {allowedRoles.filter(opt=>
                      r.file.type.startsWith('video/')?['footage','angle','broll'].includes(opt.value):
                      r.file.type.startsWith('audio/')?['music','narration'].includes(opt.value):opt.value==='photo'
                    ).map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <div className="flex gap-1">
                    <button aria-label="Move file earlier" disabled={i===0} onClick={()=>move(i,-1)}
                      className="rounded-md border p-2 disabled:opacity-40"><ArrowUp className="size-3.5"/></button>
                    <button aria-label="Move file later" disabled={i===rows.length-1} onClick={()=>move(i,1)}
                      className="rounded-md border p-2 disabled:opacity-40"><ArrowDown className="size-3.5"/></button>
                    {r.status==='failed'?<button aria-label="Retry file" onClick={()=>void upload(r)} className="rounded-md border p-2">
                      <RefreshCw className="size-3.5"/></button>:null}
                    <button aria-label="Remove file" onClick={()=>setRows(prev=>prev.filter(x=>x.id!==r.id))}
                      className="rounded-md border p-2"><Trash2 className="size-3.5"/></button>
                  </div>
                </li>
              ))}
            </ul>
          ):null}
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">{videoCount} video {videoCount===1?'file':'files'} ·
              {minutes>0?' about '+Math.ceil(minutes)+' footage minutes':' Duration appears after files are read'}
            </p>
            <button disabled={!videoCount} onClick={()=>setStep(2)}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Continue
            </button>
          </div>
        </section>
      ):(
        <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div>
            <h2 className="text-lg font-semibold">Tell us what you want to make</h2>
            <p className="text-sm text-muted-foreground">A simple direction is enough. We can work out the details.</p>
          </div>
          <label className="block space-y-2 text-sm font-medium">
            What should we make?
            <textarea value={goal} onChange={e=>setGoal(e.target.value)} rows={3} maxLength={15000}
              placeholder="A 3-minute story from this interview. Or just make it a coherent edit."
              className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm"/>
          </label>
          <div className="space-y-2">
            <p className="text-sm font-medium">What kind of footage is it?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {typeOptions.map(option=><button key={option} onClick={()=>setVideoType(option)}
                className={'rounded-lg border px-3 py-3 text-left text-sm '+(videoType===option?'border-primary bg-primary/10 font-medium':'border-border')}>
                {option}
              </button>)}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">Length
              <select className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={length} onChange={e=>setLength(Number(e.target.value))}>
                <option value={0}>As long as it needs</option>
                {[60,180,300,600,1200,1800,3600].map(n=><option key={n} value={n}>{n/60} {n===60?'minute':'minutes'}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">Video shape
              <select className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={aspect} onChange={e=>setAspect(e.target.value as typeof aspect)}>
                <option value="16:9">Wide · YouTube</option><option value="9:16">Vertical · Shorts & Reels</option>
                <option value="1:1">Square</option>
              </select>
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Voiceover</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {([['none','No voiceover'],['occasional','Only where needed'],['mostly','Throughout']] as const).map(([value,label])=>
                <label key={value} className={'cursor-pointer rounded-lg border p-3 text-sm '+(voiceover===value?'border-primary bg-primary/10':'border-border')}>
                  <input type="radio" name="byo-voiceover" checked={voiceover===value}
                    onChange={()=>setVoiceover(value)} className="mr-2 accent-primary"/>{label}
                </label>)}
            </div>
            {voiceover!=='none'&&!ready.some(r=>r.role==='narration')?
              <div className="rounded-xl border border-border p-3">
                <CreatorVoicePicker client={client} value={voice} onChange={setVoice}
                  onError={message=>toast.error(message)}/>
              </div>:null}
            {voiceover!=='none'&&ready.some(r=>r.role==='narration')?
              <p className="text-xs text-muted-foreground">We'll use the voiceover recording you added.</p>:null}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm"><input type="checkbox" className="mr-2 accent-primary" checked={captions}
              onChange={e=>setCaptions(e.target.checked)}/>Add captions</label>
            <label className="text-sm"><input type="checkbox" className="mr-2 accent-primary" checked={music==='elevenlabs'}
              onChange={e=>setMusic(e.target.checked?'elevenlabs':'none')}/>Add music</label>
          </div>
          <label className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm">
            <input type="checkbox" checked={reviewPlan} onChange={e=>setReviewPlan(e.target.checked)} className="accent-primary"/>
            Let me check the story plan before you finish. Uncheck for “Just make it.”
          </label>
          <button className="text-sm font-medium text-primary" onClick={()=>setMore(x=>!x)}
            aria-expanded={more}>{more?'Hide':'Show'} more options</button>
          {more?<div className="grid gap-3 rounded-xl border border-border p-4">
            <label className="space-y-1 text-sm">Script or talking points (optional)
              <textarea className="block w-full rounded-lg border border-border bg-background p-3 text-sm" rows={4}
                value={script} onChange={e=>setScript(e.target.value)}
                placeholder="Leave empty and we'll decide whether your video needs one."/>
            </label>
            <label className="space-y-1 text-sm">Extra direction
              <textarea className="block w-full rounded-lg border border-border bg-background p-3 text-sm" rows={3}
                value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="Keep the speaker's answer intact; add simple titles."/>
            </label>
            <label className="space-y-1 text-sm">Keep or avoid
              <textarea className="block w-full rounded-lg border border-border bg-background p-3 text-sm" rows={2}
                value={keepNotes} onChange={e=>setKeepNotes(e.target.value)}/>
            </label>
            <label className="space-y-1 text-sm">Who will watch this?
              <input className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={audience} onChange={e=>setAudience(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm">What should viewers do next?
              <input className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                value={cta} onChange={e=>setCta(e.target.value)}/>
            </label>
          </div>:null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <button onClick={()=>setStep(1)} className="rounded-lg border border-border px-4 py-2.5 text-sm">Back to footage</button>
            <div className="space-y-1 text-right">
              <p className="text-sm font-medium">{minutes>0?'About '+Math.ceil(minutes)+' footage minutes':'Footage minutes calculated after upload'}</p>
              <p className="text-xs text-muted-foreground">No footage-minute charges are enabled.</p>
            </div>
            <button disabled={!canStart} onClick={()=>void start()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              <WandSparkles className="size-4"/>{starting?'Starting…':'Make my video'}
            </button>
          </div>
          {busy?<p role="status" className="text-sm text-muted-foreground">Uploads are finishing. You can keep adjusting your video settings.</p>:null}
          {error?<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>:null}
        </section>
      )}
    </main>
  )
}
