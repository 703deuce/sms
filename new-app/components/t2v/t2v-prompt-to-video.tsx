'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Circle, Download, Loader2, Pencil, TriangleAlert } from 'lucide-react'
import { PrimaryButton } from '@/components/app/primary-button'
import { Segmented } from '@/components/app/segmented'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { routes } from '@/lib/routes'
import {
  T2V_PIPELINE_DEFAULT_NARRATOR,
  T2V_PIPELINE_DURATIONS,
  T2V_PIPELINE_NARRATORS,
  T2V_PIPELINE_STYLES,
  type T2vPipelineStyle,
} from '@/lib/t2v/pipeline/t2v-types'

type StageRow = { id: string; label: string; state: 'done' | 'active' | 'pending' }
type PipelineStatus = {
  draftId: string
  projectId: string
  title: string
  status: string
  error: string | null
  progress: number
  stages: StageRow[]
  video: { status: string; progress: number | null; downloadUrl: string | null; outputDurationMs: number | null } | null
}

const EXAMPLE =
  'Make me a 90-second YouTube video explaining why electric vehicles are becoming more popular. Use an engaging documentary style with a natural American male narrator.'

function durationLabel(s: number): string {
  return s < 60 ? `${s}s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function T2vPromptToVideo() {
  const router = useRouter()
  const params = useSearchParams()
  const runId = params.get('run')
  const [prompt, setPrompt] = useState('')
  const [durationS, setDurationS] = useState<number>(60)
  const [aspect, setAspect] = useState<'16:9' | '9:16' | '1:1'>('16:9')
  const [style, setStyle] = useState<T2vPipelineStyle>('documentary')
  const [voiceId, setVoiceId] = useState(T2V_PIPELINE_DEFAULT_NARRATOR.voiceId)
  const [captions, setCaptions] = useState(true)
  const [renderResolution, setRenderResolution] = useState<'480p' | '720p' | '1080p'>('720p')
  const [starting, setStarting] = useState(false)
  const [status, setStatus] = useState<PipelineStatus | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/t2v/pipeline/${id}`, { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'status_failed')
      setStatus(body.data as PipelineStatus)
      if (body.data.status === 'done' || body.data.status === 'failed') return
    } catch {
      /* transient — keep polling */
    }
    timer.current = setTimeout(() => void poll(id), 4000)
  }, [])

  useEffect(() => {
    if (!runId) {
      setStatus(null)
      return
    }
    void poll(runId)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [runId, poll])

  const onGenerate = async () => {
    if (prompt.trim().length < 8 || starting) return
    setStarting(true)
    try {
      const res = await fetch('/api/t2v/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), durationS, aspect, style, voiceId, captions, renderResolution }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not start')
      router.push(`/app/ai-video/new?run=${body.data.draftId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start the video')
    } finally {
      setStarting(false)
    }
  }

  if (runId) {
    const done = status?.status === 'done'
    const failed = status?.status === 'failed'
    return (
      <div className="mx-auto w-full max-w-[880px] space-y-6" data-testid="t2v-pipeline-run">
        <div>
          <h2 className="text-xl font-semibold">{status?.title || 'Creating your video…'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {done ? 'Your video is ready.' : failed ? 'This video could not be finished.' : 'You can leave this page — the video keeps building on our servers.'}
          </p>
        </div>
        {done && status?.video?.downloadUrl ? (
          <div className="space-y-3">
            <video
              src={status.video.downloadUrl}
              controls
              playsInline
              className="w-full rounded-xl border border-border bg-black"
              data-testid="t2v-pipeline-player"
            />
            <div className="flex flex-wrap gap-2">
              <a href={status.video.downloadUrl} className={buttonVariants({ variant: 'default' })} download>
                <Download className="mr-2 size-4" /> Export MP4
              </a>
              <Link href={routes.aiVideo(status.projectId)} className={buttonVariants({ variant: 'outline' })}>
                <Pencil className="mr-2 size-4" /> Continue editing
              </Link>
              <Button variant="ghost" onClick={() => router.push('/app/ai-video/new')}>
                New video
              </Button>
            </div>
          </div>
        ) : null}
        {failed ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Something went wrong</p>
              <p className="text-muted-foreground">{status?.error}</p>
              {status?.projectId ? (
                <Link href={routes.aiVideo(status.projectId)} className="mt-1 inline-block text-primary">
                  Open the project
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
        <ol className="space-y-2 rounded-xl border border-border p-4" data-testid="t2v-pipeline-stages">
          {(status?.stages ?? []).map((s) => (
            <li key={s.id} className="flex items-center gap-3 text-sm" data-state={s.state}>
              {s.state === 'done' ? (
                <Check className="size-4 text-primary" />
              ) : s.state === 'active' && !failed ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <Circle className="size-4 text-muted-foreground/50" />
              )}
              <span className={cn(s.state === 'pending' && 'text-muted-foreground')}>{s.label}</span>
              {s.id === 'rendering' && s.state === 'active' && status?.video?.progress != null ? (
                <span className="text-xs text-muted-foreground">{Math.round(status.video.progress)}%</span>
              ) : null}
            </li>
          ))}
          {!status ? <li className="text-sm text-muted-foreground">Loading…</li> : null}
        </ol>
      </div>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-[880px] gap-8 lg:grid-cols-[minmax(0,1fr)_260px]" data-testid="t2v-pipeline-form">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="t2v-prompt">Describe the video you want</Label>
          <Textarea
            id="t2v-prompt"
            rows={7}
            maxLength={4000}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={EXAMPLE}
            className="text-base"
          />
          <button type="button" className="text-xs text-primary" onClick={() => setPrompt(EXAMPLE)}>
            Use an example
          </button>
        </div>
        <div className="space-y-2">
          <Label>Length</Label>
          <div className="flex flex-wrap gap-2">
            {T2V_PIPELINE_DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationS(d)}
                className={cn('rounded-full border px-3 py-1 text-sm', durationS === d ? 'border-primary bg-primary/10' : 'border-border')}
              >
                {durationLabel(d)}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Style</Label>
          <Segmented
            className="flex w-full flex-wrap"
            aria-label="Style"
            items={T2V_PIPELINE_STYLES}
            value={style}
            onChange={(id) => setStyle(id as T2vPipelineStyle)}
          />
        </div>
        <div className="space-y-2">
          <Label>Aspect ratio</Label>
          <Segmented
            aria-label="Aspect ratio"
            items={[
              { id: '16:9', label: '16:9' },
              { id: '9:16', label: '9:16' },
              { id: '1:1', label: '1:1' },
            ]}
            value={aspect}
            onChange={(id) => setAspect(id as typeof aspect)}
          />
        </div>
        <div className="space-y-2">
          <Label>Export quality</Label>
          <Segmented
            aria-label="Export quality"
            items={[
              { id: '480p', label: '480p' },
              { id: '720p', label: '720p' },
              { id: '1080p', label: '1080p' },
            ]}
            value={renderResolution}
            onChange={(id) => setRenderResolution(id as typeof renderResolution)}
          />
        </div>
        <div className="space-y-2">
          <Label>Narrator</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {T2V_PIPELINE_NARRATORS.map((n) => (
              <button
                key={n.voiceId}
                type="button"
                onClick={() => setVoiceId(n.voiceId)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-sm',
                  voiceId === n.voiceId ? 'border-primary bg-primary/10' : 'border-border',
                )}
              >
                <span className="font-medium">{n.name}</span>
                <span className="block text-xs text-muted-foreground">{n.description}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={captions} onCheckedChange={setCaptions} aria-label="Captions" />
          <span className="text-sm">Captions</span>
        </div>
      </div>
      <aside className="flex flex-col gap-4 rounded-xl border border-border p-4 lg:sticky lg:top-4 lg:self-start">
        <p className="text-sm font-medium">What you get</p>
        <ul className="list-disc space-y-1 pl-4 text-[13px] text-muted-foreground">
          <li>A written script with a clear beginning, middle and end</li>
          <li>Real stock footage, checked shot by shot against the narration</li>
          <li>AI voiceover, background music and captions</li>
          <li>A finished MP4 you can keep editing</li>
        </ul>
        <PrimaryButton className="w-full" disabled={prompt.trim().length < 8 || starting} onClick={() => void onGenerate()} data-testid="t2v-pipeline-generate">
          {starting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Generate video
        </PrimaryButton>
        <Link href="/app/ai-video/new?mode=advanced" className="text-center text-xs text-muted-foreground hover:text-foreground">
          Build it step by step instead
        </Link>
      </aside>
    </div>
  )
}
