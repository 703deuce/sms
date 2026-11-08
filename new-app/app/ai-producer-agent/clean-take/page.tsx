'use client'

import { useEffect,useState } from 'react'

type Source={projectId:string;title:string;durationMs:number;hasTranscript:boolean}
type Run={id:string;status:string;phase?:string|null;error?:string|null;resultProjectId?:string|null;resultClipId?:string|null}
export default function CleanTakeExperiment(){
  const [sources,setSources]=useState<Source[]>([])
  const [selected,setSelected]=useState<string[]>([])
  const [instruction,setInstruction]=useState('')
  const [run,setRun]=useState<Run|null>(null)
  const [exportStatus,setExportStatus]=useState<{status:string;url?:string|null;error?:string|null}|null>(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  useEffect(()=>{
    fetch('/api/ai-producer-agent/multi-source/sources')
      .then(r=>r.json()).then(body=>{
        if(body?.data?.sources)setSources(body.data.sources)
        else setError(body?.error??'Unable to load source videos')
      }).catch(e=>setError(String(e)))
  },[])
  useEffect(()=>{
    if(!run||['ready','failed','capped','canceled'].includes(run.status))return
    let active=true
    const check=async()=>{
      try{
        const response=await fetch('/api/ai-producer-agent/runs/'+encodeURIComponent(run.id))
        const body=await response.json()
        if(active&&body?.data?.run)setRun(body.data.run)
      }catch{/* do not replace run status on temporary network failure */}
    }
    const timer=setInterval(check,4000)
    return()=>{active=false;clearInterval(timer)}
  },[run?.id,run?.status])
  useEffect(()=>{
    if(!run?.resultClipId)return
    let active=true
    const check=async()=>{
      try{
        const response=await fetch('/api/ai-producer-agent/multi-source/exports/'+
          encodeURIComponent(run.resultClipId!))
        const data=await response.json()
        if(active&&data?.data)setExportStatus(data.data)
      }catch{/* leave last known export state */}
    }
    void check()
    const timer=setInterval(check,5000)
    return()=>{active=false;clearInterval(timer)}
  },[run?.resultClipId])
  const toggle=(id:string)=>{
    setSelected(current=>current.includes(id)
      ? current.filter(x=>x!==id)
      : current.length>=5?current:[...current,id])
  }
  const start=async()=>{
    if(selected.length<1||selected.length>5)return
    setLoading(true);setError('');setRun(null);setExportStatus(null)
    try{
      const body={
        storyMode:'clean_take_v1',outputType:'story',
        genre:'irl_just_chatting',platform:'tiktok',
        music:'none',memeSfx:'off',exportOnFinish:true,
        instruction:instruction.trim()||undefined,
        sources:selected.map((projectId,index)=>{
          const source=sources.find(s=>s.projectId===projectId)!
          return {sourceId:'source_'+index,kind:'upload',
            projectId,title:source.title}
        }),
      }
      const response=await fetch('/api/ai-producer-agent/runs',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body),
      })
      const result=await response.json()
      if(!response.ok||!result?.data?.runId)
        throw Error(result?.error??'Could not start experiment')
      setRun({id:result.data.runId,status:result.data.status})
    }catch(e){setError(String((e as Error).message))}
    finally{setLoading(false)}
  }
  return <main className="mx-auto max-w-3xl space-y-6 p-6">
    <div>
      <nav aria-label="AI editing modes" className="mb-3 flex gap-3 text-sm">
        <a className="rounded-md border px-3 py-2" href="/app/clips">Single-source story</a>
        <a className="rounded-md border px-3 py-2" href="/ai-producer-agent/multi-source">Multi-source story</a>
        <span className="rounded-md border border-blue-500 px-3 py-2 font-semibold" aria-current="page">Clean Take · 1–5 recordings</span>
      </nav>
      <p className="text-sm text-neutral-500">AI Producer · Experimental mode</p>
      <h1 className="text-2xl font-semibold">Clean Take Editor</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Choose one raw talking-head recording, or multiple takes of the SAME session. Clean Take selects the best completed attempts, removes false starts, unwanted fillers and repeated mistakes, and builds one natural coherent presentation with original video and audio. Existing Story and Multi-source modes are unchanged.
      </p>
    </div>
    <section className="space-y-2">
      <h2 className="font-medium">Source recordings ({selected.length}/5 selected)</h2>
      {sources.length===0?<p className="text-sm text-neutral-500">
        No eligible uploaded recordings yet. Upload a video with a transcript first.
      </p>:sources.map(source=><label key={source.projectId}
        className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
        <input type="checkbox" checked={selected.includes(source.projectId)}
          disabled={!selected.includes(source.projectId)&&selected.length>=5}
          onChange={()=>toggle(source.projectId)}/>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{source.title}</span>
          <span className="text-xs text-neutral-500">{Math.round(source.durationMs/1000)} seconds</span>
        </span>
      </label>)}
    </section>
    <label className="block space-y-2">
      <span className="font-medium">Optional editorial direction</span>
      <textarea value={instruction} onChange={e=>setInstruction(e.target.value)}
        maxLength={4000} rows={3}
        placeholder="Optional: what should be kept, who is the audience, or which retakes you want prioritized. Leave blank for an automatic cleanup."
        className="w-full rounded-lg border bg-transparent p-3 text-sm"/>
    </label>
    <button type="button" onClick={start}
      disabled={loading||selected.length<1||Boolean(run&&!['failed','ready','capped','canceled'].includes(run.status))}
      className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50">
      {loading?'Starting…':'Edit best takes into one finished video'}
    </button>
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
    {run&&<section className="rounded-lg border p-4 space-y-2">
      <h2 className="font-medium">Experiment run</h2>
      <p className="text-sm">Status: <strong>{run.status}</strong>
        {run.phase?' · '+run.phase:''}</p>
      <p className="break-all text-xs text-neutral-500">{run.id}</p>
      {run.error&&<p role="alert" className="text-sm text-red-600">{run.error}</p>}
      {run.resultProjectId&&<div className="space-y-2 text-sm">
        <p>Editable project: <code>{run.resultProjectId}</code></p>
        <p>MP4 export: <strong>{exportStatus?.status??'pending'}</strong></p>
        {exportStatus?.error&&<p className="text-red-600">{exportStatus.error}</p>}
        {exportStatus?.url&&<a href={exportStatus.url}
          className="inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white">
          Open finished MP4
        </a>}
        <p className="text-xs text-neutral-500">
          The finished video is available when the separate render reaches READY.
          The source-aware project remains editable.
        </p>
      </div>}
    </section>}
  </main>
}
