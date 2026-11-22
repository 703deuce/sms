'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, Sparkles, AlertTriangle } from 'lucide-react'

type Job = {
  id:string;status:string;phase:string;progress:number;
  message:string|null;durationMs:number|null;publishedClips?:number
}

export function AgentClipDiscoveryPanel({projectId,onFinished}:{
  projectId:string;onFinished:()=>void
}) {
  const [job,setJob]=useState<Job|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [count,setCount]=useState(3)
  const previousPublished=useRef(0)
  const previousStatus=useRef<string|null>(null)
  const reload=useCallback(async()=>{
    const response=await fetch('/api/clips/projects/'+encodeURIComponent(projectId)+'/agent-discover',
      {cache:'no-store'})
    if(!response.ok) return
    const data=await response.json() as {job:Job|null}
    setJob(data.job)
    if ((data.job?.publishedClips||0)>previousPublished.current ||
      data.job?.status==='complete'&&previousStatus.current!=='complete') onFinished()
    previousPublished.current=data.job?.publishedClips||0
    previousStatus.current=data.job?.status??null
  },[projectId,onFinished])
  useEffect(()=>{
    let active=true
    const poll=()=>{if(active) void reload().catch(()=>{})}
    poll()
    const timer=window.setInterval(poll,5000)
    return ()=>{active=false;window.clearInterval(timer)}
  },[reload])
  const start=async()=>{
    setBusy(true);setError(null)
    try {
      const response=await fetch('/api/clips/projects/'+encodeURIComponent(projectId)+'/agent-discover',{
        method:'POST',headers:{'Content-Type':'application/json',
          'Idempotency-Key':'discover-'+crypto.randomUUID()},
        body:JSON.stringify({maxClips:count}),
      })
      const data=await response.json() as {job?:Job;error?:string}
      if(!response.ok) throw new Error(data.error||'Could not start the Transovo Agent.')
      setJob(data.job??null)
      previousStatus.current=data.job?.status??null
    }catch(e){setError(e instanceof Error?e.message:'Could not start.')}
    finally{setBusy(false)}
  }
  const active=Boolean(job)&&!['complete','failed','dispatch_failed','cancelled'].includes(job!.status)
  const failed=job&&['failed','dispatch_failed','cancelled'].includes(job.status)
  return <section className="rounded-xl border border-border bg-card p-4" aria-label="Transovo Agent automatic clipper"
    data-testid="agent-discover-panel">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-2xl">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary"/>
          Let Transovo Agent make your clips
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          From your uploaded recording, the agent finds and scores the strongest moments,
          makes the cuts, frames the speakers, and designs motion graphics for every highlight.
          You get finished vertical clips plus the original video for manual editing.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={'grok-discover-count-'+projectId} className="text-xs text-muted-foreground">Up to</label>
        <select id={'grok-discover-count-'+projectId} value={count} onChange={e=>setCount(Number(e.target.value))}
          className="rounded-md border bg-background px-2 py-1.5 text-sm">
          {[1,2,3,4,5,6,8,10,12,15,20,25,30].map(n=><option key={n} value={n}>{n} clips</option>)}
        </select>
        <Button size="sm" disabled={busy||active} onClick={()=>void start()}>
          {busy||active?<Loader2 className="mr-2 size-4 animate-spin"/>:<Sparkles className="mr-2 size-4"/>}
          {job?.status==='complete'?'Make another batch':'Create finished clips'}
        </Button>
      </div>
    </div>
    {job?<div className="mt-3 flex items-center gap-2 text-xs" role="status">
      {job.status==='complete'?<CheckCircle2 className="size-4 text-primary"/>:
        failed?<AlertTriangle className="size-4 text-destructive"/>:
        <Loader2 className="size-4 animate-spin"/>}
      <div className="min-w-0 flex-1">
        <p>{job.message||job.phase} {active?'· '+job.progress+'%':''}
          {job.publishedClips ? ' · '+job.publishedClips+' clips ready' : ''}</p>
        {active?<div className="mt-1 h-1.5 overflow-hidden rounded bg-muted">
          <div className="h-full rounded bg-primary" style={{width:Math.max(0,Math.min(100,job.progress))+'%'}}/>
        </div>:null}
      </div>
    </div>:null}
    {error?<p className="mt-2 text-xs text-destructive" role="alert">{error}</p>:null}
  </section>
}
