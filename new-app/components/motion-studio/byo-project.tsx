'use client'

import {useCallback,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {ArrowLeft,Check,Clapperboard,Download,Film,MessageSquare,RefreshCw,Scissors} from 'lucide-react'
import {getMotionStudioClient,newIdempotencyKey} from '@/lib/motion-studio'
import type {MsProject} from '@/lib/motion-studio/types'

const steps=[
  {id:'uploads_analyzed',title:'Listening to your footage'},
  {id:'story_research',title:'Finding the best parts'},
  {id:'storyboard',title:'Putting your story together'},
  {id:'motion_graphics',title:'Adding titles and music'},
  {id:'assembly_review',title:'Ready to watch'},
] as const

export function ByoProject({projectId}:{projectId:string}){
  const client=useMemo(()=>getMotionStudioClient(),[])
  const router=useRouter()
  const [project,setProject]=useState<MsProject|null>(null)
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [note,setNote]=useState('')
  const [showChanges,setShowChanges]=useState(false)
  const [download,setDownload]=useState<{url:string;filename:string}|null>(null)

  const refresh=useCallback(async()=>{
    try{const next=await client.getProject(projectId);setProject(next);setError(null)}
    catch(err){setError(err instanceof Error?err.message:'Unable to load this video.')}
    finally{setLoading(false)}
  },[client,projectId])
  useEffect(()=>{
    let current=true
    void refresh()
    const loop=window.setInterval(()=>{if(current)void refresh()},10000)
    return ()=>{current=false;window.clearInterval(loop)}
  },[refresh])
  const run=async(action:()=>Promise<unknown>)=>{
    if(busy)return
    setBusy(true);setError(null)
    try{await action();await refresh()}
    catch(err){setError(err instanceof Error?err.message:'Could not complete this action.')}
    finally{setBusy(false)}
  }
  const openEditor=()=>run(async()=>{
    const handoff=await client.openInEditor(projectId)
    router.push('/app/video-editor/'+encodeURIComponent(handoff.clipProjectId)+
      '/edit/'+encodeURIComponent(handoff.clipId)+'?mode=simple')
  })
  const exportVideo=()=>run(async()=>{
    if(project?.export.status==='ready'){
      const file=await client.getExportDownload(projectId)
      setDownload(file)
    }else{
      await client.startExport(projectId,newIdempotencyKey('byo-export'))
    }
  })
  const submitChanges=()=>run(async()=>{
    if(!note.trim())return
    await client.requestStoryChanges(projectId,note.trim())
    setNote('');setShowChanges(false)
  })
  const retry=()=>run(async()=>{
    const failed=project?.stages.find(s=>s.status==='failed')
    if(!failed)throw new Error('No failed step is available for retry.')
    await client.retryStage(projectId,failed.id,newIdempotencyKey('byo-retry'))
  })
  const approved=Boolean(project?.story?.approved)
  const atPlan=Boolean(project?.status==='awaiting_review'&&project.story)
  const playable=Boolean(project?.previewUrl)
  const done=Boolean(project?.status==='review'||project?.status==='complete')
  const failed=project?.status==='failed'
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6" data-testid="byo-project">
      <Link href="/app" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4"/> All videos
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Clapperboard className="size-4"/> Edit My Footage
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{project?.title||'Your video'}</h1>
          <p className="text-sm text-muted-foreground">
            {loading?'Opening your project…':
             failed?'Your video needs attention.':atPlan?'Your story plan is ready for you.':
             done?'Your video is ready to watch and change.':'We are putting your video together.'}
          </p>
        </div>
        <button onClick={()=>void refresh()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <RefreshCw className="size-4"/> Refresh
        </button>
      </div>

      {project&&!done&&!failed&&(
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-label="Video progress">
          <h2 className="mb-4 font-semibold">Working on your video</h2>
          <ol className="space-y-3">
            {steps.map((step,index)=>{
              const activity=project.activity.find(a=>a.id===step.id)
              const status=activity?.status??'pending'
              return <li key={step.id} className="flex items-center gap-3 text-sm">
                <span className={'flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium '+
                  (status==='done'?'border-primary bg-primary text-primary-foreground':
                   status==='running'?'border-primary bg-primary/10 text-primary':'border-border text-muted-foreground')}>
                  {status==='done'?<Check className="size-4"/>:index+1}
                </span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  {activity?.latestAction?<p className="text-xs text-muted-foreground">{activity.latestAction}</p>:null}
                </div>
              </li>
            })}
          </ol>
          {project.status==='planning'||project.status==='producing'?
            <p className="mt-4 text-xs text-muted-foreground">You can leave this page and return whenever you like.</p>:null}
        </section>
      )}

      {atPlan&&project?.story&&(
        <section className="space-y-4 rounded-2xl border border-primary/30 bg-card p-5 shadow-sm" data-testid="byo-plan-review">
          <div>
            <h2 className="text-lg font-semibold">Check the story</h2>
            <p className="text-sm text-muted-foreground">Here's how we plan to put your footage together.</p>
          </div>
          <ol className="space-y-3">
            {project.story.chapters.map((chapter,index)=>(
              <li key={chapter.id} className="flex gap-3 rounded-xl border border-border p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold">{index+1}</span>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">{chapter.title||'Part '+(index+1)}</h3>
                  <p className="text-sm text-muted-foreground">{chapter.summary}</p>
                  {chapter.lines[0]?.text?<p className="text-xs italic text-muted-foreground">
                    “{chapter.lines[0].text.slice(0,160)}”
                  </p>:null}
                </div>
              </li>
            ))}
          </ol>
          {showChanges?(
            <div className="space-y-2">
              <label htmlFor="byo-plan-change" className="text-sm font-medium">What should we change?</label>
              <textarea id="byo-plan-change" rows={3} value={note}
                onChange={e=>setNote(e.target.value)} placeholder="Start with the second interview, then show the demonstration."
                className="w-full rounded-xl border border-border bg-background p-3 text-sm"/>
              <button disabled={busy||!note.trim()} onClick={()=>void submitChanges()}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50">Send changes</button>
            </div>
          ):null}
          <div className="flex flex-wrap gap-3">
            <button disabled={busy||approved} onClick={()=>void run(()=>client.approveStory(projectId))}
              className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Looks good, make it
            </button>
            <button onClick={()=>setShowChanges(v=>!v)} className="rounded-lg border border-border px-4 py-3 text-sm font-medium">
              <MessageSquare className="mr-2 inline size-4"/>Request a change
            </button>
          </div>
        </section>
      )}

      {failed&&project&&(
        <section className="space-y-3 rounded-2xl border border-destructive/30 bg-card p-5" role="alert">
          <h2 className="text-lg font-semibold">We couldn't finish this video</h2>
          <p className="text-sm text-muted-foreground">{project.error||'Something went wrong on our side.'}</p>
          <p className="text-xs text-muted-foreground">No footage-minute charge was made for this run.</p>
          <button disabled={busy} onClick={()=>void retry()}
            className="rounded-lg border border-border px-4 py-2 text-sm">Retry the failed step</button>
        </section>
      )}

      {project&&(playable||done)&&(
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="byo-result">
          <h2 className="text-lg font-semibold">Your video</h2>
          {project.previewUrl?
            <video key={project.previewUrl} controls playsInline preload="metadata"
              className="aspect-video w-full rounded-xl bg-black" src={project.previewUrl}/>:
            <div className="flex aspect-video items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
              Preview is being prepared.
            </div>}
          {project.styleRationale?<p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <strong className="text-foreground">What we did:</strong> {project.styleRationale}
          </p>:null}
          <div className="flex flex-wrap gap-3">
            <button disabled={busy} onClick={()=>void openEditor()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              <Scissors className="size-4"/> Open in editor
            </button>
            <button disabled={busy} onClick={()=>void exportVideo()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium">
              <Film className="size-4"/> {project.export.status==='ready'?'Get download':'Export video'}
            </button>
            {download?<a href={download.url} download={download.filename} rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm">
              <Download className="size-4"/> Download</a>:null}
          </div>
        </section>
      )}
      {error?<p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>:null}
    </main>
  )
}
