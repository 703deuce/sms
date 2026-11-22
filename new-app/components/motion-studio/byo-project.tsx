'use client'

import {useCallback,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {ArrowLeft,Clapperboard} from 'lucide-react'
import {getMotionStudioClient} from '@/lib/motion-studio'
import {AGENT_JOB_CHANGED_EVENT,PollHttpError,agentJobIsActive,fetchAgentJobShared,startPolling} from '@/lib/motion-studio/poll'
import {AgentJobPanel,type MotionAgentJob} from './agent-job-panel'
import {AgentChatPanel} from './agent-chat-panel'

/**
 * Edit My Footage progress + result. Reuses the Create with AI production
 * screen pieces (AgentJobPanel progress/preview, AgentChatPanel for the plan
 * check and change requests) and opens the finished project in the existing
 * Compact Editor in simple mode.
 */
export function ByoProject({projectId}:{projectId:string}){
  const client=useMemo(()=>getMotionStudioClient(),[])
  const router=useRouter()
  const [job,setJob]=useState<MotionAgentJob|null>(null)
  const [checked,setChecked]=useState(false)
  const [title,setTitle]=useState('Your video')
  const [epoch,setEpoch]=useState(0)
  const [error,setError]=useState<string|null>(null)
  const [opening,setOpening]=useState(false)

  useEffect(()=>{
    void client.getProject(projectId).then(p=>setTitle(p.title||'Your video')).catch(()=>{})
  },[client,projectId])
  useEffect(()=>{
    const onChanged=(e:Event)=>{
      if((e as CustomEvent<{projectId?:string}>).detail?.projectId===projectId)setEpoch(n=>n+1)
    }
    window.addEventListener(AGENT_JOB_CHANGED_EVENT,onChanged)
    return ()=>window.removeEventListener(AGENT_JOB_CHANGED_EVENT,onChanged)
  },[projectId])
  useEffect(()=>{
    let active=true
    const stop=startPolling(async()=>{
      try{
        const data=await fetchAgentJobShared<MotionAgentJob>(projectId)
        const path=(u?:string|null)=>u?u.split('?')[0]:null
        if(active){
          setChecked(true)
          // Keep the current link while it points at the same video so playback never restarts.
          setJob(prev=>data.job&&prev?.videoUrl&&path(prev.videoUrl)===path(data.job.videoUrl)
            ?{...data.job,videoUrl:prev.videoUrl}:data.job??null)
        }
        return agentJobIsActive(data.job)
      }catch(err){
        if(active&&!(err instanceof PollHttpError&&err.status===503))setChecked(true)
        throw err
      }
    },{intervalMs:10_000,immediate:true})
    return ()=>{active=false;stop()}
  },[projectId,epoch])

  const openEditor=useCallback(async()=>{
    if(opening)return
    setOpening(true);setError(null)
    try{
      const h=await client.openInEditor(projectId)
      router.push('/app/video-editor/'+encodeURIComponent(h.clipProjectId)+'/edit/'+
        encodeURIComponent(h.clipId)+'?mode=simple&motionStudio='+encodeURIComponent(projectId))
    }catch(err){
      setError(err instanceof Error?err.message:'Could not open the editor.')
      setOpening(false)
    }
  },[client,opening,projectId,router])

  const complete=job?.status==='complete'
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-6" data-testid="byo-project">
      <Link href="/app" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4"/> All videos
      </Link>
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Clapperboard className="size-4"/> Edit My Footage
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {complete?'Your video is ready. Open it in the editor to change anything.':
            'You can leave this page and come back whenever you like.'}
        </p>
      </div>
      {!checked?<p role="status" className="text-sm text-muted-foreground">Opening your project…</p>:
       job?(
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_360px]">
          <AgentJobPanel job={job} showChat={false} onOpenEditor={complete?()=>void openEditor():undefined}/>
          <aside aria-label="Ask for changes" className="min-h-[360px]">
            <AgentChatPanel projectId={projectId}/>
          </aside>
        </div>
       ):(
        <p role="alert" className="rounded-xl border border-border p-4 text-sm">
          This video hasn't started yet. Go back and press Make my video again.
        </p>
       )}
      {error?<p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>:null}
    </main>
  )
}
