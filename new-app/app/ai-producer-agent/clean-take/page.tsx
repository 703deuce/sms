'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CleanTakeReviewPanel } from '../../../../components/ai-producer-agent/clean-take-review-panel'
import {
  CLEAN_TAKE_COPY,
  buildCleanTakeRunBody,
  introOutroLockedRanges,
  type LockedRange,
} from '../../../../lib/clips/editor/clean-take-review'

type Source = { projectId: string; title: string; durationMs: number; hasTranscript: boolean }
type Run = {
  id: string
  status: string
  phase?: string | null
  error?: string | null
  resultProjectId?: string | null
  resultClipId?: string | null
}

const TERMINAL = new Set(['ready', 'failed', 'capped', 'canceled', 'done'])

export default function CleanTakeExperiment() {
  const [sources, setSources] = useState<Source[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [instruction, setInstruction] = useState('')
  const [run, setRun] = useState<Run | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [lockIntroSec, setLockIntroSec] = useState(0)
  const [lockOutroSec, setLockOutroSec] = useState(0)
  const [customLock, setCustomLock] = useState<{ startSec: string; endSec: string }>({ startSec: '', endSec: '' })

  useEffect(() => {
    let active = true
    setSourcesLoading(true)
    fetch('/api/ai-producer-agent/multi-source/sources')
      .then((response) => response.json())
      .then((body) => {
        if (!active) return
        if (body?.data?.sources) setSources(body.data.sources)
        else setError(body?.error ?? 'Unable to load source videos')
      })
      .catch((err) => {
        if (active) setError(String(err))
      })
      .finally(() => {
        if (active) setSourcesLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!run || TERMINAL.has(run.status)) return
    let active = true
    const check = async () => {
      try {
        const response = await fetch('/api/ai-producer-agent/runs/' + encodeURIComponent(run.id))
        const body = await response.json()
        if (active && body?.data?.run) setRun(body.data.run)
      } catch {
        /* do not replace run status on temporary network failure */
      }
    }
    const timer = setInterval(check, 4000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [run?.id, run?.status])

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : current.length >= 5 ? current : [...current, id],
    )
  }

  const lockedRanges: LockedRange[] = useMemo(() => {
    const rows: LockedRange[] = []
    for (const projectId of selected) {
      const source = sources.find((item) => item.projectId === projectId)
      if (!source) continue
      rows.push(
        ...introOutroLockedRanges(
          0,
          source.durationMs,
          Math.max(0, Math.round(lockIntroSec * 1000)),
          Math.max(0, Math.round(lockOutroSec * 1000)),
          projectId,
        ),
      )
    }
    const startSec = Number(customLock.startSec)
    const endSec = Number(customLock.endSec)
    if (Number.isFinite(startSec) && Number.isFinite(endSec) && endSec > startSec) {
      rows.push({
        id: 'lock-custom',
        label: 'Locked range',
        startMs: Math.round(startSec * 1000),
        endMs: Math.round(endSec * 1000),
      })
    }
    return rows
  }, [selected, sources, lockIntroSec, lockOutroSec, customLock.startSec, customLock.endSec])

  const start = async () => {
    if (selected.length < 1 || selected.length > 5) return
    setLoading(true)
    setError('')
    setRun(null)
    try {
      const body = buildCleanTakeRunBody({
        sources: selected.map((projectId) => {
          const source = sources.find((item) => item.projectId === projectId)!
          return { projectId, title: source.title }
        }),
        instruction,
        lockedRanges,
      })
      const response = await fetch('/api/ai-producer-agent/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok || !result?.data?.runId) throw Error(result?.error ?? 'Could not start Clean Take')
      setRun({ id: result.data.runId, status: result.data.status })
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setLoading(false)
    }
  }

  const running = Boolean(run && !TERMINAL.has(run.status))
  const reviewReady = Boolean(run && (run.status === 'ready' || run.status === 'done') && run.resultProjectId && run.resultClipId)

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-6">
      <div className="space-y-3">
        <nav aria-label="AI editing modes" className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/app/clips"
            className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Single-source story
          </Link>
          <Link
            href="/ai-producer-agent/multi-source"
            className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Multi-source story
          </Link>
          <span
            className="rounded-lg border border-primary bg-primary/10 px-3 py-2 font-semibold"
            aria-current="page"
          >
            Clean Take · 1–5 recordings
          </span>
        </nav>
        <p className="text-xs font-medium text-muted-foreground">{CLEAN_TAKE_COPY.eyebrow}</p>
        <h1 className="text-xl font-semibold tracking-tight">{CLEAN_TAKE_COPY.title}</h1>
        <p className="text-sm text-muted-foreground">{CLEAN_TAKE_COPY.subhead}</p>
        <p className="text-xs text-muted-foreground">{CLEAN_TAKE_COPY.languageNote}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Source recordings ({selected.length}/5 selected)</h2>
        {sourcesLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading recordings…
          </p>
        ) : sources.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            No eligible uploaded recordings yet. Upload a video with a transcript first.
          </p>
        ) : (
          <ul className="space-y-2">
            {sources.map((source) => {
              const checked = selected.includes(source.projectId)
              return (
                <li key={source.projectId}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      checked={checked}
                      disabled={!checked && selected.length >= 5}
                      onChange={() => toggle(source.projectId)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{source.title}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {Math.round(source.durationMs / 1000)} seconds
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="space-y-2">
        <Label htmlFor="clean-take-direction">{CLEAN_TAKE_COPY.directionLabel}</Label>
        <Textarea
          id="clean-take-direction"
          value={instruction}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInstruction(event.target.value)}
          maxLength={4000}
          rows={3}
          placeholder={CLEAN_TAKE_COPY.directionPlaceholder}
        />
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4" data-testid="clean-take-locks">
        <h2 className="text-sm font-semibold">Locked ranges</h2>
        <p className="text-xs text-muted-foreground">
          Locked intro and outro seconds are never auto-proposed or auto-applied in review. If the first pass still dropped them, restore them before export.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="w-24 shrink-0 font-medium">Lock intro</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={lockIntroSec}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setLockIntroSec(Math.max(0, Number(event.target.value) || 0))}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm tabular-nums focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Lock intro seconds"
            />
            <span className="text-xs text-muted-foreground">sec</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="w-24 shrink-0 font-medium">Lock outro</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={lockOutroSec}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setLockOutroSec(Math.max(0, Number(event.target.value) || 0))}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm tabular-nums focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Lock outro seconds"
            />
            <span className="text-xs text-muted-foreground">sec</span>
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <span className="w-24 shrink-0 font-medium">Lock range</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={customLock.startSec}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setCustomLock((current) => ({ ...current, startSec: event.target.value }))
              }
              className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm tabular-nums focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Lock range start seconds"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={customLock.endSec}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setCustomLock((current) => ({ ...current, endSec: event.target.value }))
              }
              className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm tabular-nums focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Lock range end seconds"
            />
            <span className="text-xs text-muted-foreground">sec</span>
          </label>
        </div>
      </section>

      <Button
        type="button"
        onClick={() => void start()}
        disabled={loading || selected.length < 1 || running}
        data-testid="clean-take-start"
        className="w-fit"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            {CLEAN_TAKE_COPY.ctaStarting}
          </>
        ) : (
          CLEAN_TAKE_COPY.cta
        )}
      </Button>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {run ? (
        <section className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">First-pass run</h2>
          <p className="text-sm">
            Status: <strong className="font-medium">{run.status}</strong>
            {run.phase ? ` · ${run.phase}` : ''}
          </p>
          <p className="break-all font-mono text-xs text-muted-foreground">{run.id}</p>
          {run.error ? <p role="alert" className="text-sm text-destructive">{run.error}</p> : null}
          {running ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Analyzing a reviewable first pass. Nothing will be exported until you approve it.
            </p>
          ) : null}
        </section>
      ) : null}

      {reviewReady && run?.resultProjectId && run.resultClipId ? (
        <CleanTakeReviewPanel
          projectId={run.resultProjectId}
          clipId={run.resultClipId}
          lockIntroSec={lockIntroSec}
          lockOutroSec={lockOutroSec}
          lockedRanges={lockedRanges}
        />
      ) : null}
    </main>
  )
}
