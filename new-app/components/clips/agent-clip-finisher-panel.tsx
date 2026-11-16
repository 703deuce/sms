'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Download } from 'lucide-react'
import type { ClipCardData } from './clip-grid'

type Job = {
  id:string;clipId:string;projectId:string;status:string;phase:string;progress:number;
  message:string|null;videoUrl:string|null;durationMs:number|null
}
type Props = {
  projectId:string
  clips:ClipCardData[]
  selectedClipIds:Set<string>
  onFinished?:()=>void
}

/** Keeps existing scored moment results and original editable clips intact. */
export function AgentClipFinisherPanel({projectId,clips,selectedClipIds,onFinished}:Props) {
  const [jobs,setJobs]=useState<Job[]>([])
  const [running,setRunning]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [limit,setLimit]=useState(3)
  const picks=useMemo(()=>{
    const sorted=[...clips].sort((a,b)=>b.score-a.score)
    const chosen=selectedClipIds.size?sorted.filter(c=>selectedClipIds.has(c.id)):sorted
    return chosen.slice(0,limit)
  },[clips,selectedClipIds,limit])
  const load=useCallback(async()=>{
    const response=await fetch('/api/clips/projects/'+encodeURIComponent(projectId)+'/agent-finish',{cache:'no-store'})
    if(!response.ok) return
    const data=await response.json() as {jobs:Job[]}
    setJobs(data.jobs||[])
  },[projectId])
  useEffect(()=>{
    let live=true
    const refresh=()=>{if(live) void load().catch(()=>{})}
    refresh()
    const timer=window.setInterval(refresh,5000)
    return ()=>{live=false;window.clearInterval(timer)}
  },[load])
  const start=async()=>{
    if(running||!picks.length) return
    setRunning(true);setError(null)
    try {
      const response=await fetch('/api/clips/projects/'+encodeURIComponent(projectId)+'/agent-finish',{
        method:'POST',
        headers:{'Content-Type':'application/json','Idempotency-Key':'clip-agent-'+crypto.randomUUID()},
        body:JSON.stringify({clipIds:picks.map(c=>c.id)}),
      })
      const data=await response.json() as {error?:string;jobs?:Job[]}
      if(!response.ok) throw new Error(data.error||'Could not start finishing these clips.')
      await load()
    }catch(e){setError(e instanceof Error?e.message:'Clip finishing unavailable.')}
    finally{setRunning(false)}
  }
  const display=jobs.filter(j=>clips.some(c=>c.id===j.clipId))
  return <section className="rounded-xl border border-border bg-card p-4" aria-label="Transovo Agent clip finishing" data-testid="agent-clip-finisher">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary"/> Finish with Transovo Agent</h3>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
          Keep your best discovered moments and original voices. The agent adds creative cuts,
          speaker-aware framing, split screens, captions and custom motion graphics.
          Your original editable clips remain available.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor={'agent-clip-count-'+projectId}>Clips</label>
        <select id={'agent-clip-count-'+projectId} className="rounded-md border bg-background px-2 py-1.5 text-sm"
          value={limit} onChange={e=>setLimit(Number(e.target.value))}>
          {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        <Button size="sm" onClick={()=>void start()} disabled={running||!picks.length}>
          {running?<Loader2 className="mr-2 size-4 animate-spin"/>:<Sparkles className="mr-2 size-4"/>}
          {selectedClipIds.size?'Finish selected clips':'Finish top clips'}
        </Button>
      </div>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">
      {selectedClipIds.size?selectedClipIds.size+' moment(s) selected.':'Using highest-scoring clips.'}
      {' '}Next: {picks.map(c=>c.title).join(' · ')||'No clips available'}
    </p>
    {error?<p className="mt-3 text-xs text-destructive" role="alert">{error}</p>:null}
    {display.length? <div className="mt-4 space-y-2">
      {display.map(job=>{
        const clip=clips.find(c=>c.id===job.clipId)
        const done=job.status==='complete'
        const failed=['failed','cancelled','dispatch_failed'].includes(job.status)
        return <div key={job.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-xs">
          {done?<CheckCircle2 className="size-4 text-primary"/>:failed?<AlertTriangle className="size-4 text-destructive"/>:<Loader2 className="size-4 animate-spin"/>}
          <div className="min-w-[140px] flex-1">
            <p className="truncate font-medium">{clip?.title||'Clip'}</p>
            <p className="text-muted-foreground">{job.message||job.phase}{done?' · Ready':failed?' · Retry available':' · '+job.progress+'%'}</p>
            {!done&&!failed?<div className="mt-1.5 h-1.5 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-primary" style={{width:Math.max(0,Math.min(100,job.progress))+'%'}}/></div>:null}
          </div>
          {done&&job.videoUrl?<a href={job.videoUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline"><Download className="size-3"/> Finished MP4</a>:null}
          {done?<Link href={'/app/video-editor/'+encodeURIComponent(projectId)+'/edit/'+encodeURIComponent(job.clipId)}
            className="font-medium text-primary underline">Open editor</Link>:null}
        </div>
      })}
    </div>:null}
  </section>
}
