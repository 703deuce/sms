'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Slot={id:string;ordinal:number;label:string;media:'video'|'image'|'either';minDurationMs:number;target:{kind:string}}
type TextField={id:string;itemId:string;label:string;exampleText:string;maxChars:number}
type Definition={v:1;snapshot:{aspect:string;clipStartMs:number;clipEndMs:number;editsSaveVersion:number};slots:Slot[];textFields:TextField[];
 previewRange:{startMs:number;endMs:number};capabilities:Record<string,boolean>}
type Manifest={v:1;musicPolicy:'keep'|'replace'|'mute';decorative:Array<unknown>}
type PrivateDetail={id:string;title:string;description:string;currentRevision:number;createdById:string;
 revision:{revision:number;definition:Definition;assetManifest:Manifest}}
type PublicDetail={id:string;title:string;description:string;creatorName:string;licenseTerms:string;category:string;tags:string[];
 aspect:string;clipCount:number;durationMs:number;publicDefinition:{v:1;definition:Definition;manifest:Manifest}}
type MediaItem={asset:{id:string;kind:'video'|'image'|'audio';durationFrames?:number};label:string;durationMs:number|null;
 available:boolean;width:number|null;height:number|null}
type MediaResponse={items:MediaItem[];total:number;page:number;pages:number}

function fmt(ms:number){return ms<1000?ms+' ms':(ms/1000).toFixed(ms%1000?1:0)+' s'}
function canFill(slot:Slot,item:MediaItem){
  if(!item.available)return false
  if(slot.media!=='either'&&item.asset.kind!==slot.media)return false
  if(item.asset.kind==='audio')return false
  if(item.asset.kind==='video'&&(!item.durationMs||item.durationMs<slot.minDurationMs))return false
  return true
}

