'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { groupSpeakerBlocks } from '@/lib/clips/script-editor/group-speaker-blocks'
import {
  findActiveWordIndex,
  formatScriptTimecode,
  sourceTimeMsFromVideo,
  videoTimeSecFromSourceMs,
} from '@/lib/clips/script-editor/sync-playhead'
import { loadScriptEditorLayout, saveScriptEditorLayout } from '@/lib/clips/script-editor/panel-layout'
import { ArrowLeft, Pause, Play } from 'lucide-react'

export type ScriptBootstrapView = {
  projectId: string
  title: string
  durationMs: number
  rangeStartMs: number
  wordCount: number
  sourceVideoUrl: string | null
  editorWords: EditorWord[]
  clips: { id: string; title: string }[]
  status: string
}

export function ScriptEditorShell({ data }: { data: ScriptBootstrapView }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const [scriptWidthPct, setScriptWidthPct] = useState(46)
  const [playheadMs, setPlayheadMs] = useState(data.rangeStartMs)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    setScriptWidthPct(loadScriptEditorLayout().scriptWidthPct)
  }, [])

  const blocks = useMemo(() => groupSpeakerBlocks(data.editorWords), [data.editorWords])
  const activeIndex = useMemo(
    () => findActiveWordIndex(data.editorWords, playheadMs),
    [data.editorWords, playheadMs],
  )

  const syncFromVideo = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setPlayheadMs(sourceTimeMsFromVideo(v.currentTime, data.rangeStartMs))
    setPlaying(!v.paused)
  }, [data.rangeStartMs])

  const seekToSourceMs = useCallback(
    (ms: number) => {
      const v = videoRef.current
      if (!v) return
      const t = videoTimeSecFromSourceMs(ms, data.rangeStartMs)
      v.currentTime = t
      setPlayheadMs(ms)
    },
    [data.rangeStartMs],
  )

  useEffect(() => {
    const el = transcriptRef.current?.querySelector(`[data-word-idx="${activeIndex}"]`)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeIndex])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startPct = scriptWidthPct
    let latestPct = startPct
    const onMove = (ev: MouseEvent) => {
      const shell = (e.target as HTMLElement).closest('[data-script-shell]') as HTMLElement | null
      if (!shell) return
      const rect = shell.getBoundingClientRect()
      const delta = ev.clientX - startX
      const next = startPct + (delta / rect.width) * 100
      const clamped = Math.min(72, Math.max(28, next))
      latestPct = clamped
      setScriptWidthPct(clamped)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      saveScriptEditorLayout({ scriptWidthPct: latestPct })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const durationLabel = formatScriptTimecode(data.durationMs)
  const currentLabel = formatScriptTimecode(Math.max(0, playheadMs - data.rangeStartMs))

  return (
    <div data-script-shell className="flex min-h-[calc(100dvh-8rem)] flex-col rounded-xl border border-border bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <Button size="sm" variant="ghost" render={<Link href={`/app/clips/${data.projectId}`} />}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to project
        </Button>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">{data.title}</div>
        <span className="text-xs text-muted-foreground">Full video · read-only (M1)</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          className="flex min-h-[240px] min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r"
          style={{ flex: `0 0 ${scriptWidthPct}%` }}
        >
          <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
            {data.wordCount} words · click a word to seek
          </div>
          <div ref={transcriptRef} className="flex-1 overflow-y-auto px-4 py-3">
            <div className="mx-auto max-w-[72ch] space-y-4 text-[17px] leading-relaxed">
              {blocks.map((block) => (
                <div key={`${block.speakerId}-${block.startMs}`}>
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <span className="size-2 rounded-full" style={{ backgroundColor: block.color }} aria-hidden />
                    <span className="font-medium">{block.speakerLabel}</span>
                    <span className="text-muted-foreground">{formatScriptTimecode(block.startMs - data.rangeStartMs)}</span>
                  </div>
                  <p>
                    {block.words.map((w) => {
                      const idx = data.editorWords.findIndex((x) => x.id === w.id)
                      const active = idx === activeIndex
                      return (
                        <button
                          key={w.id}
                          type="button"
                          data-word-idx={idx}
                          className={cn(
                            'mr-1 inline rounded-sm px-0.5 transition-colors',
                            w.isFiller && 'text-muted-foreground line-through',
                            active && 'bg-primary/20',
                            !active && 'hover:bg-muted/60',
                          )}
                          onClick={() => seekToSourceMs(w.t0Ms)}
                        >
                          {w.text}
                        </button>
                      )
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          className="hidden w-2 shrink-0 cursor-col-resize bg-border/40 hover:bg-primary/30 lg:block"
          onMouseDown={onResizeStart}
        />

        <section className="flex min-h-[280px] min-w-0 flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center bg-muted/30 p-4">
            {data.sourceVideoUrl ? (
              <video
                ref={videoRef}
                className="max-h-full max-w-full rounded-lg bg-black shadow-md"
                src={data.sourceVideoUrl}
                controls={false}
                preload="metadata"
                playsInline
                onTimeUpdate={syncFromVideo}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onClick={togglePlay}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Source video unavailable.</p>
            )}
          </div>
          <div className="flex h-11 shrink-0 items-center justify-center gap-4 border-t border-border px-3 text-sm">
            <Button type="button" size="icon-sm" variant="outline" onClick={togglePlay} disabled={!data.sourceVideoUrl}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <span className="tabular-nums text-muted-foreground">
              {currentLabel} / {durationLabel}
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
