'use client'

import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {Sparkles,Loader2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {aiProducerAgentPublicEnabled} from '@/lib/ai-producer-agent/flags'
import {streamerAgentWindows,MAX_AGENT_SOURCE_WINDOW_MS} from '@/lib/streamer/agent-windows'
import {streamerBatchStatusText} from '@/lib/streamer/agent-batch-contract'
import { UNIFIED_AUTO_AGENT_CLIP_MODE } from '../../lib/clips/unified-clip-results'
import { UnifiedClipRunNote } from '../clips/unified-clip-run-note'

export type StreamerShortMode='clip_moment_v1'|'clip_story_v1'|'clip_unified_v1'
type FinishedClip={projectId:string;clipId:string;startMin:number}
type AgentRunProgress={runId:string;status:string;stage:string;elapsedSec:number;etaSec:number|null}
type RememberedAgentRun={runId:string;startMs:number;endMs:number}
type AgentRunListRow={
  id:string;status:string;sourceSnapshot?:unknown;createdAt?:string|null
}
const WINDOW_MS=MAX_AGENT_SOURCE_WINDOW_MS
const ACTIVE_AGENT_STATUSES=new Set(['queued','running','planning','applying'])

function rememberedRunKey(projectId:string){return `clips-agent-run:${projectId}`}
function rememberAgentRun(projectId:string,run:RememberedAgentRun){
  try{
    localStorage.setItem(rememberedRunKey(projectId),JSON.stringify(run))
    console.info('[clips:agent-progress]',{action:'remember_run',projectId,runId:run.runId})
  }catch(error){
    console.warn('[clips:agent-progress]',{action:'remember_run_failed',projectId,error:String(error)})
  }
}
function readRememberedAgentRun(projectId:string):RememberedAgentRun|null{
  try{
    const raw=localStorage.getItem(rememberedRunKey(projectId))
    if(!raw)return null
    const parsed=JSON.parse(raw) as Partial<RememberedAgentRun>
    if(typeof parsed.runId!=='string'||typeof parsed.startMs!=='number'||typeof parsed.endMs!=='number')return null
    return {runId:parsed.runId,startMs:parsed.startMs,endMs:parsed.endMs}
  }catch{return null}
}
function forgetAgentRun(projectId:string,runId?:string){
  try{
    const current=readRememberedAgentRun(projectId)
    if(!runId||!current||current.runId===runId)localStorage.removeItem(rememberedRunKey(projectId))
    console.info('[clips:agent-progress]',{action:'forget_run',projectId,runId:runId??current?.runId??null})
  }catch{}
}
function sourceRangeFromSnapshot(snapshot:unknown):[number,number]|null{
  if(!Array.isArray(snapshot))return null
  const first=snapshot[0]
  if(!first||typeof first!=='object'||Array.isArray(first))return null
  const range=(first as Record<string,unknown>).rangeMs
  if(!Array.isArray(range)||range.length!==2)return null
  const start=Number(range[0]),end=Number(range[1])
  return Number.isFinite(start)&&Number.isFinite(end)&&end>start?[start,end]:null
}

function formatAgentTime(seconds:number){
  const total=Math.max(0,Math.round(seconds))
  const minutes=Math.floor(total/60)
  const secs=total%60
  return minutes>0?`${minutes}m ${String(secs).padStart(2,'0')}s`:`${secs}s`
}
function estimateAgentTotalSec(windowMs:number){
  const sourceSec=Math.max(15,windowMs/1000)
  return Math.min(20*60,Math.max(6*60,Math.round(180+sourceSec*3)))
}
function agentStageLabel(phase?:string|null,lastTool?:string|null){
  const tool=(lastTool??'').toLowerCase()
  if(phase==='publishing'||tool.includes('publish'))return 'Publishing clips'
  if(phase==='finish'||tool.includes('ranked_outputs'))return 'Finishing'
  if(tool.includes('motion'))return 'Motion graphics'
  if(tool.includes('export'))return 'Queuing export'
  if(tool.includes('validate')||tool.includes('review')||tool.includes('qa'))return 'QA review'
  if(tool.includes('rough_cut')||tool.includes('footage')||tool.includes('story'))return 'Editing clips'
  if(tool.includes('candidate')||tool.includes('find_moments'))return 'Finding clips'
  if(phase==='apply')return 'Applying edits'
  if(phase==='plan')return 'Editing clips'
  return 'Analyzing source'
}
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))
async function requestJson(url:string,opts?:RequestInit){
  const response=await fetch(url,{cache:'no-store',...opts})
  const json=await response.json()
  if(!response.ok){
    const reason=typeof json.error==='string'?json.error:json.error?.message??'Request failed'
    if(reason==='ai_producer_agent_run_in_progress'||reason==='stream_agent_batch_already_running'){
      console.info('[clips:double-run]',{action:'rejected',reason})
      throw Error('AI clips are already processing. Open the current run to follow its progress.')
    }
    throw Error(reason)
  }
  return json.data
}

