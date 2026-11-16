'use client'

import Link from 'next/link'
import { Clapperboard, Loader2, CheckCircle2, AlertTriangle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type MotionAgentJob = {
  id: string
  projectId: string
  status: string
  phase: string
  progress: number
  message: string | null
  videoUrl?: string | null
  artifacts?: { id: string; filename: string; kind: string; bytes: number }[]
}

export function AgentJobPanel({ job, onOpenEditor }: { job: MotionAgentJob; onOpenEditor?: () => void }) {
  const complete = job.status === 'complete'
  const failed = ['failed', 'dispatch_failed'].includes(job.status)
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-8" aria-label="AI video production job" data-testid="ms-agent-job">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center gap-3">
          {failed ? <AlertTriangle className="size-5 text-destructive" aria-hidden />
            : complete ? <CheckCircle2 className="size-5 text-primary" aria-hidden />
            : <Loader2 className="size-5 animate-spin text-primary" aria-hidden />}
          <h2 className="text-lg font-semibold">
            {failed ? 'Production request needs attention'
              : complete ? 'Your video is ready' : 'Grokbot production'}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground" role="status">
          {job.message || (complete ? 'Video production finished.' : 'Preparing your video request.')}
        </p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Job: {job.id} · {job.phase} · {job.status}
        </p>
        {!failed && !complete ? (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress} aria-label="Production progress">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: Math.min(100, Math.max(0, job.progress)) + '%' }} />
          </div>
        ) : null}
      </div>
      {complete && job.videoUrl ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <video src={job.videoUrl} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" aria-label="Finished documentary" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild><a href={job.videoUrl} download rel="noopener noreferrer"><Download className="mr-2 size-4" /> Download video</a></Button>
            {onOpenEditor ? <Button variant="outline" onClick={onOpenEditor}>Open in Editor</Button> : null}
          </div>
        </div>
      ) : null}
      {complete && !job.videoUrl ? <p className="text-sm text-muted-foreground">The video is complete. Its playback link is being prepared.</p> : null}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clapperboard className="size-4" aria-hidden />
        <Link href="/app/motion-studio" className="text-primary hover:underline">All Motion Studio projects</Link>
      </div>
    </section>
  )
}
