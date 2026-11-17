'use client'

import Link from 'next/link'
import { Clapperboard, Loader2, CheckCircle2, AlertTriangle, Download } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { AgentChatPanel } from './agent-chat-panel'

export type MotionAgentJob = {
  id: string
  projectId: string
  status: string
  phase: string
  progress: number
  message: string | null
  videoUrl?: string | null
  parentJobId?: string | null
  revision?: number
  artifacts?: { id: string; filename: string; kind: string; bytes: number }[]
  stages?: string[]
  events?: { id: number; stage: string; message: string; timestamp: string; percent?: number; sceneId?: string }[]
}

export function AgentJobPanel({ job, onOpenEditor, showChat = true }: { job: MotionAgentJob; onOpenEditor?: () => void; showChat?: boolean }) {
  const complete = job.status === 'complete'
  const failed = ['failed', 'dispatch_failed', 'cancelled'].includes(job.status)
  const stages = job.stages ?? ['research','story','voice','scenes','review','fixing','rendering','delivering','complete']
  const stageIndex = stages.indexOf(job.phase)
  const labels: Record<string,string> = { research:'Research', story:'Story', voice:'Narration', scenes:'Scenes', review:'Review', fixing:'Polishing', rendering:'Rendering', delivering:'Delivery', complete:'Complete' }
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-8" aria-label="AI video production job" data-testid="ms-agent-job">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center gap-3">
          {failed ? <AlertTriangle className="size-5 text-destructive" aria-hidden />
            : complete ? <CheckCircle2 className="size-5 text-primary" aria-hidden />
            : <Loader2 className="size-5 animate-spin text-primary" aria-hidden />}
          <h2 className="text-lg font-semibold">
            {failed ? 'Production request needs attention'
              : complete ? 'Your video is ready' : 'Transovo Agent is creating your video'}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground" role="status">
          {job.message || (complete ? 'Video production finished.' : 'Preparing your video request.')}
        </p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {complete ? 'Production complete' : failed ? 'Production paused' : `${Math.round(job.progress)}% complete`}
        </p>
        {!failed && !complete ? (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress} aria-label="Production progress">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: Math.min(100, Math.max(0, job.progress)) + '%' }} />
          </div>
        ) : null}
      </div>
      <div className="rounded-xl border border-border bg-card p-4" aria-label="Transovo Agent production stages">
        <h3 className="mb-3 text-sm font-semibold">Production stages</h3>
        <ol className="grid gap-2 sm:grid-cols-3">
          {stages.map((stage, i) => {
            const state = complete ? 'done' : failed && i === stageIndex ? 'paused' : i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'pending'
            return <li key={stage} className="flex items-center gap-2 text-xs">
              {state === 'done' ? <CheckCircle2 className="size-4 text-primary" aria-hidden /> : state === 'active' ? <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> : <span className="grid size-4 place-items-center rounded-full border border-border text-[9px]">{i+1}</span>}
              <span className={state === 'pending' ? 'text-muted-foreground' : 'font-medium'}>{labels[stage] ?? stage}</span>
            </li>
          })}
        </ol>
        <h3 className="mt-5 mb-2 text-sm font-semibold">Live updates</h3>
        <ol className="max-h-72 space-y-2 overflow-y-auto" aria-live="polite" aria-relevant="additions">
          {(job.events ?? []).map(event => <li key={event.id} className="flex items-start gap-3 text-sm">
            <time className="shrink-0 text-xs text-muted-foreground" dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
            <span>{event.message}</span>
          </li>)}
          {!job.events?.length ? <li className="text-sm text-muted-foreground">{complete
            ? 'Done! Your film is ready to edit.'
            : failed ? 'Production needs attention. Your existing files are safe.'
              : "We're getting everything ready…"}</li> : null}
        </ol>
      </div>
      {(complete || Boolean(job.parentJobId)) && job.videoUrl ? (
        <div className="rounded-xl border border-border bg-card p-4">
          {job.parentJobId && !complete ? <p className="mb-3 text-sm text-muted-foreground">Your previous version is available while we're making these changes.</p> : null}
          <video src={job.videoUrl} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" aria-label="Current video preview" />
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={job.videoUrl} download rel="noopener noreferrer" className={buttonVariants({ variant: 'default' })}><Download className="mr-2 size-4" /> Download video</a>
            {onOpenEditor || job.parentJobId ? <Button variant="outline" onClick={onOpenEditor ?? (()=>window.location.reload())} disabled={!onOpenEditor}>Open in Editor</Button> : null}
          </div>
        </div>
      ) : null}
      {complete && !job.videoUrl ? <p className="text-sm text-muted-foreground">The video is complete. Its playback link is being prepared.</p> : null}
      {showChat ? <AgentChatPanel projectId={job.projectId} /> : null}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clapperboard className="size-4" aria-hidden />
        <Link href="/app/motion-studio" className="text-primary hover:underline">All Motion Studio projects</Link>
      </div>
    </section>
  )
}
