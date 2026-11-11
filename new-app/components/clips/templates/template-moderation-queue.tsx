'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type Report={id:string;reason:string;details:string|null;createdAt:string;reporterUserId:string}
type Audit={id:string;actorUserId:string;actorRole:string;action:string;reason:string|null;createdAt:string}
type QueueItem={
  id:string;templateId:string;title:string;description:string;creatorName:string;creatorUserId:string;state:string
  category:string;tags:string[];aspect:string;clipCount:number;durationMs:number;licenseTerms:string
  publicPreview:unknown;rightsAttestation:unknown;moderationFlags:unknown;submittedAt:string|null;publishedAt:string|null
  reports:Report[];audit:Audit[]
}
type Action='approve'|'reject'|'hide'|'unpublish'|'takedown'|'restore'

export function TemplateModerationQueue(){
  const [items,setItems]=useState<QueueItem[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [reason,setReason]=useState<Record<string,string>>({})
  const [busy,setBusy]=useState<string|null>(null)
  const [refresh,setRefresh]=useState(0)
  useEffect(()=>{
    let live=true
    setLoading(true);setError(null)
    fetch('/api/clips/video-templates/moderation',{cache:'no-store'})
      .then(async r=>{const body=await r.json() as {data?:{items:QueueItem[]};error?:string}
        if(!r.ok||!body.data)throw new Error(body.error??(r.status===403?'Moderator permission required':'Could not load moderation queue'))
        if(live)setItems(body.data.items)
      })
      .catch(e=>{if(live)setError(e instanceof Error?e.message:'Could not load moderation queue')})
      .finally(()=>{if(live)setLoading(false)})
    return()=>{live=false}
  },[refresh])
  const act=async(item:QueueItem,action:Action)=>{
    const needsReason=!['approve','restore'].includes(action)
    const why=(reason[item.id]??'').trim()
    if(needsReason&&!why){setError('Enter a reason before '+action+'.');return}
    setBusy(item.id+':'+action);setError(null)
    try{
      const r=await fetch('/api/clips/video-templates/moderation/'+encodeURIComponent(item.id),{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,reason:why||undefined}),
      })
      const body=await r.json() as {data?:unknown;error?:string}
      if(!r.ok||!body.data)throw new Error(body.error??'Moderation action failed')
      setRefresh(x=>x+1)
    }catch(e){setError(e instanceof Error?e.message:'Moderation action failed')}
    finally{setBusy(null)}
  }
  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6" data-testid="template-moderation-queue">
    <header className="space-y-2">
      <Link href="/app/clips/video-templates" className="text-sm text-primary hover:underline">← Video templates</Link>
      <div className="text-xs font-semibold uppercase tracking-widest text-primary">Permission-separated review</div>
      <h1 className="text-3xl font-semibold tracking-tight">Community template moderation</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">Automated flags are review aids only. A human moderator must approve publication; creators cannot approve their own submissions.</p>
    </header>
    {error?<p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>:null}
    {loading?<p className="text-sm text-muted-foreground">Loading review queue…</p>:null}
    {!loading&&!error&&!items.length?<p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No pending submissions, reported publications, or hidden/taken-down items.</p>:null}
    <div className="space-y-5">
      {items.map(item=>{
        const pending=item.state==='submitted'
        const live=item.state==='published'
        const removed=item.state==='hidden'||item.state==='takedown'
        return <article key={item.id} className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="text-xs text-muted-foreground">By {item.creatorName} · {item.category} · {item.aspect} · {item.clipCount} clips · {(item.durationMs/1000).toFixed(1)}s</p></div>
            <span className="rounded-full border px-3 py-1 text-xs font-medium">{item.state}</span>
          </div>
          <p className="text-sm">{item.description}</p>
          <p className="text-xs text-muted-foreground">Reuse terms: {item.licenseTerms}</p>
          {item.tags.length?<div className="flex flex-wrap gap-1">{item.tags.map(tag=><span key={tag} className="rounded-full border px-2 py-0.5 text-[10px]">{tag}</span>)}</div>:null}
          <div className="grid gap-3 lg:grid-cols-2">
            <details className="rounded-xl border p-3" open={pending}>
              <summary className="cursor-pointer text-sm font-medium">Sanitized public payload & rights assertions</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">{JSON.stringify({preview:item.publicPreview,rights:item.rightsAttestation,flags:item.moderationFlags},null,2)}</pre>
            </details>
            <div className="space-y-2 rounded-xl border p-3">
              <h3 className="text-sm font-medium">Open reports ({item.reports.length})</h3>
              {!item.reports.length?<p className="text-xs text-muted-foreground">No open user reports.</p>:item.reports.map(r=><div key={r.id} className="rounded-lg bg-muted/30 p-2 text-xs">
                <p className="font-medium">{r.reason}</p><p className="text-muted-foreground">{r.details||'No details supplied.'}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Reporter {r.reporterUserId} · {new Date(r.createdAt).toLocaleString()}</p>
              </div>)}
            </div>
          </div>
          <details className="rounded-xl border p-3">
            <summary className="cursor-pointer text-sm font-medium">Moderation audit trail ({item.audit.length})</summary>
            <ol className="mt-2 space-y-2">{item.audit.map(a=><li key={a.id} className="text-xs">
              <span className="font-medium">{a.action}</span> · {a.actorRole} {a.actorUserId} · {new Date(a.createdAt).toLocaleString()}
              {a.reason?<span className="block text-muted-foreground">{a.reason}</span>:null}
            </li>)}</ol>
          </details>
          <label className="block space-y-1 text-xs font-medium">Moderator reason
            <textarea className="min-h-20 w-full rounded-lg border bg-background p-3 text-sm font-normal" maxLength={1000}
              value={reason[item.id]??''} onChange={e=>setReason(p=>({...p,[item.id]:e.target.value}))}
              placeholder={pending?'Required for rejection; optional internal note is not stored on approval.':'Required for hide/takedown actions.'} />
          </label>
          <div className="flex flex-wrap gap-2">
            {pending?<><Button disabled={Boolean(busy)} onClick={()=>void act(item,'approve')}>Approve & publish</Button>
              <Button variant="outline" disabled={Boolean(busy)} onClick={()=>void act(item,'reject')}>Reject</Button></>:null}
            {live?<><Button variant="outline" disabled={Boolean(busy)} onClick={()=>void act(item,'hide')}>Hide from discovery</Button>
              <Button variant="outline" disabled={Boolean(busy)} onClick={()=>void act(item,'takedown')}>Takedown</Button></>:null}
            {removed?<Button disabled={Boolean(busy)} onClick={()=>void act(item,'restore')}>Restore publication</Button>:null}
          </div>
        </article>
      })}
    </div>
  </main>
}