/** Streams can be audio-first: on demand prepare only the selected video window.
 * Runs are sequential to respect AI Producer workspace concurrency limits.
 * Each completed clip persists even when the browser leaves a multi-window run. */
export function StreamerAgentClipMaker({projectId,ready,sourceStartMs,sourceDurationMs,videoAvailable,sourceKind='stream'}:{
  projectId:string;ready:boolean;sourceStartMs:number;sourceDurationMs:number
  videoAvailable:boolean;sourceKind?:'stream'|'upload'
}){
  const mode:StreamerShortMode=UNIFIED_AUTO_AGENT_CLIP_MODE
  const [seconds,setSeconds]=useState<30|60|90>(60)
  const [windowStartMin,setWindowStartMin]=useState(0)
  const [allWindows,setAllWindows]=useState(false)
  const [running,setRunning]=useState(false)
  const [status,setStatus]=useState('idle')
  const [completed,setCompleted]=useState<FinishedClip[]>([])
  const [errors,setErrors]=useState<string[]>([])
  const canceled=useRef(false)
  const manualRunning=useRef(false)
  const [batchId,setBatchId]=useState<string|null>(null)
  const [agentProgress,setAgentProgress]=useState<AgentRunProgress|null>(null)
  const [checkingRun,setCheckingRun]=useState(true)
  const [batchLookupError,setBatchLookupError]=useState(false)
  const progressLogRef=useRef<{stage:string;bucket:number}|null>(null)
  useEffect(()=>()=>{canceled.current=true},[])
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
          completed:FinishedClip[];errors:string[];startedAt?:string|null
        }
        if(stopped)return
        setBatchLookupError(false)
        if(data?.id&&!manualRunning.current){
          setBatchId(data.id)
          setCompleted(data.completed??[])
          setErrors(data.errors??[])
          setStatus(streamerBatchStatusText(data,Date.now()))
          setRunning(data.status==='running')
        }
      }catch{
        // An unreachable status endpoint is not a completed/empty batch.
        // Preserve rendered clip links and let the next poll reconnect.
        if(!stopped)setBatchLookupError(true)
      }
      if(!stopped)timer=setTimeout(poll,5000)
    }
    void poll()
    return ()=>{stopped=true;if(timer)clearTimeout(timer)}
  },[projectId])

  useEffect(()=>{
    if(!ready){
      setCheckingRun(false)
      return
    }
    let stopped=false
    const restore=async()=>{
      console.info('[clips:agent-progress]',{action:'restore_begin',projectId})
      try{
        const batch=await requestJson('/api/streamer/agent-batches?projectId='+
          encodeURIComponent(projectId)) as null|{status?:string}
        if(batch?.status==='running'){
          console.info('[clips:agent-progress]',{action:'restore_skip_batch',projectId})
          return
        }
      }catch{
        // Batch lookup is advisory; manual-run recovery still proceeds.
      }

      let remembered=readRememberedAgentRun(projectId)
      if(remembered){
        const rememberedRunId=remembered.runId
        try{
          const data=await requestJson('/api/ai-producer-agent/runs/'+encodeURIComponent(remembered.runId)) as {
            run:{status:string}
          }
          if(!ACTIVE_AGENT_STATUSES.has(data.run.status)){
            forgetAgentRun(projectId,rememberedRunId)
            remembered=null
          }
        }catch(error){
          console.warn('[clips:agent-progress]',{
            action:'restore_remembered_lookup_failed',projectId,runId:rememberedRunId,error:String(error),
          })
        }
      }

      if(!remembered){
        try{
          const data=await requestJson('/api/ai-producer-agent/runs?active=1&projectId='+
            encodeURIComponent(projectId)) as {runs:AgentRunListRow[]}
          const active=data.runs?.find(run=>ACTIVE_AGENT_STATUSES.has(run.status))
          if(active){
            const range=sourceRangeFromSnapshot(active.sourceSnapshot) ??
              [sourceStartMs,sourceStartMs+Math.min(sourceDurationMs,WINDOW_MS)] as [number,number]
            remembered={runId:active.id,startMs:range[0],endMs:range[1]}
            rememberAgentRun(projectId,remembered)
          }
        }catch(error){
          console.warn('[clips:agent-progress]',{action:'restore_active_lookup_failed',projectId,error:String(error)})
        }
      }

      if(!remembered||stopped){
        console.info('[clips:agent-progress]',{action:'restore_none',projectId})
        return
      }

      console.info('[clips:agent-progress]',{action:'restore_attach',projectId,runId:remembered.runId})
      canceled.current=false
      manualRunning.current=true
      setRunning(true)
      setErrors([])
      setStatus('Agent run: reconnecting')
      try{
        const clip=await pollRun(remembered.runId,remembered.startMs,remembered.endMs)
        if(!stopped)setCompleted(prev=>prev.some(item=>item.clipId===clip.clipId)?prev:[...prev,clip])
      }catch(error){
        if(!stopped)setErrors(prev=>[...prev,`Agent run: ${String((error as Error).message)}`])
      }finally{
        manualRunning.current=false
        if(!stopped)setRunning(false)
        console.info('[clips:agent-progress]',{action:'restore_end',projectId,runId:remembered.runId})
      }
    }
    void restore().finally(()=>{if(!stopped)setCheckingRun(false)})
    return()=>{stopped=true}
  },[projectId,ready,sourceDurationMs,sourceStartMs])
  if(!aiProducerAgentPublicEnabled())return null

  async function prepareSource(startMs:number,endMs:number){
    if(videoAvailable)return {projectId,rangeMs:[startMs,endMs] as [number,number]}
    setStatus('Fetching actual source video')
    const created=await requestJson('/api/streamer/agent-windows',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({parentProjectId:projectId,rangeStartMs:startMs,rangeEndMs:endMs}),
    }) as {projectId:string}
    // Poll durable worker preparation, never assume a queued job has completed.
    for(let i=0;i<240&&!canceled.current;i++){
      const info=await requestJson('/api/streamer/agent-windows?projectId='+
        encodeURIComponent(created.projectId)) as {
          ready:boolean;durationMs:number;error?:string;jobStatus?:string;status:string}
      if(info.ready)return {projectId:created.projectId,
        rangeMs:[0,info.durationMs] as [number,number]}
      if(info.status==='FAILED'||info.status==='CANCELED'||info.jobStatus==='FAILED')
        throw Error(info.error??'Source video could not be prepared')
      await sleep(3000)
    }
    throw Error('Source preparation did not finish in this session')
  }

  async function pollRun(runId:string,startMs:number,endMs:number){
    for(let i=0;i<600&&!canceled.current;i++){
      const data=await requestJson('/api/ai-producer-agent/runs/'+
        encodeURIComponent(runId)) as {run:{
          status:string;phase?:string|null;createdAt?:string|null;error?:string|null;
          resultProjectId?:string|null;resultClipId?:string|null;
          steps?:Array<{tool?:string|null;phase?:string|null}>}}
      const run=data.run
      const lastStep=run.steps?.length?run.steps[run.steps.length-1]:undefined
      const elapsedSec=run.createdAt&&Number.isFinite(Date.parse(run.createdAt))
        ?Math.max(0,Math.floor((Date.now()-Date.parse(run.createdAt))/1000))
        :i*3
      const stage=agentStageLabel(run.phase,lastStep?.tool)
      const remaining=estimateAgentTotalSec(endMs-startMs)-elapsedSec
      // This is a heuristic, not a worker deadline. Once exceeded, give an
      // unknown ETA rather than promising zero while model work continues.
      const etaSec=remaining>0?remaining:null
      const nextProgress={runId,status:run.status,stage,elapsedSec,etaSec}
      setAgentProgress(nextProgress)
      const bucket=Math.floor(elapsedSec/30)
      if(progressLogRef.current?.stage!==stage||progressLogRef.current?.bucket!==bucket){
        console.info('[clips:agent-progress]',nextProgress)
        progressLogRef.current={stage,bucket}
      }
      setStatus('Agent run: '+run.status)
      if(['ready','done'].includes(run.status)){
        forgetAgentRun(projectId,runId)
        if(!run.resultProjectId||!run.resultClipId)
          throw Error('Agent completed without an editable clip')
        return {projectId:run.resultProjectId,clipId:run.resultClipId,
          startMin:Math.max(0,Math.floor((startMs-sourceStartMs)/60_000))}
      }
      if(['failed','capped','canceled'].includes(run.status)){
        forgetAgentRun(projectId,runId)
        throw Error(run.error??'Agent did not finish the clip')
      }
      await sleep(3000)
    }
    throw Error('Agent run did not finish in this session')
  }

  async function runWindow(startMs:number,endMs:number){
    const local=await prepareSource(startMs,endMs)
    if(canceled.current)throw Error('Session closed')
    setStatus('Running Story, Footage, Flow and QA')
    const started=await requestJson('/api/ai-producer-agent/runs',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        sources:[{sourceId:sourceKind==='upload'?'uploaded_recording':'stream_recording',kind:sourceKind,
          projectId:local.projectId,rangeMs:local.rangeMs}],
        outputType:'story',storyMode:mode,
        targetLengthS:[Math.max(15,seconds-10),Math.min(105,seconds+10)],
        visualEvidenceMode:'visual_audio',exportOnFinish:true,
        instruction:mode==='clip_moment_v1'
          ? 'Select one real continuous gaming/streaming event with full setup, action and reaction.'
          : 'Build one compelling source-grounded short story from multiple real passages.',
      }),
    }) as {runId:string}
    rememberAgentRun(projectId,{runId:started.runId,startMs,endMs})
    console.info('[clips:agent-progress]',{action:'run_started',runId:started.runId,sourceWindowMs:endMs-startMs})
    return pollRun(started.runId,startMs,endMs)
  }

  async function create(){
    if(running)return
    canceled.current=false
    setRunning(true);setCompleted([]);setErrors([]);setAgentProgress(null)
    progressLogRef.current=null
    console.info('[clips:agent-progress]',{action:'create_begin',projectId,allWindows,seconds})
    let durableStarted=false
    try{
      if(allWindows){
        const batch=await requestJson('/api/streamer/agent-batches',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({projectId,mode,seconds,action:'start'}),
        }) as {id:string;status:string;total:number}
        setBatchId(batch.id)
        setStatus(`Batch queued: ${batch.total} source windows`)
        durableStarted=true
        return
      }
      manualRunning.current=true
      const windows=streamerAgentWindows(sourceStartMs,sourceDurationMs,
        false,windowStartMin)
      for(const [index,[start,end]] of windows.entries()){
        if(canceled.current)break
        setStatus(`Window ${index+1}/${windows.length}: preparing`)
        try{
          const clip=await runWindow(start,end)
          if(canceled.current)break
          setCompleted(prev=>[...prev,clip])
        }catch(e){
          if(canceled.current)break
          setErrors(prev=>[...prev,`Window ${index+1}: ${String((e as Error).message)}`])
        }
      }
      if(!canceled.current)setStatus('Complete')
    }finally{
      manualRunning.current=false
      if(!durableStarted){
        console.info('[clips:agent-progress]',{action:'create_end',projectId,canceled:canceled.current})
        setRunning(false)
      }
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
    <UnifiedClipRunNote testId="streamer-agent-clip-mode" className="mb-3">
    <div className="flex flex-wrap items-center gap-2">
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
      <Button size="sm" disabled={!ready||running||checkingRun||sourceDurationMs<15_000}
        onClick={()=>void create()}>
        {running||checkingRun?<Loader2 className="mr-2 size-4 animate-spin"/>:
          <Sparkles className="mr-2 size-4"/>}
        {checkingRun?'Checking…':running?'Processing…':'Create AI clips'}
      </Button>
    </div>
    </UnifiedClipRunNote>
    <p className="mt-2 text-xs text-muted-foreground">
      {sourceKind==='stream'?'Twitch/Kick replay/VOD sources are fetched as bounded video windows when needed; this is not real-time live clipping.':'Your uploaded video is used directly without another download.'}
      Each batch runs the same specialist agents and produces an editable Clip Studio result.
      Your long-form editing mode is unchanged.
      {allWindows?' This full-VOD batch continues after you close the page.':''}
    </p>
    {!ready?<p className="mt-2 text-xs">Finish processing the source before generating agent clips.</p>:null}
    {running?<p className="mt-2 text-xs" role="status">
      {agentProgress
        ? `Agent run: ${agentProgress.status} · ${agentProgress.stage} · elapsed ${formatAgentTime(agentProgress.elapsedSec)} · ${agentProgress.etaSec===null?'ETA unavailable (taking longer than estimated)':`ETA ~${formatAgentTime(agentProgress.etaSec)}`}`
        : status}
    </p>:null}
    {batchLookupError&&batchId?<p role="status" className="mt-2 text-xs text-muted-foreground">
      Batch status temporarily unavailable · reconnecting. Saved clips remain accessible; no new run started.
    </p>:null}
    {completed.length?<div className="mt-3 flex flex-wrap gap-2">
      {completed.map((clip,i)=>
        <Link key={clip.projectId+clip.clipId}
          className="rounded-md border border-border px-3 py-2 text-xs underline"
          href={`/app/video-editor/${clip.projectId}/studio/${clip.clipId}`}>
          Clip {i+1} · Source {clip.startMin}m · Edit
        </Link>)}
    </div>:null}
    {errors.map((error,i)=><p key={i} role="alert"
      className="mt-2 text-xs text-destructive">{error}</p>)}
  </section>
}
