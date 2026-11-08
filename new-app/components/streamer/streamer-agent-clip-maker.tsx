'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { aiProducerAgentPublicEnabled } from '@/lib/ai-producer-agent/flags'

export type StreamerShortMode = 'clip_moment_v1' | 'clip_story_v1'

/** Two opt-in, specialist-agent-powered clip products. Never invokes the
 * historic highlights picker or overwrites long-form gaming mode. */
export function StreamerAgentClipMaker({projectId,ready,sourceStartMs,sourceDurationMs,videoAvailable}:{
  projectId:string
  ready:boolean
  videoAvailable:boolean
  sourceStartMs:number
  sourceDurationMs:number
}) {
  const router=useRouter()
  const [windowStartMin,setWindowStartMin]=useState(()=>Math.max(0,Math.floor((sourceDurationMs-20*60_000)/60_000)))
  const [mode,setMode]=useState<StreamerShortMode>('clip_moment_v1')
  const [seconds,setSeconds]=useState<30|60|90>(60)
  const [runId,setRunId]=useState<string|null>(null)
  const [status,setStatus]=useState('idle')
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{
    if(!runId)return
    let stopped=false
    let handle:ReturnType<typeof setTimeout>|undefined
    const poll=async()=>{
      try{
        const response=await fetch('/api/ai-producer-agent/runs/'+encodeURIComponent(runId),
          {cache:'no-store'})
        const json=await response.json()
        if(!response.ok)throw Error(json.error?.message??json.error??'Could not check AI clip')
        const run=json.data?.run as {status:string;error?:string;resultProjectId?:string;resultClipId?:string}
        if(stopped)return
        setStatus(run.status)
        if(['ready','done'].includes(run.status)){
          if(run.resultProjectId&&run.resultClipId){
            router.push('/app/clips/'+run.resultProjectId+'/studio/'+run.resultClipId)
          }else{
            setError('AI analysis completed without an editable clip. Check the run details.')
          }
          return
        }
        if(['failed','capped','canceled'].includes(run.status)){
          setError(run.error??'The agent did not produce a valid short clip.')
          return
        }
        handle=setTimeout(poll,3000)
      }catch(e){
        if(stopped)return
        setError(String((e as Error).message))
      }
    }
    void poll()
    return ()=>{stopped=true;if(handle)clearTimeout(handle)}
  },[runId,router])
  if(!aiProducerAgentPublicEnabled())return null
  const running=!!runId&&!error&&!['done','ready','failed','capped','canceled'].includes(status)
  const create=async()=>{
    setError(null);setRunId(null);setStatus('queued')
    try{
      const windowStart=sourceStartMs+windowStartMin*60_000
      const windowEnd=Math.min(sourceStartMs+sourceDurationMs,windowStart+20*60_000)
      if(windowEnd-windowStart<15_000)throw Error('Select a source window of at least 15 seconds')
      const response=await fetch('/api/ai-producer-agent/runs',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          sources:[{sourceId:'stream_recording',kind:'stream',projectId,rangeMs:[windowStart,windowEnd]}],
          outputType:'story',storyMode:mode,
          targetLengthS:[Math.max(15,seconds-10),Math.min(105,seconds+10)],
          visualEvidenceMode:'visual_audio',exportOnFinish:true,
          instruction:mode==='clip_moment_v1'
            ? 'Choose one continuous, self-contained gaming or streamer moment with the complete action and reaction.'
            : 'Create one powerful short narrative using separate genuine moments: setup, escalation and payoff.',
        }),
      })
      const json=await response.json()
      if(!response.ok)throw Error(json.error?.message??json.error??'Could not start AI clipping')
      if(!json.data?.runId)throw Error('Clip agent run ID missing')
      setRunId(json.data.runId)
    }catch(e){
      setStatus('failed');setError(String((e as Error).message))
    }
  }
  return (
    <section className="rounded-xl border border-border bg-card p-4" data-testid="streamer-agent-clip-maker">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">AI Agent Clipper</h2>
        <span className="ml-auto text-xs text-muted-foreground">Story · Footage · Flow · QA</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="AI clipping mode" value={mode} disabled={running}
          onChange={e=>setMode(e.target.value as StreamerShortMode)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          <option value="clip_moment_v1">Single continuous moment</option>
          <option value="clip_story_v1">AI story clip (multiple moments)</option>
        </select>
        <select aria-label="Clip target duration" value={seconds} disabled={running}
          onChange={e=>setSeconds(Number(e.target.value) as 30|60|90)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          <option value={30}>30 seconds</option>
          <option value={60}>60 seconds</option>
          <option value={90}>90 seconds</option>
        </select>
        {sourceDurationMs>20*60_000?(
          <label className="flex items-center gap-2 text-xs">
            Start minute
            <input aria-label="VOD window starting minute" type="number" step={1} min={0}
              max={Math.max(0,Math.floor((sourceDurationMs-15_000)/60_000))}
              className="h-9 w-20 rounded-md border border-border bg-background px-2 text-sm"
              value={windowStartMin} disabled={running}
              onChange={e=>setWindowStartMin(Math.max(0,Math.min(
                Math.floor((sourceDurationMs-15_000)/60_000),Number(e.target.value)||0)))} />
          </label>
        ):null}
        <Button size="sm" onClick={()=>void create()} disabled={!ready||!videoAvailable||running}>
          {running?<Loader2 className="mr-2 size-4 animate-spin"/>:<Sparkles className="mr-2 size-4"/>}
          {running?'Agents editing…':'Create AI clip'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        New specialist-agent pipeline. Single Moment keeps one continuous scene;
        Story Clip can assemble different moments. Each run inspects an explicitly selected
        segment of up to 20 minutes; full-stream batch discovery is not yet enabled.
        The long-form gaming mode is unchanged.
      </p>
      {!ready?<p className="mt-2 text-xs">Source must finish importing first.</p>:null}
      {ready&&!videoAvailable?<p className="mt-2 text-xs text-amber-600">This VOD uses audio-first streaming without a stored source video. Agent clips require an uploaded video segment; the automatic on-demand Twitch/Kick video handoff is not connected yet.</p>:null}
      {running?<p role="status" className="mt-2 text-xs">AI clip status: {status}. The finished edit opens in Clip Studio.</p>:null}
      {error?<p role="alert" className="mt-2 text-xs text-destructive">{error}</p>:null}
    </section>
  )
}
