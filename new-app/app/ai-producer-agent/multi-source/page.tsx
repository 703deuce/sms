'use client'

import { useEffect,useState } from 'react'

type Source={projectId:string;title:string;durationMs:number;hasTranscript:boolean}
type Run={id:string;status:string;phase?:string|null;error?:string|null;resultProjectId?:string|null;resultClipId?:string|null}
export default function MultiSourceStoryExperiment(){
  const [sources,setSources]=useState<Source[]>([])
  const [selected,setSelected]=useState<string[]>([])
  const [instruction,setInstruction]=useState('')
  const [run,setRun]=useState<Run|null>(null)
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
  const toggle=(id:string)=>{
    setSelected(current=>current.includes(id)
      ? current.filter(x=>x!==id)
      : current.length>=5?current:[...current,id])
  }
  const start=async()=>{
    if(selected.length<2||selected.length>5)return
    setLoading(true);setError('')
    try{
      const body={
        storyMode:'multi_source_story_v1',outputType:'story',
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
      <p className="text-sm text-neutral-500">AI Producer · Experimental mode</p>
      <h1 className="text-2xl font-semibold">Multi-source Story Editor</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Choose 2–5 recordings on the same subject. Story discovers one truthful narrative,
        Footage selects source-specific passages, and Flow assembles a finished video with
        the original video and audio. The existing single-source Story mode is unchanged.
      </p>
    </div>
    <section className="space-y-2">
      <h2 className="font-medium">Source recordings ({selected.length}/5 selected)</h2>
      {sources.length===0?<p className="text-sm text-neutral-500">
        No videos with transcripts available yet. Upload and transcribe source recordings first.
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
        placeholder="Leave blank to let Story independently discover the strongest shared narrative."
        className="w-full rounded-lg border bg-transparent p-3 text-sm"/>
    </label>
    <button type="button" onClick={start}
      disabled={loading||selected.length<2||Boolean(run&&!['failed','ready','capped','canceled'].includes(run.status))}
      className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50">
      {loading?'Starting…':'Build one finished multi-source story'}
    </button>
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
    {run&&<section className="rounded-lg border p-4 space-y-2">
      <h2 className="font-medium">Experiment run</h2>
      <p className="text-sm">Status: <strong>{run.status}</strong>
        {run.phase?' · '+run.phase:''}</p>
      <p className="break-all text-xs text-neutral-500">{run.id}</p>
      {run.error&&<p role="alert" className="text-sm text-red-600">{run.error}</p>}
      {run.resultProjectId&&<p className="text-sm">
        Finished edit project: <code>{run.resultProjectId}</code>
        <span className="block text-xs text-neutral-500">
          The render job is queued separately. Check the project's export status before publishing.
        </span>
      </p>}
    </section>}
  </main>
}