export function UserTemplateFillStudio({id,mode}:{id:string;mode:'private'|'community'}){
  const router=useRouter()
  const [title,setTitle]=useState('')
  const [description,setDescription]=useState('')
  const [creator,setCreator]=useState('')
  const [license,setLicense]=useState('')
  const [revision,setRevision]=useState<number|undefined>()
  const [definition,setDefinition]=useState<Definition|null>(null)
  const [manifest,setManifest]=useState<Manifest|null>(null)
  const [media,setMedia]=useState<MediaResponse|null>(null)
  const [mediaQuery,setMediaQuery]=useState('')
  const [fills,setFills]=useState<Record<string,string>>({})
  const [texts,setTexts]=useState<Record<string,string>>({})
  const [musicUploadId,setMusicUploadId]=useState('')
  const [error,setError]=useState<string|null>(null)
  const [loading,setLoading]=useState(true)
  const [creating,setCreating]=useState(false)

  useEffect(()=>{
    let live=true
    setLoading(true);setError(null)
    const path=mode==='private'?'/api/clips/user-templates/'+encodeURIComponent(id):
      '/api/clips/video-templates/community/'+encodeURIComponent(id)
    fetch(path,{cache:'no-store'}).then(async r=>{
      const body=await r.json() as {data?:PrivateDetail|PublicDetail;error?:string}
      if(!r.ok||!body.data)throw new Error(body.error??'Template not found')
      if(!live)return
      if(mode==='private'){
        const d=body.data as PrivateDetail
        setTitle(d.title);setDescription(d.description);setRevision(d.revision.revision)
        setDefinition(d.revision.definition);setManifest(d.revision.assetManifest)
        setTexts(Object.fromEntries(d.revision.definition.textFields.map(f=>[f.id,f.exampleText])))
      }else{
        const d=body.data as PublicDetail
        setTitle(d.title);setDescription(d.description);setCreator(d.creatorName);setLicense(d.licenseTerms)
        setDefinition(d.publicDefinition.definition);setManifest(d.publicDefinition.manifest)
        setTexts(Object.fromEntries(d.publicDefinition.definition.textFields.map(f=>[f.id,f.exampleText])))
      }
    }).catch(e=>{if(live)setError(e instanceof Error?e.message:'Template not found')})
      .finally(()=>{if(live)setLoading(false)})
    return()=>{live=false}
  },[id,mode])

  useEffect(()=>{
    let live=true
    const timer=setTimeout(()=>{
      const q=new URLSearchParams({page:'1'})
      if(mediaQuery.trim())q.set('q',mediaQuery.trim())
      fetch('/api/clips/video-templates/media?'+q.toString(),{cache:'no-store'}).then(async r=>{
        const body=await r.json() as {data?:MediaResponse;error?:string}
        if(!r.ok||!body.data)throw new Error(body.error??'Could not load workspace media')
        if(live)setMedia(body.data)
      }).catch(e=>{if(live)setError(e instanceof Error?e.message:'Could not load workspace media')})
    },200)
    return()=>{live=false;clearTimeout(timer)}
  },[mediaQuery])

  const videoItems=media?.items.filter(x=>x.asset.kind!=='audio')??[]
  const audioItems=media?.items.filter(x=>x.asset.kind==='audio'&&x.available)??[]
  const ready=Boolean(definition&&manifest&&definition.slots.every(s=>fills[s.id])&&
    (manifest.musicPolicy!=='replace'||musicUploadId))
  const duration=definition?definition.snapshot.clipEndMs-definition.snapshot.clipStartMs:0
  const totalNeed=definition?.slots.reduce((n,s)=>n+s.minDurationMs,0)||1

  const create=async()=>{
    if(!definition||!manifest||!ready)return
    setCreating(true);setError(null)
    try{
      const path=mode==='private'
        ?'/api/clips/user-templates/'+encodeURIComponent(id)+'/use'
        :'/api/clips/video-templates/community/'+encodeURIComponent(id)+'/use'
      const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        ...(mode==='private'&&revision?{revision}:{}),fills,text:texts,
        ...(manifest.musicPolicy==='replace'?{musicUploadId}:{}),
      })})
      const body=await response.json() as {data?:{projectId:string;clipId:string};error?:string}
      if(!response.ok||!body.data)throw new Error(body.error??'Could not create project')
      router.push('/app/clips/'+encodeURIComponent(body.data.projectId)+'/edit/'+encodeURIComponent(body.data.clipId))
    }catch(e){setError(e instanceof Error?e.message:'Could not create project')}
    finally{setCreating(false)}
  }

  if(loading)return <main className="mx-auto max-w-5xl p-8"><p className="text-sm text-muted-foreground">Loading template…</p></main>
  if(!definition||!manifest)return <main className="mx-auto max-w-5xl p-8"><p role="alert" className="text-destructive">{error??'Template unavailable'}</p></main>

  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6" data-testid="user-template-fill-studio">
    <header className="space-y-2">
      <Link href="/app/clips/video-templates" className="text-sm text-primary hover:underline">← Video templates</Link>
      <div className="text-xs font-semibold uppercase tracking-widest text-primary">{mode==='private'?'My template':'Community template'}</div>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {description?<p className="max-w-3xl text-sm text-muted-foreground">{description}</p>:null}
      {mode==='community'?<p className="text-xs text-muted-foreground">By {creator} · {license}</p>:
        <p className="text-xs text-muted-foreground">Pinned revision {revision} · later edits to the template will not change this copy.</p>}
    </header>

    {error?<p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>:null}

    <section className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-semibold">Editable structure preview</h2>
          <p className="text-xs text-muted-foreground">{definition.snapshot.aspect} · {fmt(duration)} · preview {fmt(definition.previewRange.startMs)}–{fmt(definition.previewRange.endMs)}</p></div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {Object.entries(definition.capabilities).filter(([,v])=>v).map(([k])=><span key={k} className="rounded-full border px-2 py-1">{k}</span>)}
        </div>
      </div>
      <div className="mt-4 flex h-16 overflow-hidden rounded-xl border bg-muted/20" aria-label="Template slot timeline preview">
        {definition.slots.length?definition.slots.map(slot=><div key={slot.id}
          style={{width:Math.max(6,slot.minDurationMs/totalNeed*100)+'%'}}
          className="flex min-w-16 items-center justify-center border-r px-2 text-center text-[11px] last:border-r-0">
          {slot.ordinal}. {slot.media}
        </div>):<div className="grid flex-1 place-items-center text-xs text-muted-foreground">No replaceable media slots</div>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">This is the pinned edit structure, not a flattened render. Using it creates normal editable source clips, transitions, text/graphics, audio and keyframes.</p>
    </section>

    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><h2 className="font-semibold">Fill numbered slots</h2><p className="text-xs text-muted-foreground">Workspace-owned uploads only.</p></div>
        <Label className="ml-auto w-full max-w-xs space-y-1 text-xs">Search media
          <Input type="search" value={mediaQuery} onChange={e=>setMediaQuery(e.target.value)} placeholder="Search uploaded media" />
        </Label>
      </div>
      {definition.slots.map(slot=><Label key={slot.id} className="grid gap-1 rounded-xl border p-3 sm:grid-cols-[180px_1fr] sm:items-center">
        <span><span className="font-medium">Slot {slot.ordinal}</span><span className="block text-xs text-muted-foreground">{slot.media} · min {fmt(slot.minDurationMs)}</span></span>
        <select className="h-10 min-w-0 rounded-lg border bg-background px-3 text-sm" value={fills[slot.id]??''}
          onChange={e=>setFills(p=>({...p,[slot.id]:e.target.value}))}>
          <option value="">Choose media…</option>
          {videoItems.filter(item=>canFill(slot,item)).map(item=><option key={item.asset.id} value={item.asset.id}>
            {item.label}{item.durationMs?' · '+fmt(item.durationMs):''}
          </option>)}
        </select>
      </Label>)}
      {media&&media.pages>1?<p className="text-xs text-muted-foreground">Showing the newest/search-matched 60 of {media.total} uploads. Search by filename to find older media.</p>:null}
    </section>

    {definition.textFields.length?<section className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="font-semibold">Editable text</h2>
      {definition.textFields.map(field=><Label key={field.id} className="grid gap-1 sm:grid-cols-[180px_1fr] sm:items-center">
        <span>{field.label}</span>
        <Input value={texts[field.id]??field.exampleText} maxLength={field.maxChars}
          onChange={e=>setTexts(p=>({...p,[field.id]:e.target.value}))} />
      </Label>)}
    </section>:null}

    {manifest.musicPolicy==='replace'?<section className="space-y-2 rounded-2xl border bg-card p-4">
      <h2 className="font-semibold">Replace soundtrack</h2>
      <select aria-label="Replacement music" className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
        value={musicUploadId} onChange={e=>setMusicUploadId(e.target.value)}>
        <option value="">Choose workspace audio…</option>
        {audioItems.map(item=><option key={item.asset.id} value={item.asset.id}>{item.label}{item.durationMs?' · '+fmt(item.durationMs):''}</option>)}
      </select>
      <p className="text-xs text-muted-foreground">The saved music timing, fades and keyframes remain editable on the standard audio track.</p>
    </section>:null}

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
      <p className="max-w-2xl text-xs text-muted-foreground">A new project is created. The source template and any existing projects remain unchanged.</p>
      <Button size="lg" disabled={!ready||creating} onClick={()=>void create()}>{creating?'Creating…':'Use template'}</Button>
    </div>
  </main>
}
