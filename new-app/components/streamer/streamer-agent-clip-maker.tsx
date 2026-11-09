'use client'

import {useEffect,useState} from 'react'
import Link from 'next/link'
import {Sparkles,Loader2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {aiProducerAgentPublicEnabled} from '@/lib/ai-producer-agent/flags'
import {MAX_AGENT_SOURCE_WINDOW_MS} from '@/lib/streamer/agent-windows'

export type StreamerShortMode='clip_moment_v1'|'clip_story_v1'
type FinishedClip={projectId:string;clipId:string;startMin:number;rank?:number;score?:number;reason?:string;category?:string}
const WINDOW_MS=MAX_AGENT_SOURCE_WINDOW_MS
async function requestJson(url:string,opts?:RequestInit){
  const response=await fetch(url,{cache:'no-store',...opts})
  const json=await response.json()
  if(!response.ok)throw Error(typeof json.error==='string'?json.error:
    json.error?.message??'Request failed')
  return json.data
}

/** Streams can be audio-first: on demand prepare only the selected video window.
 * Runs are sequential to respect AI Producer workspace concurrency limits.
 * Each completed clip persists even when the browser leaves a multi-window run. */
export function StreamerAgentClipMaker({projectId,ready,sourceStartMs,sourceDurationMs,videoAvailable,sourceKind='stream'}:{
  projectId:string;ready:boolean;sourceStartMs:number;sourceDurationMs:number
  videoAvailable:boolean;sourceKind?:'stream'|'upload'
}){
  const [mode,setMode]=useState<StreamerShortMode>('clip_moment_v1')
  const [seconds,setSeconds]=useState<30|60|90>(60)
  const [windowStartMin,setWindowStartMin]=useState(0)
  const [allWindows,setAllWindows]=useState(false)
  const [running,setRunning]=useState(false)
  const [status,setStatus]=useState('idle')
  const [completed,setCompleted]=useState<FinishedClip[]>([])
  const [errors,setErrors]=useState<string[]>([])
  const [batchId,setBatchId]=useState<string|null>(null)
  // The entire-VOD batch is durable: project settings and worker jobs survive
  // refresh, logout and browser closure. Reattach to it when reopening the page.
  useEffect(()=>{
    let stopped=false
    let timer:ReturnType<typeof setTimeout>|undefined
    const poll=async()=>{
      try{
        const data=await requestJson('/api/streamer/agent-batches?projectId='+
          encodeURIComponent(projectId)) as null|{
          id:string;status:string;index:number;total:number
          completed:FinishedClip[];errors:string[]
        }
        if(stopped)return
        if(data?.id){
          setBatchId(data.id)
          setCompleted(data.completed??[])
          setErrors(data.errors??[])
          setStatus(data.status==='running'?
            `Batch window ${Math.min(data.total,data.index+1)}/${data.total}`:
            data.status==='done'?'Complete':data.status)
          setRunning(data.status==='running')
        }
      }catch{
        // A transient status lookup failure cannot cancel queued worker jobs.
      }
      if(!stopped)timer=setTimeout(poll,5000)
    }
    void poll()
    return ()=>{stopped=true;if(timer)clearTimeout(timer)}
  },[projectId])
  if(!aiProducerAgentPublicEnabled())return null

  async function create(){
    if(running)return
    setRunning(true);setErrors([])
    try{
      const batch=await requestJson('/api/streamer/agent-batches',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({projectId,mode,seconds,allWindows,
          selectedStartMin:allWindows?0:windowStartMin,action:'start'}),
      }) as {id:string;status:string;total:number}
      setBatchId(batch.id)
      setStatus('Finding and ranking candidate moments, then producing clips')
    }catch(e){
      setErrors(prev=>[...prev,String((e as Error).message)])
      setRunning(false)
    }
  }

  async function cancelBatch(){
    if(!batchId)return
    try{
      await requestJson('/api/streamer/agent-batches',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({projectId,action:'cancel'}),
      })
      setStatus('canceled')
      setRunning(false)
    }catch(e){setErrors(prev=>[...prev,String((e as Error).message)])}
  }

  return <section className="rounded-xl border border-border bg-card p-4"
    data-testid="streamer-agent-clip-maker">
    <div className="mb-3 flex items-center gap-2">
      <Sparkles className="size-4 text-primary"/>
      <h2 className="text-sm font-semibold">AI Agent Clipper</h2>
      <span className="ml-auto text-xs text-muted-foreground">Story · Footage · Flow · QA</span>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="AI clipping mode" value={mode} disabled={running}
        onChange={e=>setMode(e.target.value as StreamerShortMode)}
        className="h-9 rounded-md border border-border bg-background px-2 text-sm">
        <option value="clip_moment_v1">Ranked continuous clips</option>
        <option value="clip_story_v1">Ranked stitched story clips</option>
      </select>
      <select aria-label="Clip target duration" value={seconds} disabled={running}
        onChange={e=>setSeconds(Number(e.target.value) as 30|60|90)}
        className="h-9 rounded-md border border-border bg-background px-2 text-sm">
        <option value={30}>30 seconds</option>
        <option value={60}>60 seconds</option>
        <option value={90}>90 seconds</option>
      </select>
      {sourceDurationMs>WINDOW_MS&&!allWindows?
        <label className="flex items-center gap-2 text-xs">Start minute
          <input aria-label="Source window starting minute" type="number" min={0} step={1}
            max={Math.max(0,Math.floor((sourceDurationMs-15_000)/60_000))}
            value={windowStartMin} disabled={running}
            className="h-9 w-20 rounded-md border border-border bg-background px-2"
            onChange={e=>setWindowStartMin(Math.max(0,Math.min(
              Math.floor((sourceDurationMs-15_000)/60_000),
              Number(e.target.value)||0)))}/>
        </label>:null}
      {sourceDurationMs>WINDOW_MS?
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={allWindows} disabled={running}
            onChange={e=>setAllWindows(e.target.checked)}/>
          Analyze entire {sourceKind==='upload'?'video':'VOD'} (in 20-minute batches)
        </label>:null}
      {running&&batchId?<Button size="sm" variant="outline"
        onClick={()=>void cancelBatch()}>Stop batch</Button>:null}
      <Button size="sm" disabled={!ready||running||sourceDurationMs<15_000}
        onClick={()=>void create()}>
        {running?<Loader2 className="mr-2 size-4 animate-spin"/>:
          <Sparkles className="mr-2 size-4"/>}
        {running?'Processing…':'Create AI clips'}
      </Button>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">
      {sourceKind==='stream'?'Twitch/Kick sources are fetched as bounded video windows when needed.':'Your uploaded video is used directly without another download.'}
      Each source window first discovers and ranks multiple moments from video, audio and transcript. Each ranked moment is then edited independently by the Story, Footage, Flow and QA agents, exported, and stays editable in Clip Studio. The batch continues even if you close the page. Your long-form editing mode is unchanged.
    </p>
    {!ready?<p className="mt-2 text-xs">Finish processing the source before generating agent clips.</p>:null}
    {running?<p className="mt-2 text-xs" role="status">{status}</p>:null}
    {completed.length?<div className="mt-3 flex flex-wrap gap-2">
      {completed.map((clip,i)=>
        <Link key={clip.projectId+clip.clipId}
          className="rounded-md border border-border px-3 py-2 text-xs underline"
          href={`/app/clips/${clip.projectId}/studio/${clip.clipId}`}>
          #{clip.rank??i+1} · {clip.score!=null?clip.score+'/100 · ':''}Source {clip.startMin}m · Edit
        </Link>)}
    </div>:null}
    {errors.map((error,i)=><p key={i} role="alert"
      className="mt-2 text-xs text-destructive">{error}</p>)}
  </section>
}
